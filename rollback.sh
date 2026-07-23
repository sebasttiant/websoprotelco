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
#   REVIERTE, de forma conjunta:
#     - el codigo (git reset --hard al SHA del ultimo deploy exitoso);
#     - la base de datos completa (se elimina y se recrea desde el dump);
#     - las imagenes subidas (volumen `uploads-data` -> /app/public/uploads);
#     - los documentos subidos (volumen `documents-data` -> /app/public/documents).
#
#   Los tres van juntos a proposito: restaurar products.image_url / categories.image_url
#   sin restaurar los archivos deja la base "correcta" apuntando a imagenes que no
#   existen. Por eso este script aborta si el manifiesto no trae los tres snapshots.
#
#   NO REVIERTE:
#     - el tar de codigo/config de deploy.sh (paso 1), que es otra cosa;
#     - los datos y archivos cargados por operadores despues del despliegue: los
#       snapshots son anteriores a ellos y se pierden. Por eso este script toma un
#       backup de seguridad del estado ACTUAL (base + archivos) antes de destruir nada.
#
#   Se rechaza toda entrada que no traiga los tres snapshots: menos de 6 columnas,
#   o un "-" en base / uploads / documents. Restaurar solo una parte deja image_url
#   apuntando a archivos que no corresponden, que es justo lo que hay que evitar.
# ==========================================================================

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
BACKUP_DIR="$APP_DIR/backups"
MANIFEST="$BACKUP_DIR/rollback-manifest"
WEB_SERVICE="${WEB_SERVICE:-web}"
DB_SERVICE="${DB_SERVICE:-db}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"
MANIFEST_FILE="$MANIFEST"

# shellcheck source=deploy-lib.sh
. "$APP_DIR/deploy-lib.sh"

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
uploads_tar="$(printf '%s' "$entry" | cut -f5)"
documents_tar="$(printf '%s' "$entry" | cut -f6)"

if [ -z "$entry_date" ] || [ -z "$target_sha" ]; then
  echo "ERROR: last manifest entry is malformed:"
  echo "       $entry"
  exit 1
fi

# Entries written before the six-column format have no file columns at all.
entry_columns="$(printf '%s' "$entry" | awk -F'\t' '{print NF}')"
if [ "$entry_columns" -lt 6 ]; then
  echo "ERROR: manifest entry predates file backups (only ${entry_columns} columns)."
  echo "       Restoring the database from it would leave image_url pointing at files this"
  echo "       script cannot restore. Roll back by hand or use a newer entry."
  exit 1
fi

# A six-column entry can still carry "-" for a snapshot that was never taken. Counting columns
# is not the same as having the three snapshots: restoring the database while leaving uploads
# and documents at their current state produces exactly the mismatch this script exists to
# prevent, so the "-" is rejected rather than quietly skipped.
for column in "dump:$dump_file" "uploads:$uploads_tar" "documents:$documents_tar"; do
  if [ "${column##*:}" = "-" ]; then
    echo "ERROR: the last deploy recorded no ${column%%:*} snapshot (column is '-')."
    echo "       Rolling back only part of the state would leave the database and the files"
    echo "       out of step. Refusing. Inspect $MANIFEST and recover by hand."
    exit 1
  fi
done

echo "    Backup taken:  $entry_date"
echo "    Code target:   $target_sha"
echo "    Database:      ${dump_db:-<none>}"
echo "    Dump file:     ${dump_file:-<none>}"
echo "    Uploads:       ${uploads_tar:-<none>}"
echo "    Documents:     ${documents_tar:-<none>}"

# --------------------------------------------------------------------------
# 2. Validate everything before touching anything
# --------------------------------------------------------------------------
echo "==> Validating rollback target..."

if [ -n "$dump_file" ] && [ ! -f "$dump_file" ]; then
  echo "ERROR: dump file is missing: $dump_file"
  echo "       Aborting. Older entries exist in $MANIFEST but this script only"
  echo "       restores the most recent one; recover it by hand if you must."
  exit 1
fi

# Every archive is validated up front, before anything is destroyed. tar -tzf reads the whole
# stream, so a truncated or corrupt archive fails here rather than half-way through a restore.
for archive in "$uploads_tar" "$documents_tar"; do
  [ -n "$archive" ] || continue
  if [ ! -f "$archive" ]; then
    echo "ERROR: archive referenced by the manifest is missing: $archive"
    echo "       Refusing to restore the database without the files it points at."
    exit 1
  fi
  if ! tar -tzf "$archive" >/dev/null 2>&1; then
    echo "ERROR: archive failed validation (tar -tzf): $archive"
    echo "       Refusing to destroy live files for a backup that cannot be restored."
    exit 1
  fi
  echo "    Archive validated: $(basename "$archive") ($(tar -tzf "$archive" | grep -cv '/$' || true) file(s))"
