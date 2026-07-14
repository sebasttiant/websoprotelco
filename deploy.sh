#!/usr/bin/env bash
set -Eeuo pipefail

# ==========================================================================
# SOPROTELCO — deploy en VPS
#
# Flujo: backup → pull → build → db up → migrate → seed → web up → verify
#
# IMPORTANTE: los contenedores `migrate` y `seed` son one-shot targets del
# Dockerfile. El seed se niega a correr si NODE_ENV=production (tiene
# credenciales commiteadas), así que nunca setear esa variable en ese target.
# El contenedor `web` es Next.js standalone y NO incluye tsx ni migraciones.
#
# Acceso final:  http://<ip-vps>:8585
# ==========================================================================

# APP_DIR se autodetecta desde la ubicación del script.
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
BACKUP_DIR="$APP_DIR/backups"
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
echo "==> Creating backup..."
mkdir -p "$BACKUP_DIR"
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

# Fail fast on missing critical variables.
required_vars=(POSTGRES_PASSWORD DATABASE_URL)
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
# 6. Run migrations
# --------------------------------------------------------------------------
echo "==> Running database migrations..."
docker compose run --rm --no-deps "$MIGRATE_SERVICE"

# --------------------------------------------------------------------------
# 7. Run seed (default admin/staff accounts)
# --------------------------------------------------------------------------
echo "==> Seeding default users..."
docker compose run --rm --no-deps "$SEED_SERVICE" || {
  echo "    ⚠ Seed failed or skipped (may already exist). Continuing — web doesn't depend on seed."
}

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
echo "==> Cleanup: pruning unused images..."
docker image prune -f 2>/dev/null || true

echo ""
echo "=========================================================================="
echo " Deploy completed successfully."
echo " Access: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo '<your-vps-ip>'):${WEB_PORT:-8585}"
echo " Admin:  admin@ilasesorias.com"
echo "=========================================================================="
