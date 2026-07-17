#!/usr/bin/env bash
# Behaviour test for deploy.sh itself, not only deploy-lib.sh helpers.
# Proves legacy writable-layer documents abort before build/up/migrate/seed/recreate.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

pass=0; fail=0
ok()  { echo "  ok   — $1"; pass=$((pass + 1)); }
bad() { echo "  FAIL — $1"; fail=$((fail + 1)); }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

APP="$WORK/app"
BIN="$WORK/bin"
mkdir -p "$APP" "$BIN"
cp "$ROOT/deploy.sh" "$ROOT/deploy-lib.sh" "$APP/"
cat > "$APP/.env" <<'ENV'
POSTGRES_PASSWORD=test
DATABASE_URL=postgresql://u:p@db:5432/app
ADMIN_EMAIL=admin@example.test
ADMIN_PASSWORD=change-me
ENV

cat > "$BIN/git" <<'GIT'
#!/usr/bin/env bash
case "$1" in
  rev-parse) printf 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n' ;;
  fetch|pull) exit 0 ;;
  *) exit 0 ;;
esac
GIT
chmod +x "$BIN/git"

cat > "$BIN/docker" <<'DOCKER'
#!/usr/bin/env bash
set -u
calls="${FAKE_DOCKER_CALLS:?FAKE_DOCKER_CALLS not set}"
printf '%s\n' "$*" >> "$calls"

if [ "$1" = "compose" ]; then
  shift
  case "$1" in
    ps)
      shift
      if [ "${1:-}" = "-aq" ]; then printf 'legacy-web-id\n'; exit 0; fi
      if [ "${1:-}" = "-q" ]; then printf 'legacy-web-id\n'; exit 0; fi
      exit 0
      ;;
    exec)
      # Legacy /app/public/documents contains at least one file, so deploy must abort here.
      printf 'present\n'
      exit 0
      ;;
    build|up|run)
      printf 'DESTRUCTIVE COMMAND REACHED: compose %s\n' "$1" >&2
      exit 88
      ;;
    *) exit 0 ;;
  esac
fi

if [ "$1" = "inspect" ]; then
  # No /app/public/documents mount: documents still live in the container writable layer.
  printf '/app/public/uploads\n'
  exit 0
fi

exit 0
DOCKER
chmod +x "$BIN/docker"

export PATH="$BIN:$PATH"
export APP_DIR="$APP"
export FAKE_DOCKER_CALLS="$WORK/docker.calls"
: > "$FAKE_DOCKER_CALLS"

if bash "$APP/deploy.sh" > "$WORK/deploy.out" 2> "$WORK/deploy.err"; then
  bad "deploy succeeded despite legacy writable-layer documents"
else
  if grep -q "legacy documents still live only" "$WORK/deploy.out" && grep -q "legacy-documents-migration.md" "$WORK/deploy.out"; then
    ok "deploy aborts with the manual runbook pointer"
  else
    bad "deploy abort did not explain the legacy documents/runbook failure"
    sed 's/^/    /' "$WORK/deploy.out"
    sed 's/^/    /' "$WORK/deploy.err"
  fi
fi

if grep -Eq '^(compose (build|up|run))' "$FAKE_DOCKER_CALLS"; then
  bad "destructive docker compose command was reached"
  sed 's/^/    /' "$FAKE_DOCKER_CALLS"
else
  ok "build/up/run/migrate were not reached after the abort"
fi

echo
echo "=================================="
echo " passed: $pass   failed: $fail"
echo "=================================="
[ "$fail" -eq 0 ]
