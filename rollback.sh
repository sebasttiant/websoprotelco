#!/usr/bin/env bash
set -Eeuo pipefail

# ==========================================================================
# SOPROTELCO — rollback en VPS
#
# Revierte el ultimo despliegue: restaura el codigo al ultimo commit desplegado
# con exito y la base de datos al dump que deploy.sh tomo justo antes de migrar.
#
# Flujo: lock -> manifiesto -> validar dump -> confirmar -> parar web ->
#        dump de seguridad -> recrear base -> restaurar -> codigo -> rebuild -> verificar
#
# ALCANCE — LEER ANTES DE USAR
#
#   REVIERTE:
#     - el codigo (git reset --hard al SHA del ultimo deploy exitoso);
#     - la base de datos completa (se elimina y se recrea desde el dump).
#
#   NO REVIERTE, y no existe backup de esto:
#     - las imagenes subidas (volumen docker `uploads-data`, montado en
#       /app/public/uploads). NO estan en el tar de deploy.sh: ese tar se arma
#       desde el host, y en el host public/uploads solo contiene .gitkeep.
#     - los documentos subidos (public/documents): no tienen volumen, viven en la
#       capa de escritura del contenedor. El `docker compose up --build` de este
#       script RECREA el contenedor web y los destruye.
#
#   Consecuencia concreta: products.image_url y categories.image_url vuelven a su
#   valor anterior, pero si el archivo al que apuntan ya no esta en disco, la
#   referencia queda rota. Restaurar la base NO devuelve los bytes de las imagenes.
#
#   Tampoco revierte los datos cargados por operadores despues del despliegue: el
#   dump es anterior a ellos y se pierden. Por eso este script toma un dump de
#   seguridad del estado actual antes de destruir nada.
# ==========================================================================

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
BACKUP_DIR="$APP_DIR/backups"
MANIFEST="$BACKUP_DIR/rollback-manifest"
WEB_SERVICE="${WEB_SERVICE:-web}"
DB_SERVICE="${DB_SERVICE:-db}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"

cd "$APP_DIR"
mkdir -p "$BACKUP_DIR"

# Same lock deploy.sh takes: a rollback racing a deploy would mean git reset --hard against
# git pull, and pg_restore against a migration.
exec 9>"$BACKUP_DIR/.deploy.lock"
if ! flock -n 9; then
  echo "ERROR: a deploy or another rollback is running (lock: $BACKUP_DIR/.deploy.lock)."
  exit 1
fi

# --------------------------------------------------------------------------
# 1. Read the manifest
# --------------------------------------------------------------------------
echo "==> Reading rollback manifest..."
if [ ! -s "$MANIFEST" ]; then
  echo "ERROR: no manifest at $MANIFEST"
  echo "       Nothing to roll back to. A deploy must run (and back up) first."
  exit 1
fi

entry="$(tail -n 1 "$MANIFEST")"
entry_date="$(printf '%s' "$entry" | cut -f1)"
target_sha="$(printf '%s' "$entry" | cut -f2)"
dump_file="$(printf '%s' "$entry" | cut -f3)"
dump_db="$(printf '%s' "$entry" | cut -f4)"

if [ -z "$entry_date" ] || [ -z "$target_sha" ] || [ -z "$dump_file" ] || [ -z "$dump_db" ]; then
  echo "ERROR: last manifest entry is malformed:"
  echo "       $entry"
  exit 1
fi

echo "    Backup taken:  $entry_date"
echo "    Code target:   $target_sha"
echo "    Database:      $dump_db"
echo "    Dump file:     $dump_file"

# --------------------------------------------------------------------------
# 2. Validate everything before touching anything
# --------------------------------------------------------------------------
echo "==> Validating rollback target..."

if [ ! -f "$dump_file" ]; then
  echo "ERROR: dump file is missing: $dump_file"
  echo "       Aborting. Older entries exist in $MANIFEST but this script only"
  echo "       restores the most recent one; recover it by hand if you must."
  exit 1
fi

if ! git cat-file -e "${target_sha}^{commit}" 2>/dev/null; then
  echo "ERROR: commit $target_sha is not in this repository."
  echo "       Try 'git fetch --all' first. Aborting without changes."
  exit 1
fi

# git reset --hard destroys uncommitted work. Refuse rather than silently discard.
# (backups/ is gitignored, so deploy.sh's own dumps do not trip this.)
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: working tree is not clean. Refusing to run 'git reset --hard'."
  echo "       Commit, stash, or discard these changes first:"
  git status --short
  exit 1
fi

if ! docker compose exec -T "$DB_SERVICE" sh -lc 'pg_isready -U "$POSTGRES_USER" -q'; then
  echo "ERROR: '$DB_SERVICE' is not accepting connections; cannot restore. Start it first:"
  echo "         docker compose up -d $DB_SERVICE"
  exit 1
