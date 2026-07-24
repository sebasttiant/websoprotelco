#!/usr/bin/env bash
set -Eeuo pipefail

# ==========================================================================
# SOPROTELCO — deploy en VPS
#
# Flujo: backup → pull → build → db up → migrate → crear admin → web up → verify
#
# IMPORTANTE: este script NUNCA corre el seed de desarrollo. db/seeds/001-users.ts
# tiene credenciales commiteadas en un repositorio público; sembrarlas en un
# servidor equivale a publicar el login de administrador. El admin se crea desde
# ADMIN_EMAIL y ADMIN_PASSWORD, que viven solo en el .env del servidor.
#
# Poné NODE_ENV=production en el .env del servidor: el seed de desarrollo se
# niega a correr con esa variable, así que ni siquiera a mano se puede sembrar.
#
# El contenedor `web` es Next.js standalone y NO incluye tsx ni migraciones.
#
# Acceso final:  http://<ip-vps>:8686
# ==========================================================================

# APP_DIR se autodetecta desde la ubicación del script.
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
BACKUP_DIR="$APP_DIR/backups"
LAST_DEPLOYED_SHA_FILE="$BACKUP_DIR/last-deployed-sha"
MANIFEST_FILE="$BACKUP_DIR/rollback-manifest"
MANUAL_DOCUMENTS_RUNBOOK="docs/operations/legacy-documents-migration.md"
BRANCH="${BRANCH:-main}"
WEB_SERVICE="${WEB_SERVICE:-web}"
DB_SERVICE="${DB_SERVICE:-db}"
MIGRATE_SERVICE="${MIGRATE_SERVICE:-migrate}"
SEED_SERVICE="${SEED_SERVICE:-seed}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"
# Endpoint verification retries. A single-shot probe races the Next.js boot, so an endpoint
# that is merely not listening YET is indistinguishable from one that is broken.
ENDPOINT_RETRIES="${ENDPOINT_RETRIES:-24}"
ENDPOINT_RETRY_DELAY="${ENDPOINT_RETRY_DELAY:-5}"

# Shared with rollback.sh, and exercised directly by tests/deploy/ with a stub docker on PATH.
# These helpers decide whether user files live or die, so they must be testable off the VPS.
# shellcheck source=deploy-lib.sh
. "$APP_DIR/deploy-lib.sh"

cd "$APP_DIR"

# --------------------------------------------------------------------------
# 1. Backup
# --------------------------------------------------------------------------
mkdir -p "$BACKUP_DIR"

# Serialize deploys and rollbacks against each other. Without this, two concurrent runs
# interleave `git pull`, image builds and manifest appends; worse, a deploy racing a rollback
# means `git reset --hard` against `git pull` and pg_restore against a migration.
exec 9>"$BACKUP_DIR/.deploy.lock"
if ! flock -n 9; then
  echo "ERROR: another deploy or rollback is running (lock: $BACKUP_DIR/.deploy.lock)."
  exit 1
fi

echo "==> Creating backup..."
BACKUP_FILE="$BACKUP_DIR/soprotelco-before-deploy-$(date +%Y%m%d-%H%M%S).tar.gz"
tar --exclude='./backups' \
    --exclude='./node_modules' \
    --exclude='./.next' \
    --exclude='./.git' \
    --exclude='./pgdata' \
    -czf "$BACKUP_FILE" .
echo "    Backup created: $BACKUP_FILE"

# --------------------------------------------------------------------------
# 2. Pull latest code
# --------------------------------------------------------------------------
echo "==> Updating code (branch: $BRANCH)..."
# The rollback target is the last commit that DEPLOYED SUCCESSFULLY, recorded at the end of
# this script — not `git rev-parse HEAD`. They differ in the case that matters: if a deploy
# fails at the migration step, the tree is already pulled to the new commit but the running
# containers are still the old one. On a re-run HEAD would report the broken commit as the
# rollback target, so rolling back would "restore" the very code that broke.
if [ -f "$LAST_DEPLOYED_SHA_FILE" ]; then
  PRE_DEPLOY_SHA="$(cat "$LAST_DEPLOYED_SHA_FILE")"
  echo "    Last successful deploy (rollback target): $PRE_DEPLOY_SHA"
else
  PRE_DEPLOY_SHA="$(git rev-parse HEAD)"
  echo "    No previous deploy recorded; using current commit as rollback target: $PRE_DEPLOY_SHA"
fi
git fetch origin "$BRANCH"
git pull --ff-only origin "$BRANCH"

