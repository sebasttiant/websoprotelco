#!/usr/bin/env bash
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
APP="$WORK/app"; BIN="$WORK/bin"
mkdir -p "$APP" "$BIN"
cp "$ROOT/deploy.sh" "$ROOT/deploy-lib.sh" "$APP/"
# An existing deployment already has its .env; without one deploy.sh stops at the first-deploy scaffold
# (see deploy-first-bare.sh) before it ever reaches the lock/Git/re-exec path this file exercises.
: > "$APP/.env"
cat > "$APP/target-deploy.sh" <<'TARGET'
#!/usr/bin/env bash
test "$(readlink -f /proc/$$/fd/9)" = "$(cd "$APP_DIR/backups" && pwd -P)/.deploy.lock"
flock -n 9
printf 'target revision executed\n'
TARGET
chmod +x "$APP/target-deploy.sh"
cat > "$BIN/git" <<'GIT'
#!/usr/bin/env bash
case "$1" in
  pull) cp "$APP_DIR/target-deploy.sh" "$APP_DIR/deploy.sh" ;;
  rev-parse) printf 'target-sha\n' ;;
esac
GIT
chmod +x "$BIN/git"
if PATH="$BIN:$PATH" APP_DIR="$APP" MAINTENANCE_WINDOW_CONFIRMED=true bash "$APP/deploy.sh" > "$WORK/out" 2> "$WORK/err" \
  && grep -q 'target revision executed' "$WORK/out"; then
  echo '  ok   — deploy locks before Git and re-execs with inherited FD 9'
else
  echo '  FAIL — deploy did not lock and execute the pulled target revision'
  sed 's/^/    /' "$WORK/out" "$WORK/err"
  exit 1
fi
cp "$ROOT/deploy.sh" "$APP/deploy.sh"
if PATH="$BIN:$PATH" APP_DIR="$APP" MAINTENANCE_WINDOW_CONFIRMED=true DEPLOY_LOCK_HELD=1 bash "$APP/deploy.sh" > "$WORK/held-out" 2> "$WORK/held-err" \
  && grep -q '==> Updating code' "$WORK/held-out" \
  && grep -q 'target revision executed' "$WORK/held-out"; then
  echo '  ok   — DEPLOY_LOCK_HELD alone cannot bypass FD 9 locking'
else
  echo '  FAIL — DEPLOY_LOCK_HELD bypassed FD 9 locking'
  sed 's/^/    /' "$WORK/held-out" "$WORK/held-err"
  exit 1
fi
cp "$ROOT/deploy.sh" "$APP/deploy.sh"
if PATH="$BIN:$PATH" APP_DIR="$APP" MAINTENANCE_WINDOW_CONFIRMED=true DEPLOY_TARGET_REEXEC=1 DEPLOY_LOCK_HELD=1 DEPLOY_LOCK_CONTEXT=spoof DEPLOY_LOCK_CONTEXT_FILE=/dev/null DEPLOY_TARGET_REEXEC_SHA=target-sha bash "$APP/deploy.sh" > "$WORK/uninherited-out" 2> "$WORK/uninherited-err" \
  && grep -q '==> Updating code' "$WORK/uninherited-out" \
  && grep -q 'target revision executed' "$WORK/uninherited-out"; then
  echo '  ok   — uninherited re-exec env vars cannot bypass Git update'
else
  echo '  FAIL — uninherited re-exec env vars bypassed Git update'
  sed 's/^/    /' "$WORK/uninherited-out" "$WORK/uninherited-err"
  exit 1
fi
cp "$ROOT/deploy.sh" "$APP/deploy.sh"
if PATH="$BIN:$PATH" APP_DIR="$APP" MAINTENANCE_WINDOW_CONFIRMED=true DEPLOY_TARGET_REEXEC=1 DEPLOY_LOCK_HELD=1 DEPLOY_LOCK_CONTEXT=spoof DEPLOY_LOCK_CONTEXT_FILE=/dev/null DEPLOY_TARGET_REEXEC_SHA=wrong-sha bash "$APP/deploy.sh" > "$WORK/spoof-out" 2> "$WORK/spoof-err" \
  && grep -q '==> Updating code' "$WORK/spoof-out" \
  && grep -q 'target revision executed' "$WORK/spoof-out"; then
  echo '  ok   — re-exec SHA mismatch updates and does not loop'
