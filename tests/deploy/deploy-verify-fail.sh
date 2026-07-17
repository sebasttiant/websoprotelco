#!/usr/bin/env bash
# Executes deploy.sh far enough to prove failed endpoint verification exits non-zero and does
# not rewrite backups/last-deployed-sha.
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
ARCHIVE_SRC="$WORK/archive-src"
mkdir -p "$APP/backups" "$BIN" "$ARCHIVE_SRC"
printf 'x' > "$ARCHIVE_SRC/file.txt"
cp "$ROOT/deploy.sh" "$ROOT/deploy-lib.sh" "$APP/"
printf 'old-successful-sha\n' > "$APP/backups/last-deployed-sha"
cat > "$APP/.env" <<'ENV'
POSTGRES_PASSWORD=test
DATABASE_URL=postgresql://u:p@db:5432/appdb
ADMIN_EMAIL=admin@example.test
ADMIN_PASSWORD=change-me
ENV

cat > "$BIN/git" <<'GIT'
#!/usr/bin/env bash
case "$1" in
  rev-parse) printf 'new-deploy-sha\n' ;;
  fetch|pull) exit 0 ;;
  *) exit 0 ;;
esac
GIT
chmod +x "$BIN/git"

cat > "$BIN/docker" <<'DOCKER'
#!/usr/bin/env bash
set -u
calls="${FAKE_DOCKER_CALLS:?FAKE_DOCKER_CALLS not set}"
archive_src="${FAKE_ARCHIVE_SRC:?FAKE_ARCHIVE_SRC not set}"
printf '%s\n' "$*" >> "$calls"

make_archive() { tar -czf - -C "$archive_src" .; }

if [ "$1" = "compose" ]; then
  shift
  case "$1" in
    ps)
      shift
      if [ "${1:-}" = "-aq" ]; then
        case "${2:-}" in web) printf 'web-id\n' ;; db) printf 'db-id\n' ;; esac
        exit 0
      fi
      if [ "${1:-}" = "-q" ]; then
        case "${2:-}" in web) printf 'web-id\n' ;; db) printf 'db-id\n' ;; esac
        exit 0
      fi
      printf 'web running\ndb running\n'
      exit 0
      ;;
    build|up)
      exit 0
      ;;
    run)
      for arg in "$@"; do
        if [ "$arg" = "tar -czf - -C '/app/public/uploads' ." ] || [ "$arg" = "tar -czf - -C '/app/public/documents' ." ]; then
          make_archive
          exit 0
        fi
      done
      exit 0
      ;;
    logs)
      exit 0
      ;;
    exec)
      shift
      while [ "${1:-}" = "-T" ]; do shift; done
      service="${1:-}"
      if [ "$service" = "db" ]; then
        case "$*" in
          *'printenv POSTGRES_DB'*) printf 'appdb\n'; exit 0 ;;
          *'psql -U "$POSTGRES_USER" -d postgres -lqtA -F"|"'*) printf 'appdb|owner|UTF8\n'; exit 0 ;;
          *'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"'*) printf 'fake-dump'; exit 0 ;;
          *'pg_restore --list'*) i=1; while [ "$i" -le 13 ]; do printf '1; 0 0 TABLE DATA public table%s owner\n' "$i"; i=$((i + 1)); done; exit 0 ;;
          *'SELECT count(*) FROM information_schema.tables'*) printf '13\n'; exit 0 ;;
          *'select 1;'*) printf '1\n'; exit 0 ;;
          *"to_regclass('public."*) printf 't\n'; exit 0 ;;
          *'select email, role, is_active'*) exit 0 ;;
        esac
      fi
      if [ "$service" = "web" ]; then
        case "$*" in
          *'if [ -d '*) printf 'PRESENT\n'; exit 0 ;;
          *'tar -czf - -C '*) make_archive; exit 0 ;;
          *'fetch('*) printf '404\n'; exit 0 ;;
        esac
      fi
      exit 0
      ;;
    *) exit 0 ;;
  esac
fi

if [ "$1" = "inspect" ]; then
  case "$*" in
    *'.State.Health'*) printf 'healthy\n' ;;
    *) printf '/app/public/uploads\n/app/public/documents\n' ;;
  esac
  exit 0
fi

if [ "$1" = "image" ]; then exit 0; fi
exit 0
DOCKER
chmod +x "$BIN/docker"

cat > "$BIN/pg_restore" <<'PG'
#!/usr/bin/env bash
if [ "${1:-}" = "--list" ]; then
  i=1
  while [ "$i" -le 13 ]; do printf '1; 0 0 TABLE DATA public table%s owner\n' "$i"; i=$((i + 1)); done
fi
PG
chmod +x "$BIN/pg_restore"

export PATH="$BIN:$PATH"
export APP_DIR="$APP"
export FAKE_DOCKER_CALLS="$WORK/docker.calls"
export FAKE_ARCHIVE_SRC="$ARCHIVE_SRC"
: > "$FAKE_DOCKER_CALLS"

if bash "$APP/deploy.sh" > "$WORK/deploy.out" 2> "$WORK/deploy.err"; then
  bad "deploy succeeded despite endpoint verification failure"
else
  if grep -q "post-deploy verification failed" "$WORK/deploy.out"; then
    ok "deploy exits non-zero on endpoint verification failure"
  else
    bad "deploy did not report post-deploy verification failure"
    sed 's/^/    /' "$WORK/deploy.out"
    sed 's/^/    /' "$WORK/deploy.err"
  fi
fi

if [ "$(cat "$APP/backups/last-deployed-sha")" = "old-successful-sha" ]; then
  ok "last-deployed-sha remains unchanged"
else
  bad "last-deployed-sha was rewritten"
  sed 's/^/    /' "$APP/backups/last-deployed-sha"
fi

echo
echo "=================================="
echo " passed: $pass   failed: $fail"
echo "=================================="
[ "$fail" -eq 0 ]