# --------------------------------------------------------------------------
# 3. Verify .env
# --------------------------------------------------------------------------
echo "==> Verifying .env..."
# On a first deploy there is no .env yet. Rather than only erroring, scaffold one with the
# correct keys and safe non-secret defaults, then stop so the operator fills in the secrets.
# The scaffold carries CHANGE_ME placeholders and NO real credentials: .env is gitignored and
# must never be committed. Port 8686 is both the host and the container port.
if [ ! -f "$APP_DIR/.env" ]; then
  cat > "$APP_DIR/.env" <<'ENV_SCAFFOLD'
# SOPROTELCO production environment.
# Replace every CHANGE_ME value, then re-run ./deploy.sh. This file is gitignored:
# never commit it. Keep POSTGRES_PASSWORD identical in DATABASE_URL.

WEB_PORT=8686
WEB_HOST=0.0.0.0

# Storage: local disk (fails closed if unset). Do not leave blank.
STORAGE_PROVIDER=local

# Session cookie security. Leave commented for HTTPS (Cloudflare/reverse proxy) — the safe
# default. Uncomment ONLY to log in over plain HTTP (http://<ip>:8686) before TLS is set up;
# re-comment it once HTTPS is in front.
# NOTE: uncommented by default so the first deploy over HTTP works without bucle infinito.
SESSION_COOKIE_SECURE=false

# Database.
POSTGRES_DB=websoprotelco
POSTGRES_USER=local_dev_user
POSTGRES_PASSWORD=CHANGE_ME
DATABASE_URL=postgresql://local_dev_user:CHANGE_ME@db:5432/websoprotelco
DATABASE_SSL=disable

# First super-admin, created automatically by this script on deploy.
ADMIN_EMAIL=CHANGE_ME
ADMIN_PASSWORD=CHANGE_ME
ENV_SCAFFOLD
  echo "    Created $APP_DIR/.env from a template."
  echo "    Fill in every CHANGE_ME value (POSTGRES_PASSWORD, DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD),"
  echo "    then run ./deploy.sh again."
  exit 1
fi

# Fail fast on missing OR still-placeholder critical variables. ADMIN_* are required because
# this script creates the administrator from them: the dev seed's credentials are committed to
# a public repo and must never provision a real server.
required_vars=(POSTGRES_PASSWORD DATABASE_URL ADMIN_EMAIL ADMIN_PASSWORD STORAGE_PROVIDER)
for var in "${required_vars[@]}"; do
  value="$(grep -E "^${var}=" "$APP_DIR/.env" | head -1 | cut -d= -f2-)"
  if [ -z "$value" ]; then
    echo "ERROR: $var not set in .env"
    exit 1
  fi
  case "$value" in
    *CHANGE_ME*)
      echo "ERROR: $var still holds the CHANGE_ME placeholder in .env. Set a real value first."
      exit 1
      ;;
  esac
done
echo "    .env OK"

# --------------------------------------------------------------------------
# 3.3 Legacy documents preflight
# --------------------------------------------------------------------------
# This must run before build/recreate. If documents still live only in the current container's
# writable layer, `docker compose up --build` can destroy them. Migration is intentionally
# manual: this script never restores an old documents archive or infers intent from an empty
# volume.
echo "==> Checking legacy documents storage..."
if ! preflight_web_state="$(web_container_state "$WEB_SERVICE")"; then
  echo "ERROR: could not query '$WEB_SERVICE'. Deploy aborted before build/recreate."
  exit 1
fi
echo "    '$WEB_SERVICE' container state: $preflight_web_state"

preflight_manifest_nonempty=0
[ -s "$MANIFEST_FILE" ] && preflight_manifest_nonempty=1

if [ "$preflight_web_state" != "absent" ]; then
  preflight_web_id="$(web_container_id "$WEB_SERVICE")"
  if ! container_has_mount "$preflight_web_id" /app/public/documents; then
    case "$preflight_web_state" in
      running)
        if ! preflight_documents_status="$(docker compose exec -T "$WEB_SERVICE" sh -lc '
            if [ ! -d /app/public/documents ]; then echo absent;
            elif find /app/public/documents -mindepth 1 ! -type d | read _; then echo present;
            else echo empty; fi' 2>&1)"; then
          echo "ERROR: could not inspect legacy /app/public/documents in '$WEB_SERVICE'."
          echo "       Deploy aborted before build/recreate. Follow: $MANUAL_DOCUMENTS_RUNBOOK"
          echo "       docker said: $preflight_documents_status"
          exit 1
        fi
        preflight_documents_status="$(printf '%s' "$preflight_documents_status" | tr -d '\r\n')"
        if [ "$preflight_documents_status" = "present" ]; then
          echo "ERROR: legacy documents still live only in the '$WEB_SERVICE' container writable layer."
          echo "       Deploy aborted before build/recreate so those files are not destroyed."
          echo "       Run the manual one-time migration with the web service intentionally stopped:"
          echo "         $MANUAL_DOCUMENTS_RUNBOOK"
          exit 1
        fi
        if [ "$preflight_documents_status" != "empty" ] && [ "$preflight_documents_status" != "absent" ]; then
          echo "ERROR: unexpected legacy documents probe result: $preflight_documents_status"
          echo "       Deploy aborted before build/recreate. Follow: $MANUAL_DOCUMENTS_RUNBOOK"
          exit 1
        fi
        echo "    Legacy documents directory is $preflight_documents_status; no automatic migration will run."
        ;;
      stopped)
        echo "ERROR: '$WEB_SERVICE' is stopped and still lacks the documents-data mount."
        echo "       Deploy aborted before build/recreate because legacy documents cannot be proven"
        echo "       safe or absent while the container is stopped. Follow: $MANUAL_DOCUMENTS_RUNBOOK"
        exit 1
        ;;
    esac
  fi
