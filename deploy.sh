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
# Acceso final:  http://<ip-vps>:8585
# ==========================================================================

# APP_DIR se autodetecta desde la ubicación del script.
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
BACKUP_DIR="$APP_DIR/backups"
LAST_DEPLOYED_SHA_FILE="$BACKUP_DIR/last-deployed-sha"
MANIFEST_FILE="$BACKUP_DIR/rollback-manifest"
BRANCH="${BRANCH:-main}"
WEB_SERVICE="${WEB_SERVICE:-web}"
DB_SERVICE="${DB_SERVICE:-db}"
MIGRATE_SERVICE="${MIGRATE_SERVICE:-migrate}"
SEED_SERVICE="${SEED_SERVICE:-seed}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"

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
if [ ! -f "$APP_DIR/.env" ]; then
  echo "ERROR: missing $APP_DIR/.env"
  echo "       Copy from .env.example and fill in production values:"
  echo "         cp .env.example .env && nano .env"
  exit 1
fi

# Fail fast on missing critical variables. ADMIN_* are required because this script creates
# the administrator from them: the dev seed's credentials are committed to a public repo and
# must never provision a real server.
required_vars=(POSTGRES_PASSWORD DATABASE_URL ADMIN_EMAIL ADMIN_PASSWORD)
for var in "${required_vars[@]}"; do
  if ! grep -q "^${var}=" "$APP_DIR/.env"; then
    echo "ERROR: $var not set in .env"
    exit 1
  fi
done
echo "    .env OK"

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
# 5.5 Backup retention
# --------------------------------------------------------------------------
# Runs BEFORE the dump: the point of retention is to keep the disk from filling, and a disk
# that is already full makes pg_dump produce a truncated file. Pruning afterwards would never
# run on the very failure it exists to prevent.
#
# Never prunes a file still referenced by the manifest, so retention cannot delete the dump
# that rollback.sh depends on.
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

prune_backups() {
  local pattern="$1" kept=0 file
  while IFS= read -r file; do
    # A referenced file is the rollback target. Retention must never win over recoverability.
    if [ -f "$MANIFEST_FILE" ] && cut -f3 "$MANIFEST_FILE" | grep -Fxq "$file"; then
      continue
    fi
    kept=$((kept + 1))
    if [ "$kept" -gt "$BACKUP_RETENTION" ]; then
      rm -f "$file"
      echo "    Pruned old backup: $(basename "$file")"
    fi
  done < <(find "$BACKUP_DIR" -maxdepth 1 -name "$pattern" -printf '%T@ %p\n' 2>/dev/null \
             | sort -rn | cut -d' ' -f2-)
}
echo "==> Pruning old backups (keeping $BACKUP_RETENTION)..."
prune_backups 'db-*.dump'
prune_backups 'db-*.dump.partial'
prune_backups 'soprotelco-before-deploy-*.tar.gz'

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
  echo "    Backup verified: $db_backup_file (${toc_tables} tables)"

  # Manifest maps the last successfully deployed code to the matching data snapshot.
  # rollback.sh reads the last entry. Tab-separated: timestamp, SHA, dump path, database.
  printf '%s\t%s\t%s\t%s\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$PRE_DEPLOY_SHA" "$db_backup_file" "$backup_db_name" \
    >> "$MANIFEST_FILE"
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
docker compose up -d --no-deps "$WEB_SERVICE"

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

check_table() {
  local table="$1"
  local exists
  if ! exists="$(db_query "select to_regclass('public.$table') is not null;")"; then
    echo "    ⚠ Could not verify table '$table'."
    schema_ok=0
    return
  fi
  if [ "$exists" = "t" ]; then
    echo "    ✓ Table '$table' present."
  else
    echo "    ⚠ Missing table '$table' — check migration step above."
    schema_ok=0
  fi
}

check_endpoint() {
  local path="$1"
  local label="$2"
  local http_status
  if http_status="$(docker compose exec -T "$WEB_SERVICE" node -e \
       "fetch('http://127.0.0.1:8585${path}',{redirect:'manual'}).then(r=>{console.log(r.status);process.exit(r.status>=500?1:0)}).catch(()=>{console.log('no-response');process.exit(1)})" \
       2>/dev/null)"; then
    echo "    ✓ $label responds (HTTP $http_status)."
  else
    echo "    ⚠ $label returned an error (HTTP ${http_status:-no-response})."
    schema_ok=0
  fi
}

# --------------------------------------------------------------------------
# Schema verification — all 13 tables across 10 migrations
# --------------------------------------------------------------------------
echo "==> Post-deploy: verifying database schema..."
if ! db_query "select 1;" >/dev/null; then
  echo "    (schema verification skipped — cannot query database; '$WEB_SERVICE' is healthy)"
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
    echo "    ⚠ Schema incomplete. Deploy continues because '$WEB_SERVICE' is healthy,"
    echo "      but some features may fail at runtime."
  fi
fi

# --------------------------------------------------------------------------
# Endpoint verification
# --------------------------------------------------------------------------
echo "==> Post-deploy: verifying critical endpoints..."

# /api/health?check=db — verifies DB connectivity from the app layer
check_endpoint "/api/health?check=db" "/api/health (with DB check)"

# /login — public page, should render without errors
check_endpoint "/login" "/login (public storefront)"

# /productos — SSR page that queries the catalog
check_endpoint "/productos" "/productos (SSR catalog)"

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
echo " Access: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo '<your-vps-ip>'):${WEB_PORT:-8585}"
echo " Admin:  admin@ilasesorias.com"
echo "=========================================================================="