fi

# The manifest records which database the dump came from. Restoring into whatever
# POSTGRES_DB the container happens to have now would silently overwrite the wrong
# database while the confirmation below names the right one.
if ! live_db="$(docker compose exec -T "$DB_SERVICE" printenv POSTGRES_DB 2>/dev/null)"; then
  echo "ERROR: could not read POSTGRES_DB from '$DB_SERVICE'. Aborting."
  exit 1
fi
live_db="$(printf '%s' "$live_db" | tr -d '\r\n')"
if [ "$live_db" != "$dump_db" ]; then
  echo "ERROR: manifest dump is for database '$dump_db' but '$DB_SERVICE' is now running"
  echo "       '$live_db'. Refusing to restore into a different database."
  exit 1
fi

# Validate the dump with the container's own tools; the host may have none. stderr is kept so
# a docker/exec failure is not reported to the operator as a corrupt backup.
if ! toc="$(docker compose exec -T "$DB_SERVICE" pg_restore --list < "$dump_file" 2>&1)"; then
  echo "ERROR: could not read the dump: $dump_file"
  echo "       pg_restore said: $toc"
  echo "       Refusing to destroy live data for a backup that may not restore."
  exit 1
fi

toc_tables="$(printf '%s\n' "$toc" | grep -c 'TABLE DATA public ' || true)"
if [ "$toc_tables" -eq 0 ]; then
  echo "ERROR: dump contains no table data: $dump_file"
  exit 1
fi
echo "    Dump validated: ${toc_tables} table(s) recoverable."

# --------------------------------------------------------------------------
# 3. Explicit confirmation
# --------------------------------------------------------------------------
current_sha="$(git rev-parse HEAD)"
cat <<WARNING

--------------------------------------------------------------------------
 DESTRUCTIVE OPERATION

 Code:      $current_sha
        ->  $target_sha

 Database:  '$dump_db' will be DROPPED and recreated from
            $(basename "$dump_file")

 Every change made to the database after $entry_date will be LOST,
 including data entered by operators since the deploy. A safety dump of
 the CURRENT database is taken first.

 Uploaded images and documents are NOT rolled back and have NO backup.
 See the header of this script before continuing.
--------------------------------------------------------------------------

WARNING

printf 'Type ROLLBACK (uppercase) to proceed: '
read -r answer
if [ "$answer" != "ROLLBACK" ]; then
  echo "Aborted. Nothing was changed."
  exit 1
fi

# --------------------------------------------------------------------------
# 4. Stop the web service
# --------------------------------------------------------------------------
# Must happen before the restore. The app holds a connection pool; DROP DATABASE needs no
# other sessions, and a running container would both block the drop and keep writing into a
# database that is about to be replaced. `stop` overrides restart:unless-stopped.
echo "==> Stopping '$WEB_SERVICE' for the restore..."
docker compose stop "$WEB_SERVICE"

# --------------------------------------------------------------------------
# 5. Safety dump of the current state
# --------------------------------------------------------------------------
# The rollback is about to destroy the current database. If the operator rolled back by
# mistake, or the restore turns out to be the wrong target, this is the only way back.
safety_dump="$BACKUP_DIR/pre-rollback-${dump_db}-$(date +%Y%m%d-%H%M%S).dump"
echo "==> Taking a safety dump of the current database..."
if ! docker compose exec -T "$DB_SERVICE" sh -lc \
      'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > "$safety_dump"; then
  rm -f "$safety_dump"
  echo "ERROR: could not dump the current database. Aborting BEFORE destroying anything."
  echo "       '$WEB_SERVICE' is stopped; restart it with:"
  echo "         docker compose start $WEB_SERVICE"
  exit 1
fi
echo "    Safety dump: $safety_dump"

# --------------------------------------------------------------------------
# 6. Restore database
# --------------------------------------------------------------------------
# DROP + CREATE rather than `pg_restore --clean`. --clean only drops objects PRESENT IN THE
# DUMP, so any table created by the migration being rolled back would survive while
# schema_migrations reverted — leaving a hybrid schema that makes the next deploy fail on
# `CREATE TABLE ... already exists`. Dropping the database is the only way to actually return
# to the dump's state.
echo "==> Recreating database '$dump_db'..."
if ! docker compose exec -T "$DB_SERVICE" sh -lc '
      set -e
      psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 \
        -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '"'"'$POSTGRES_DB'"'"' AND pid <> pg_backend_pid();" >/dev/null
      psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\";"
      psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$POSTGRES_DB\" OWNER \"$POSTGRES_USER\";"
    '; then
  echo "ERROR: could not recreate '$dump_db'. The database may be gone or partially dropped."
  echo "       Code is UNCHANGED (still $current_sha) and '$WEB_SERVICE' is stopped."
  echo "       Recover the current data with:"
  echo "         docker compose exec -T $DB_SERVICE sh -lc 'pg_restore -U \$POSTGRES_USER -d \$POSTGRES_DB --no-owner' < $safety_dump"
  exit 1