elif [ "$preflight_manifest_nonempty" -eq 1 ]; then
  echo "ERROR: '$WEB_SERVICE' no longer exists on a host that has previous deploy backups."
  echo "       Deploy aborted before build/recreate because legacy writable-layer documents"
  echo "       cannot be proven safe or absent. Follow: $MANUAL_DOCUMENTS_RUNBOOK"
  exit 1
fi

# --------------------------------------------------------------------------
# 3.4 Backup retention
# --------------------------------------------------------------------------
# Runs BEFORE anything is written: the point of retention is to keep the disk from filling,
# and a full disk is exactly what makes tar and pg_dump produce truncated files. Pruning
# afterwards would never run on the very failure it exists to prevent.
#
# Never prunes a file still referenced by the manifest, so retention cannot delete a snapshot
# that rollback.sh depends on. This run's own files are always the newest, so they survive.
BACKUP_RETENTION="${BACKUP_RETENTION:-10}"
case "$BACKUP_RETENTION" in
  ''|*[!0-9]*)
    echo "ERROR: BACKUP_RETENTION must be a non-negative integer (got '$BACKUP_RETENTION')."
    exit 1
    ;;
esac
if [ "$BACKUP_RETENTION" -lt 1 ]; then
  echo "ERROR: BACKUP_RETENTION must keep at least 1 backup (got '$BACKUP_RETENTION')."
  exit 1
fi

# manifest_referenced_files and prune_backups live in deploy-lib.sh so tests/deploy/ can
# exercise the selection logic against a fixture directory.
echo "==> Pruning old backups (keeping $BACKUP_RETENTION)..."
# Each family is pruned separately so one kind cannot starve another. The pre-rollback-*
# families are rollback.sh's safety copies: they must be bounded too, and they must be bounded
# TOGETHER — pruning the safety dump while keeping its matching file archives would leave the
# operator with files and no database to match them.
prune_backups 'db-*.dump'
prune_backups 'db-*.dump.partial'
prune_backups 'uploads-*.tar.gz'
prune_backups 'uploads-*.tar.gz.partial'
prune_backups 'documents-*.tar.gz'
prune_backups 'documents-*.tar.gz.partial'
prune_backups 'pre-rollback-*.dump'
prune_backups 'pre-rollback-uploads-*.tar.gz'
prune_backups 'pre-rollback-documents-*.tar.gz'
prune_backups 'pre-rollback-*.partial'
prune_backups 'soprotelco-before-deploy-*.tar.gz'

# --------------------------------------------------------------------------
# 4. Build images
# --------------------------------------------------------------------------
echo "==> Building Docker images..."
docker compose build "$WEB_SERVICE" "$MIGRATE_SERVICE" "$SEED_SERVICE"

# --------------------------------------------------------------------------
# 5. Start database
# --------------------------------------------------------------------------
echo "==> Starting database..."
docker compose up -d "$DB_SERVICE"

echo "==> Waiting for database to be ready..."
deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
until db_status="$(docker compose ps -q "$DB_SERVICE" | xargs -r docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>/dev/null)"; [ "$db_status" = "healthy" ] || [ "$db_status" = "running" ]; do
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "ERROR: '$DB_SERVICE' did not become healthy (status: ${db_status:-unknown}). Last logs:"
    docker compose logs --tail=80 "$DB_SERVICE"
    exit 1
  fi
  sleep 2
done
echo "    '$DB_SERVICE' is $db_status"