done

if ! git cat-file -e "${target_sha}^{commit}" 2>/dev/null; then
  echo "ERROR: commit $target_sha is not in this repository."
  echo "       Try 'git fetch --all' first. Aborting without changes."
  exit 1
fi

# Files are restored into the volumes the CURRENT compose.yaml declares, but step 7 resets the
# code to $target_sha and step 8 rebuilds from ITS compose.yaml. If the target predates
# documents-data, web would come back up with no documents mount: the restored files would sit
# in a volume the app cannot see, while this script reported "documents restored". Refuse
# rather than silently undo our own restore.
for required_mount in "uploads-data:/app/public/uploads" "documents-data:/app/public/documents"; do
  # Anchored on the mount line itself via commit_mounts_volume. An unanchored grep for the
  # volume name also matches compose.yaml's own explanatory comment, so a commit that dropped
  # the volume but kept the comment would pass the check meant to catch exactly that.
  if ! commit_mounts_volume "$target_sha" "$required_mount"; then
    echo "ERROR: the rollback target $target_sha does not mount '$required_mount' in compose.yaml."
    echo "       Rolling back to it would unmount that volume and hide the files this script"
    echo "       is about to restore, while reporting success. Refusing."
    echo "       That commit predates persistent file storage: roll back by hand, and keep"
    echo "       the archives from $MANIFEST safe while you do."
    exit 1
  fi
done

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

 Files:     /app/public/uploads   <- $(basename "${uploads_tar:-<none>}")
            /app/public/documents <- $(basename "${documents_tar:-<none>}")
            Current contents are REPLACED, not merged.

 Everything created after $entry_date will be LOST: database rows AND
 uploaded files. A safety backup of the CURRENT database and files is
 taken first, and its location is printed before anything is destroyed.
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
safety_stamp="$(date +%Y%m%d-%H%M%S)"
safety_dump="$BACKUP_DIR/pre-rollback-${dump_db}-${safety_stamp}.dump"
safety_uploads="$BACKUP_DIR/pre-rollback-uploads-${safety_stamp}.tar.gz"
safety_documents="$BACKUP_DIR/pre-rollback-documents-${safety_stamp}.tar.gz"

# Every recovery message in this script points the operator at these files, so an interrupted
# run must not leave a truncated one lying around looking usable.
cleanup_safety_partials() {
  rm -f "${safety_dump}.partial" "${safety_uploads}.partial" "${safety_documents}.partial"
}
trap cleanup_safety_partials INT TERM

echo "==> Taking a safety dump of the current database..."
if ! docker compose exec -T "$DB_SERVICE" sh -lc \
      'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > "${safety_dump}.partial"; then
  rm -f "${safety_dump}.partial"
  echo "ERROR: could not dump the current database. Aborting BEFORE destroying anything."
  echo "       '$WEB_SERVICE' is stopped; restart it with:"
  echo "         docker compose start $WEB_SERVICE"
  exit 1
fi

# Validated the same way deploy.sh validates its dumps. This file is the only way back from a
# mistaken rollback; trusting pg_dump's exit code alone would mean discovering it is truncated
# at the worst possible moment.
if ! docker compose exec -T "$DB_SERVICE" pg_restore --list < "${safety_dump}.partial" >/dev/null 2>&1; then
  rm -f "${safety_dump}.partial"
  echo "ERROR: the safety dump is unreadable. Aborting BEFORE destroying anything."
  echo "       '$WEB_SERVICE' is stopped; restart it with:"
  echo "         docker compose start $WEB_SERVICE"
  exit 1
fi
mv "${safety_dump}.partial" "$safety_dump"
echo "    Safety dump: $safety_dump"

# `docker compose run --rm` rather than `exec`: web is already stopped, and run mounts the
# same volumes the service declares, so the files are reachable without bringing it back up.
# --no-deps keeps this from starting db/migrate as a side effect.
archive_current_files() {
  local container_path="$1" out_file="$2" label="$3"
  local partial="${out_file}.partial"

  if ! docker compose run --rm --no-deps -T --entrypoint sh "$WEB_SERVICE" \
        -c "tar -czf - -C '$container_path' ." > "$partial" 2>/dev/null; then
    rm -f "$partial"
    echo "ERROR: could not archive current $label. Aborting BEFORE destroying anything."
    echo "       '$WEB_SERVICE' is stopped; restart it with:"
    echo "         docker compose start $WEB_SERVICE"
    exit 1
  fi
  if ! tar -tzf "$partial" >/dev/null 2>&1; then
    rm -f "$partial"
    echo "ERROR: safety archive of $label failed validation. Aborting BEFORE destroying anything."
    exit 1
  fi
  mv "$partial" "$out_file"
  echo "    Safety $label: $out_file"
}