fi

echo "==> Restoring database from $(basename "$dump_file")..."
# --single-transaction: a failure rolls back to the empty database rather than half-restoring.
if ! docker compose exec -T "$DB_SERVICE" sh -lc \
      'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --single-transaction --no-owner' \
      < "$dump_file"; then
  echo ""
  echo "ERROR: database restore FAILED. '$dump_db' is now EMPTY."
  echo "       Code is UNCHANGED (still $current_sha) and '$WEB_SERVICE' is stopped, so nothing"
  echo "       is serving traffic against it."
  echo "       To return to the state from before this rollback:"
  echo "         docker compose exec -T $DB_SERVICE sh -lc 'pg_restore -U \$POSTGRES_USER -d \$POSTGRES_DB --single-transaction --no-owner' < $safety_dump"
  echo "         docker compose start $WEB_SERVICE"
  exit 1
fi
echo "    Database restored."

# --------------------------------------------------------------------------
# 7. Restore code
# --------------------------------------------------------------------------
# After the data, so a failed restore leaves code and data consistently at the current commit
# rather than stranding old code against new data.
echo "==> Restoring code to $target_sha..."
if ! git reset --hard "$target_sha"; then
  echo "ERROR: git reset failed. Database is at $target_sha's data but code is $current_sha."
  echo "       Fix the repository, then re-run: git reset --hard $target_sha"
  exit 1
fi

# NOTE: this moves the branch pointer backwards. A later `deploy.sh` run does
# `git pull --ff-only`, which fast-forwards straight back to the commit just rolled back.
# Nothing here quarantines the bad commit — revert or fix it on the remote before deploying
# again, or the next deploy silently re-introduces the incident.
echo "    WARNING: '$target_sha' is now checked out, but the next deploy will pull the branch"
echo "             forward again. Fix or revert the bad commit on the remote first."

# --------------------------------------------------------------------------
# 8. Rebuild and health check
# --------------------------------------------------------------------------
echo "==> Rebuilding '$WEB_SERVICE' at the restored commit..."
docker compose up -d --build "$WEB_SERVICE"

echo "==> Waiting for '$WEB_SERVICE' to become healthy (timeout ${HEALTH_TIMEOUT}s)..."
deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
until status="$(docker compose ps -q "$WEB_SERVICE" | xargs -r docker inspect -f '{{.State.Health.Status}}' 2>/dev/null)"; [ "$status" = "healthy" ]; do
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "ERROR: '$WEB_SERVICE' did not become healthy (status: ${status:-unknown}). Last logs:"
    docker compose logs --tail=80 "$WEB_SERVICE"
    echo ""
    echo "       Code and database ARE rolled back; only the container is unhealthy."
    echo "       Inspect the logs above. To undo the rollback entirely:"
    echo "         git reset --hard $current_sha"
    echo "         docker compose exec -T $DB_SERVICE sh -lc 'pg_restore -U \$POSTGRES_USER -d \$POSTGRES_DB --single-transaction --no-owner' < $safety_dump"
    echo "         docker compose up -d --build $WEB_SERVICE"
    exit 1
  fi
  sleep 2
done
echo "    '$WEB_SERVICE' is healthy."

# --------------------------------------------------------------------------
# 9. Post-restore data check
# --------------------------------------------------------------------------
# Health only proves the app boots. This change exists because image references can be lost
# silently, so report the counts that would show it.
echo "==> Post-rollback data check..."
for check in "products:image_url" "categories:image_url"; do
  table="${check%%:*}"
  column="${check##*:}"
  if count="$(docker compose exec -T "$DB_SERVICE" sh -lc \
      "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tAc \"SELECT count(*) FROM $table WHERE $column IS NOT NULL\"" 2>/dev/null)"; then
    echo "    $table with $column set: $(printf '%s' "$count" | tr -d '\r\n')"
  else
    echo "    Could not count $table.$column — check manually."
  fi
done

echo ""
echo "=========================================================================="
echo " Rollback completed."
echo "   Code:     $target_sha"
echo "   Database: restored from $(basename "$dump_file")"
echo "   Safety:   $safety_dump (state from before this rollback)"
echo ""
echo " Uploaded images/documents were NOT rolled back and have no backup."
echo " If image references point at missing files, that is why."
echo "=========================================================================="