# --------------------------------------------------------------------------
# 5.6 Database backup
# --------------------------------------------------------------------------
# Placed here on purpose: the database is healthy (so pg_dump can connect) and no migration
# has run yet (so the dump is the last known-good state). The tar backup in step 1 excludes
# ./pgdata and is NOT a database backup; this is.
#
# POSTGRES_USER/POSTGRES_DB are read inside the container rather than parsed from .env: the
# container is the authority on the credentials actually in use, and .env is never sourced.
#
# Note on style: every capture below uses `if ! var="$(...)"` rather than a bare assignment.
# Under `set -Eeuo pipefail` a failing command substitution aborts the script AT the
# assignment, which would make the error messages here unreachable and leave the operator
# with a bare non-zero exit and no diagnosis.
echo "==> Backing up database..."
db_backup_recorded=""
database_exists=0

if ! backup_db_name="$(docker compose exec -T "$DB_SERVICE" printenv POSTGRES_DB 2>/dev/null)"; then
  echo "ERROR: could not read POSTGRES_DB from '$DB_SERVICE'. Refusing to migrate without a backup."
  exit 1
fi
backup_db_name="$(printf '%s' "$backup_db_name" | tr -d '\r\n')"
if [ -z "$backup_db_name" ]; then
  echo "ERROR: POSTGRES_DB is empty in '$DB_SERVICE'. Refusing to migrate without a backup."
  exit 1
fi

# Listing databases from the 'postgres' maintenance database separates two very different
# situations: a first deploy (server up, our database not created yet) from a broken server
# (cannot list at all). Only the first is safe to continue past.
if ! db_list="$(docker compose exec -T "$DB_SERVICE" sh -lc \
      'psql -U "$POSTGRES_USER" -d postgres -lqtA -F"|"' 2>&1)"; then
  echo "ERROR: database server is up but will not answer queries. Refusing to migrate without a backup."
  echo "       psql said: $db_list"
  exit 1
fi

if ! printf '%s\n' "$db_list" | cut -d'|' -f1 | grep -Fxq "$backup_db_name"; then
  echo "    Database '$backup_db_name' does not exist yet — first deploy, nothing to back up."
  echo "    Continuing; migrations will create it."
else
  database_exists=1
  db_backup_stamp="$(date +%Y%m%d-%H%M%S)"
  db_backup_file="$BACKUP_DIR/db-${backup_db_name}-${db_backup_stamp}.dump"
  db_backup_partial="${db_backup_file}.partial"

  # Written to .partial first and renamed only once verified. An interrupted or rejected dump
  # therefore never occupies a `db-*.dump` retention slot, and rollback.sh (which globs the
  # manifest, not the directory) can never be pointed at an unverified file.
  cleanup_partial() { rm -f "$db_backup_partial"; }
  trap cleanup_partial EXIT INT TERM

  if ! docker compose exec -T "$DB_SERVICE" sh -lc \
        'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > "$db_backup_partial"; then
    echo "ERROR: pg_dump failed. Partial file removed. Deploy aborted before any migration."
    exit 1
  fi

  # Validation runs INSIDE the container: the VPS host is not assumed to have client tools.
  # pg_restore --list parses the archive TOC, so a truncated or corrupt dump fails here.
  # stderr is captured rather than discarded so an infrastructure failure (docker exec) is not
  # reported to the operator as a corrupt backup.
  if ! backup_toc="$(docker compose exec -T "$DB_SERVICE" pg_restore --list < "$db_backup_partial" 2>&1)"; then
    echo "ERROR: could not validate the backup just taken. Deploy aborted."
    echo "       pg_restore said: $backup_toc"
    echo "       If that is a docker/exec error the dump may be fine; if it mentions the archive"
    echo "       format or an unexpected end of file, the dump is truncated."
    exit 1
  fi

  # Readability alone does not prove completeness: a dump can parse yet be missing tables.
  # Compare TABLE DATA entries against the live table list. pg_dump emits a TABLE DATA entry
  # for every table including empty ones, so these counts must match. Both sides are scoped to
  # the public schema so a future extension-owned table cannot fail a perfectly good dump.
  toc_tables="$(printf '%s\n' "$backup_toc" | grep -c 'TABLE DATA public ' || true)"
  if ! live_tables="$(docker compose exec -T "$DB_SERVICE" sh -lc \
        'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema = '"'"'public'"'"' AND table_type = '"'"'BASE TABLE'"'"'"' 2>&1)"; then
    echo "ERROR: backup taken but the live table count could not be read, so completeness is unproven."
    echo "       psql said: $live_tables"
    exit 1
  fi
  live_tables="$(printf '%s' "$live_tables" | tr -d '\r\n')"

  if [ -z "$live_tables" ] || [ "$toc_tables" -ne "$live_tables" ]; then
    echo "ERROR: backup covers ${toc_tables} table(s) but the database has ${live_tables:-unknown}."
    echo "       The dump is incomplete. Deploy aborted before any migration."
    exit 1
  fi

  mv "$db_backup_partial" "$db_backup_file"
  trap - EXIT INT TERM
  db_backup_recorded="$db_backup_file"
  echo "    Backup verified: $db_backup_file (${toc_tables} tables)"
