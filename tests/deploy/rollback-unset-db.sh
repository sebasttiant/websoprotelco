#!/usr/bin/env bash
# Script-level rollback regression: host POSTGRES_DB is intentionally unset. The recreate and
# restore boundary must be reached with DB variables expanded inside the container only.
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
printf 'file' > "$ARCHIVE_SRC/file.txt"
cp "$ROOT/rollback.sh" "$ROOT/deploy-lib.sh" "$APP/"
tar -czf "$APP/backups/uploads.tar.gz" -C "$ARCHIVE_SRC" .
tar -czf "$APP/backups/documents.tar.gz" -C "$ARCHIVE_SRC" .
printf 'fake dump' > "$APP/backups/db.dump"
printf 'ts\ttarget-sha\t%s\tappdb\t%s\t%s\n' \
  "$APP/backups/db.dump" "$APP/backups/uploads.tar.gz" "$APP/backups/documents.tar.gz" \
  > "$APP/backups/rollback-manifest"

cat > "$BIN/git" <<'GIT'
#!/usr/bin/env bash
case "$1" in
  cat-file) exit 0 ;;
  status) exit 0 ;;
  rev-parse) printf 'current-sha\n' ;;
  show) printf 'services:\n  web:\n    volumes:\n      - uploads-data:/app/public/uploads\n      - documents-data:/app/public/documents\n' ;;
  reset) exit 77 ;;
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
    exec)
      shift
      while [ "${1:-}" = "-T" ]; do shift; done
      service="${1:-}"
      if [ "$service" = "db" ]; then
        case "$*" in
          *'pg_isready'*) exit 0 ;;
          *'printenv POSTGRES_DB'*) printf 'appdb\n'; exit 0 ;;
          *'pg_restore --list'*) printf '1; 0 0 TABLE DATA public users owner\n'; exit 0 ;;
          *'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"'*) printf 'safety-dump'; exit 0 ;;
          *'pg_terminate_backend'*'dropdb'*'createdb'*) printf 'recreate-boundary\n' >> "$calls"; exit 0 ;;
          *'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --single-transaction --no-owner'*) printf 'restore-boundary\n' >> "$calls"; exit 0 ;;
        esac
      fi
      exit 0
      ;;
    stop)
      printf 'stop-web-boundary\n' >> "$calls"
      exit 0
      ;;
    run)
      for arg in "$@"; do
        case "$arg" in
          *'tar -czf - -C '*) make_archive; exit 0 ;;
          *'find '*'-mindepth 1 -delete && tar -xzf - -C '*) exit 0 ;;
          *'find '*'-mindepth 1 ! -type d | wc -l'*) printf '1\n'; exit 0 ;;
        esac
      done
      exit 0
      ;;
    *) exit 0 ;;
  esac
fi
exit 0
DOCKER
chmod +x "$BIN/docker"

cat > "$BIN/pg_restore" <<'PG'
#!/usr/bin/env bash
if [ "${1:-}" = "--list" ]; then printf '1; 0 0 TABLE DATA public users owner\n'; fi
PG
chmod +x "$BIN/pg_restore"

export PATH="$BIN:$PATH"
export APP_DIR="$APP"
export FAKE_DOCKER_CALLS="$WORK/docker.calls"
export FAKE_ARCHIVE_SRC="$ARCHIVE_SRC"
: > "$FAKE_DOCKER_CALLS"
unset POSTGRES_DB

printf 'ROLLBACK\n' | bash "$APP/rollback.sh" > "$WORK/rollback.out" 2> "$WORK/rollback.err"
rc=$?

if [ "$rc" -ne 0 ] && grep -q "git reset failed" "$WORK/rollback.out"; then
  ok "rollback reached git reset boundary without host POSTGRES_DB"
else
  bad "rollback exited before expected boundary (rc=$rc)"
  sed 's/^/    /' "$WORK/rollback.out"
  sed 's/^/    /' "$WORK/rollback.err"
fi

line_of() { grep -n "$1" "$FAKE_DOCKER_CALLS" | head -1 | cut -d: -f1; }
stop_line="$(line_of stop-web-boundary)"
safety_line="$(line_of 'pg_dump -U')"
recreate_line="$(line_of recreate-boundary)"
restore_line="$(line_of restore-boundary)"

if [ -n "$stop_line" ] && [ -n "$safety_line" ] && [ -n "$recreate_line" ] && [ -n "$restore_line" ] \
  && [ "$stop_line" -lt "$safety_line" ] && [ "$safety_line" -lt "$recreate_line" ] && [ "$recreate_line" -lt "$restore_line" ]; then
  ok "destructive ordering remains stop -> safety dump -> recreate -> restore"
else
  bad "unsafe or incomplete destructive ordering"
  sed 's/^/    /' "$FAKE_DOCKER_CALLS"
fi

echo
echo "=================================="
echo " passed: $pass   failed: $fail"
echo "=================================="
[ "$fail" -eq 0 ]