else
  echo '  FAIL — re-exec SHA mismatch bypassed update or looped'
  sed 's/^/    /' "$WORK/spoof-out" "$WORK/spoof-err"
  exit 1
fi
cp "$ROOT/deploy.sh" "$APP/deploy.sh"
exec 9>"$WORK/wrong.lock"
flock -n 9
if PATH="$BIN:$PATH" APP_DIR="$APP" MAINTENANCE_WINDOW_CONFIRMED=true DEPLOY_LOCK_HELD=1 bash "$APP/deploy.sh" > "$WORK/wrong-out" 2> "$WORK/wrong-err" \
  && grep -q 'target revision executed' "$WORK/wrong-out"; then
  echo '  ok   — wrong-file FD 9 is replaced with the canonical lock'
else
  echo '  FAIL — wrong-file FD 9 bypassed canonical locking'
  sed 's/^/    /' "$WORK/wrong-out" "$WORK/wrong-err"
  exit 1
fi
exec 9>&-
cp "$ROOT/deploy.sh" "$APP/deploy.sh"
mkdir -p "$APP/backups"
cp "$ROOT/rollback.sh" "$APP/"
printf 'incomplete\n' > "$APP/backups/rollback-manifest"
cat > "$BIN/tail" <<'TAIL'
#!/usr/bin/env bash
# Only the rollback under test announces itself and holds the lock; the deploy under test also reads
# files with `tail` (its .env parsing) before it takes the lock and must not be delayed by this stub.
if [ -n "${TAIL_READY_FILE:-}" ]; then
  touch "$TAIL_READY_FILE"
  sleep 2
fi
exec /usr/bin/tail "$@"
TAIL
chmod +x "$BIN/tail"
TAIL_READY_FILE="$WORK/rollback-lock-ready" PATH="$BIN:$PATH" APP_DIR="$APP" MAINTENANCE_WINDOW_CONFIRMED=true KNOWN_UPLOAD_URL=/uploads/image.webp KNOWN_DOCUMENT_URL=/documents/manual/guide.pdf bash "$APP/rollback.sh" > "$WORK/rollback-out" 2> "$WORK/rollback-err" &
rollback=$!
for _ in $(seq 1 20); do [ -f "$WORK/rollback-lock-ready" ] && break; sleep 0.1; done
if [ ! -f "$WORK/rollback-lock-ready" ]; then
  echo '  FAIL — rollback did not acquire the lock for the concurrency check'
  kill "$rollback" 2>/dev/null || true
  exit 1
fi
if PATH="$BIN:$PATH" APP_DIR="$APP" MAINTENANCE_WINDOW_CONFIRMED=true DEPLOY_TARGET_REEXEC=1 DEPLOY_TARGET_REEXEC_SHA=target-sha DEPLOY_LOCK_HELD=1 DEPLOY_LOCK_CONTEXT=spoof DEPLOY_LOCK_CONTEXT_FILE=/dev/null bash "$APP/deploy.sh" > "$WORK/blocked-out" 2> "$WORK/blocked-err"; then
  echo '  FAIL — full environment spoof bypassed concurrent rollback lock'
  kill "$rollback" 2>/dev/null || true
  exit 1
elif ! grep -q 'another deploy or rollback is running' "$WORK/blocked-out" \
  && ! grep -q 'another deploy or rollback is running' "$WORK/blocked-err"; then
  echo '  FAIL — deploy did not report canonical lock contention'
  kill "$rollback" 2>/dev/null || true
  exit 1
else
  echo '  ok   — full environment spoof cannot bypass concurrent rollback before Git'
fi
wait "$rollback" || true