fi

# --------------------------------------------------------------------------
# 5.65 File backups (uploads and documents)
# --------------------------------------------------------------------------
# Placed immediately after the database dump and before the first destructive step. Two reasons
# it is here rather than earlier:
#   - the container is only RECREATED at step 8, so nothing before that destroys the files;
#   - anything between the dump and these archives is a window where a file can be uploaded,
#     get a row in the dump, and be missing from the archive. A later replace-not-merge restore
#     would then delete it and leave image_url pointing at nothing.
# `docker compose build` used to sit in that window and could take minutes on a live site.
#
# Restoring products.image_url without these bytes leaves the database correct and pointing at
# images that are gone. The database dump alone is not a backup of this application.
file_backup_uploads=""
file_backup_documents=""
documents_are_legacy=0
legacy_documents_status="not-legacy"

# Reads a path from the live container. Distinguishes "directory absent" (safe to skip) from
# "exec failed" (NOT safe: the files may exist and a rebuild is about to destroy them); a bare
# `test -d` cannot tell those apart because both just exit non-zero.
archive_from_running() {
  local label="$1" container_path="$2" out_file="$3"
  local partial="${out_file}.partial" probe rc

  if ! probe="$(docker compose exec -T "$WEB_SERVICE" sh -lc \
        "if [ -d '$container_path' ]; then echo PRESENT; else echo ABSENT; fi" 2>&1)"; then
    echo "ERROR: could not inspect '$container_path' in '$WEB_SERVICE'. Deploy aborted before any change."
    echo "       docker said: $probe"
    exit 1
  fi
  case "$probe" in
    *PRESENT*) ;;
    *ABSENT*)
      echo "    No '$container_path' in the container — nothing to back up for $label."
      return 1
      ;;
    *)
      echo "ERROR: unexpected probe result for '$container_path': $probe"
      exit 1
      ;;
  esac

  # tar exits 1 for "file changed as we read it", routine when archiving a directory a live
  # site is writing to. Only >= 2 is fatal; the archive is validated below either way.
  set +e
  docker compose exec -T "$WEB_SERVICE" sh -lc "tar -czf - -C '$container_path' ." \
    > "$partial" 2>"${partial}.err"
  rc=$?
  set -e
  finish_archive "$label" "$out_file" "$rc"
}

# Reads a path from the VOLUMES without a running container. `run --rm` mounts what the service
# declares, so this covers a stopped or removed container as long as the data is in a volume.
archive_from_volumes() {
  local label="$1" container_path="$2" out_file="$3"
  local partial="${out_file}.partial" rc

  set +e
  docker compose run --rm --no-deps -T --entrypoint sh "$WEB_SERVICE" \
    -c "tar -czf - -C '$container_path' ." > "$partial" 2>"${partial}.err"
  rc=$?
  set -e
  finish_archive "$label" "$out_file" "$rc"
}

finish_archive() {
  local label="$1" out_file="$2" rc="$3"
  local partial="${out_file}.partial"

  if [ "$rc" -ge 2 ]; then
    echo "ERROR: could not archive $label. Deploy aborted before any change."
    echo "       tar said: $(head -3 "${partial}.err" 2>/dev/null)"
    rm -f "$partial" "${partial}.err"
    exit 1
  fi
  [ "$rc" -eq 1 ] && echo "    Note: files changed while archiving $label (site is live); archive still validated."
  rm -f "${partial}.err"

  # An empty directory still produces a valid archive; that is fine and must not abort.
  if ! tar -tzf "$partial" >/dev/null 2>&1; then
    rm -f "$partial"
    echo "ERROR: $label archive failed validation (tar -tzf). Deploy aborted before any change."
    exit 1
  fi
  mv "$partial" "$out_file"
  echo "    $label backup verified: $out_file ($(archive_entry_count "$out_file") file(s))"
  return 0
}

echo "==> Backing up uploaded files..."
if ! web_state="$(web_container_state "$WEB_SERVICE")"; then
  echo "ERROR: could not query '$WEB_SERVICE'. Deploy aborted before any change."
  exit 1
fi
echo "    '$WEB_SERVICE' container state: $web_state"