echo "==> Archiving current files before they are replaced..."
archive_current_files "/app/public/uploads" "$safety_uploads" "uploads"
archive_current_files "/app/public/documents" "$safety_documents" "documents"

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
      target_db="$1"
      psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 \
        -v dbname="$target_db" \
        -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = :'"'"'dbname'"'"' AND pid <> pg_backend_pid();" >/dev/null
      dropdb -U "$POSTGRES_USER" --if-exists "$target_db"
      createdb -U "$POSTGRES_USER" -O "$POSTGRES_USER" "$target_db"
    ' sh "$dump_db"; then
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
# 6.5 Restore files
# --------------------------------------------------------------------------
# Right after the database and before the rebuild, so code, rows and files land at the same
# point in time. Contents are REPLACED, not merged: a file uploaded after the snapshot has no
# row pointing at it once the database is back, and leaving it would only accumulate orphans.
restore_files() {
  local container_path="$1" archive="$2" label="$3" safety="$4" expected actual

  echo "==> Restoring $label..."
  # `find -mindepth 1 -delete` rather than `rm -rf dir/* dir/.[!.]*`: the glob form misses
  # entries beginning with two dots, which would survive as orphans and inflate the count
  # check below. `&&` rather than `;` so a failed wipe cannot be masked by tar's exit code,
  # silently degrading replace-not-merge into merge.
  if ! docker compose run --rm --no-deps -T --entrypoint sh "$WEB_SERVICE" \
        -c "find '$container_path' -mindepth 1 -delete && tar -xzf - -C '$container_path'" \
        < "$archive"; then
    echo ""
    echo "ERROR: could not restore $label. The database IS already rolled back."
    echo "       $label may be partially replaced. To return to the pre-rollback state:"
    echo "         git reset --hard $current_sha"
    echo "         docker compose exec -T $DB_SERVICE sh -lc 'pg_restore -U \$POSTGRES_USER -d \$POSTGRES_DB --single-transaction --no-owner' < $safety_dump"
    echo "         docker compose run --rm --no-deps -T --entrypoint sh $WEB_SERVICE -c 'tar -xzf - -C $container_path' < $safety"
    echo "         docker compose up -d --build $WEB_SERVICE"
    exit 1
  fi

  # tar's exit code does not prove the bytes landed. Count them, counting the same class of
  # object on both sides: `tar -tzf` lists symlinks, `find -type f` does not.
  expected="$(tar -tzf "$archive" | grep -cv '/$' || true)"
  if ! actual="$(docker compose run --rm --no-deps -T --entrypoint sh "$WEB_SERVICE" \
        -c "find '$container_path' -mindepth 1 ! -type d | wc -l" 2>/dev/null)"; then
    echo "ERROR: $label restored but could not be verified."
    echo "       Pre-rollback copy kept at: $safety"
    exit 1
  fi
  actual="$(printf '%s' "$actual" | tr -d '\r\n ')"

  # An empty value would make `[ "$a" -ne "$b" ]` exit 2, which `if` reads as false — the
  # check that proves the restore worked would pass silently.
  case "$expected$actual" in
    ''|*[!0-9]*)
      echo "ERROR: could not count $label reliably (archive='$expected', volume='$actual')."
      echo "       Pre-rollback copy kept at: $safety"
      exit 1
      ;;
  esac

  if [ "$expected" -ne "$actual" ]; then
    echo "ERROR: $label restore incomplete — archive holds ${expected} file(s), volume has ${actual}."
    echo "       Pre-rollback copy kept at: $safety"
    exit 1
  fi
  echo "    $label restored: ${actual} file(s)."
}

restore_files "/app/public/uploads" "$uploads_tar" "uploads" "$safety_uploads"
restore_files "/app/public/documents" "$documents_tar" "documents" "$safety_documents"

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
echo "   Code:      $target_sha"
echo "   Database:  restored from $(basename "$dump_file")"
echo "   Uploads:   restored from $(basename "${uploads_tar:-<none>}")"
echo "   Documents: restored from $(basename "${documents_tar:-<none>}")"
echo ""
echo " Pre-rollback state kept at:"
echo "   $safety_dump"
echo "   $safety_uploads"
echo "   $safety_documents"
echo "=========================================================================="