# Whether documents are already on a volume decides everything below: if they are, a rebuild is
# harmless and they are reachable without a running container. If they are not, they sit on the
# container's writable layer and step 8 destroys them. Answered by docker inspect, not assumed.
web_id=""
if [ "$web_state" != "absent" ]; then
  web_id="$(web_container_id "$WEB_SERVICE")"
  if ! container_has_mount "$web_id" /app/public/documents; then
    documents_are_legacy=1
    legacy_documents_status="unknown"
    if [ "$web_state" = "running" ]; then
      if ! legacy_documents_status="$(docker compose exec -T "$WEB_SERVICE" sh -lc '
          if [ ! -d /app/public/documents ]; then echo absent;
          elif find /app/public/documents -mindepth 1 ! -type d | read _; then echo present;
          else echo empty; fi' 2>&1)"; then
        echo "ERROR: could not inspect legacy /app/public/documents in '$WEB_SERVICE'."
        echo "       Deploy aborted before build/recreate. Follow: $MANUAL_DOCUMENTS_RUNBOOK"
        echo "       docker said: $legacy_documents_status"
        exit 1
      fi
      legacy_documents_status="$(printf '%s' "$legacy_documents_status" | tr -d '\r\n')"
      if [ "$legacy_documents_status" = "present" ]; then
        echo "ERROR: legacy documents still live only in the '$WEB_SERVICE' container writable layer."
        echo "       Deploy aborted before build/recreate so those files are not destroyed."
        echo "       Run the manual one-time migration with the web service intentionally stopped:"
        echo "         $MANUAL_DOCUMENTS_RUNBOOK"
        exit 1
      fi
      if [ "$legacy_documents_status" != "empty" ] && [ "$legacy_documents_status" != "absent" ]; then
        echo "ERROR: unexpected legacy documents probe result: $legacy_documents_status"
        echo "       Deploy aborted before build/recreate. Follow: $MANUAL_DOCUMENTS_RUNBOOK"
        exit 1
      fi
      echo "    Legacy documents directory is $legacy_documents_status; no automatic migration will run."
    fi
  fi
fi

manifest_nonempty=0
[ -s "$MANIFEST_FILE" ] && manifest_nonempty=1

file_stamp="$(date +%Y%m%d-%H%M%S)"
candidate_uploads="$BACKUP_DIR/uploads-${file_stamp}.tar.gz"
candidate_documents="$BACKUP_DIR/documents-${file_stamp}.tar.gz"
cleanup_file_partials() {
  rm -f "${candidate_uploads}.partial" "${candidate_uploads}.partial.err" \
        "${candidate_documents}.partial" "${candidate_documents}.partial.err"
}
trap cleanup_file_partials EXIT INT TERM

case "$(file_backup_plan "$web_state" "$documents_are_legacy" "$manifest_nonempty")" in
  archive_running)
    archive_from_running "uploads" "/app/public/uploads" "$candidate_uploads" \
      && file_backup_uploads="$candidate_uploads"
    archive_from_running "documents" "/app/public/documents" "$candidate_documents" \
      && file_backup_documents="$candidate_documents"
    ;;

  archive_volumes)
    echo "    Reading files from the volumes directly."
    archive_from_volumes "uploads" "/app/public/uploads" "$candidate_uploads" \
      && file_backup_uploads="$candidate_uploads"
    archive_from_volumes "documents" "/app/public/documents" "$candidate_documents" \
      && file_backup_documents="$candidate_documents"
    ;;

  abort_stopped_legacy)
    echo "ERROR: '$WEB_SERVICE' is stopped and still stores documents on its writable layer."
    echo "       Deploy aborted before build/recreate because the script cannot prove whether"
    echo "       legacy documents exist while the container is stopped. Follow the manual runbook:"
    echo "         $MANUAL_DOCUMENTS_RUNBOOK"
    exit 1
    ;;

  abort_legacy_unknown)
    echo "ERROR: '$WEB_SERVICE' no longer exists on a host that has previous deploy backups."
    echo "       Deploy aborted before build/recreate because legacy writable-layer documents"
    echo "       cannot be proven safe or absent. The script will not select an old archive"
    echo "       or infer safety from an empty volume. Follow the manual runbook:"
    echo "         $MANUAL_DOCUMENTS_RUNBOOK"
    exit 1
    ;;

  *)
    echo "ERROR: could not decide how to back up files (state='$web_state')."
    exit 1
    ;;
esac
trap - EXIT INT TERM

# --------------------------------------------------------------------------
# 5.7 Rollback manifest
# --------------------------------------------------------------------------
# One entry per deploy, tying the code that was live to ALL THREE snapshots taken from it.
# Written once, here, rather than next to each backup: a half-written entry would let
# rollback.sh restore a database without the files its image_url column points at.
#
# Tab-separated, six columns:
#   1 timestamp   2 last-deployed SHA   3 db dump    4 database name
#   5 uploads tar 6 documents tar
# Absent snapshots are recorded as "-" only for helper compatibility. deploy.sh never writes
# a partial rollback point: existing deployments require database + uploads + documents together.
existing_deployment=0
if [ -f "$LAST_DEPLOYED_SHA_FILE" ] || [ "$database_exists" -eq 1 ] || [ "$web_state" != "absent" ] || [ "$manifest_nonempty" -eq 1 ]; then
  existing_deployment=1
fi

if [ "$existing_deployment" -eq 1 ]; then
  if [ -z "$db_backup_recorded" ] || [ -z "$file_backup_uploads" ] || [ -z "$file_backup_documents" ]; then
    echo "ERROR: existing deployment requires a complete rollback snapshot."
    echo "       db='${db_backup_recorded:--}' uploads='${file_backup_uploads:--}' documents='${file_backup_documents:--}'"
    echo "       Empty directories are valid only as verified empty tar archives, never as '-'."
    echo "       Deploy aborted before migrations/recreate so rollback cannot be partial."
    exit 1
  fi

  manifest_append "$PRE_DEPLOY_SHA" "$db_backup_recorded" "$backup_db_name" \
    "$file_backup_uploads" "$file_backup_documents"
  echo "    Recorded rollback point in $MANIFEST_FILE"
else
  echo "    First deploy with no prior web/database state — no rollback point recorded."
fi

# --------------------------------------------------------------------------
# 6. Run migrations
# --------------------------------------------------------------------------
echo "==> Running database migrations..."
docker compose run --rm --no-deps "$MIGRATE_SERVICE"

# --------------------------------------------------------------------------
# 7. Create the administrator
# --------------------------------------------------------------------------
# NOT the dev seed. db/seeds/001-users.ts hardcodes credentials that are committed to a
# public repository, so running it here would publish a working admin login for this server.
# The account is created from ADMIN_EMAIL/ADMIN_PASSWORD, which exist only in this server's
# .env. The command is idempotent: it upserts, so re-deploying resets the password to the
# value in .env rather than failing.
echo "==> Creating administrator from .env..."
docker compose run --rm --no-deps "$SEED_SERVICE" pnpm db:create-admin

# --------------------------------------------------------------------------
# 8. Start web
# --------------------------------------------------------------------------
echo "==> Starting web server..."
# --force-recreate is what makes the health gate below trustworthy. Docker preserves a
# container's health status across a restart until the next probe fires, so a container that
# compose merely "Started" reports the PREVIOUS run's `healthy` for up to one full interval —
# the wait loop then passes instantly against a server that has not finished booting. A newly
# created container always starts at `starting`, so the loop actually waits.
docker compose up -d --no-deps --force-recreate "$WEB_SERVICE"

echo "==> Waiting for '$WEB_SERVICE' to become healthy (timeout ${HEALTH_TIMEOUT}s)..."
deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
until status="$(docker compose ps -q "$WEB_SERVICE" | xargs -r docker inspect -f '{{.State.Health.Status}}' 2>/dev/null)"; [ "$status" = "healthy" ]; do
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "ERROR: '$WEB_SERVICE' did not become healthy (status: ${status:-unknown}). Last logs:"
    docker compose logs --tail=80 "$WEB_SERVICE"
    exit 1
  fi
  sleep 3
done
echo "    '$WEB_SERVICE' is healthy."

# --------------------------------------------------------------------------
# ==========================================================================
# POST-DEPLOY VERIFICATION
# ==========================================================================

# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
db_query() {
  docker compose exec -T "$DB_SERVICE" sh -lc \
    "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tAc \"$1\"" 2>/dev/null
}

schema_ok=1
verification_ok=1

check_table() {
  local table="$1"
  local exists
  if ! exists="$(db_query "select to_regclass('public.$table') is not null;")"; then
    echo "    ⚠ Could not verify table '$table'."
    schema_ok=0
    verification_ok=0
    return
  fi
  if [ "$exists" = "t" ]; then
    echo "    ✓ Table '$table' present."
  else
    echo "    ⚠ Missing table '$table' — check migration step above."
    schema_ok=0
    verification_ok=0
  fi
}

probe_endpoint() {
  docker compose exec -T "$WEB_SERVICE" node -e \
    "fetch('http://127.0.0.1:8686$1',{redirect:'manual'}).then(r=>{console.log(r.status)}).catch((e)=>{console.log('no-response:'+e.message);process.exit(1)})"
}

# Retries until the endpoint answers with an HTTP status. Any numeric status ends the loop —
# a 500 is a real answer and must be reported as such, not retried into a timeout. Only the
# "did not answer at all" case is retried, because that is the one a slow boot produces.
check_endpoint() {
  local path="$1"
  local label="$2"
  local expected="$3"
  local http_status=""
  local attempt=1
  local last_output=""

  while :; do
    if http_status="$(probe_endpoint "$path" 2>/dev/null)"; then
      http_status="$(printf '%s' "$http_status" | tr -d '\r\n ')"
      case "$http_status" in
        ''|*[!0-9]*) ;;
        *) break ;;
      esac
    fi

    if [ "$attempt" -ge "$ENDPOINT_RETRIES" ]; then
      # Every retry exhausted: re-probe once WITHOUT discarding stderr, so the operator sees
      # the actual docker/fetch error instead of a bare "no-response".
      last_output="$(probe_endpoint "$path" 2>&1 || true)"
      echo "    ✗ $label never answered after $(( ENDPOINT_RETRIES * ENDPOINT_RETRY_DELAY ))s."
      echo "      Last probe output: ${last_output:-<empty>}"
      verification_ok=0
      return
    fi

    attempt=$(( attempt + 1 ))
    sleep "$ENDPOINT_RETRY_DELAY"
  done

  if [ "$attempt" -gt 1 ]; then
    echo "    (…$label answered on attempt $attempt)"
  fi

  case "$expected" in
    2xx)
      if [ "$http_status" -ge 200 ] && [ "$http_status" -le 299 ]; then
        echo "    ✓ $label responds with expected HTTP $http_status ($expected)."
      else
        echo "    ✗ $label returned HTTP $http_status; expected $expected."
        verification_ok=0
      fi
      ;;
    *)
      echo "    ✗ Unsupported endpoint expectation '$expected' for $label."
      verification_ok=0
      ;;
  esac
}

# --------------------------------------------------------------------------
# Schema verification — all 13 tables across 10 migrations
# --------------------------------------------------------------------------
echo "==> Post-deploy: verifying database schema..."
if ! db_query "select 1;" >/dev/null; then
  echo "    (schema verification skipped — cannot query database; '$WEB_SERVICE' is healthy)"
  verification_ok=0
else
  # 0001 — initial schema
  check_table "users"
  check_table "categories"
  check_table "products"
  check_table "quote_requests"
  check_table "quote_request_items"
  # 0002 — sessions
  check_table "sessions"
  # 0006 — settings domain
  check_table "settings"
  # 0007 — leads domain
  check_table "leads"
  check_table "lead_notes"
  # 0008 — inventory domain
  check_table "stock_movements"
  # 0009 — documents domain
  check_table "documents"
  # 0010 — design domain
  check_table "banners"
  check_table "hero_settings"

  if [ "$schema_ok" -eq 1 ]; then
    echo "    ✓ All 13 tables present."
  else
    echo "    ✗ Schema incomplete. Deploy will not be marked successful."
  fi
fi

# --------------------------------------------------------------------------
# Endpoint verification
# --------------------------------------------------------------------------
echo "==> Post-deploy: verifying critical endpoints..."

# /api/health?check=db — verifies DB connectivity from the app layer
check_endpoint "/api/health?check=db" "/api/health (with DB check)" "2xx"

# /api/health?check=storage — builds the configured storage adapter, so an invalid
# STORAGE_PROVIDER fails here instead of on the first customer upload.
check_endpoint "/api/health?check=storage" "/api/health (with storage check)" "2xx"

# /login — public page, should render without errors
check_endpoint "/login" "/login (public storefront)" "2xx"

# /productos — SSR page that queries the catalog
check_endpoint "/productos" "/productos (SSR catalog)" "2xx"

if [ "$verification_ok" -ne 1 ]; then
  echo "ERROR: post-deploy verification failed."
  echo "       LAST_DEPLOYED_SHA_FILE was NOT updated; inspect logs and roll back if needed."
  exit 1
fi

# --------------------------------------------------------------------------
# Seed verification (informational, never aborts)
# --------------------------------------------------------------------------
echo "==> Post-deploy: verifying seeded users..."
docker compose exec -T "$DB_SERVICE" sh -lc \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select email, role, is_active from users order by role;"' \
  || echo "    (user verification skipped — database query failed)"

# --------------------------------------------------------------------------
# Final status
# --------------------------------------------------------------------------
echo ""
echo "==> Final container status:"
docker compose ps

echo ""
# Recorded only here, once everything above succeeded. This is what the NEXT deploy reads as
# its rollback target, so a deploy that failed earlier must never reach this line.
git rev-parse HEAD > "$LAST_DEPLOYED_SHA_FILE"
echo "==> Recorded successful deploy: $(cat "$LAST_DEPLOYED_SHA_FILE")"

echo ""
echo "==> Cleanup: pruning unused images..."
docker image prune -f 2>/dev/null || true

echo ""
echo "=========================================================================="
echo " Deploy completed successfully."
echo " Access: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo '<your-vps-ip>'):${WEB_PORT:-8686}"
echo " Admin:  admin@ilasesorias.com"
echo "=========================================================================="
