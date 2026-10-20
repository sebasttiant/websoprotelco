#!/usr/bin/env bash
# A first bare ./deploy.sh (no .env, no exported evidence) must reach the .env scaffold instead of
# being refused for missing existing-deploy evidence. No real git, docker or network: both are
# stubs on PATH, and docker records every call so the test can prove nothing destructive ran.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
APP="$WORK/app"; BIN="$WORK/bin"
mkdir -p "$APP" "$BIN"
cp "$ROOT/deploy.sh" "$ROOT/deploy-lib.sh" "$APP/"
chmod +x "$APP/deploy.sh"

cat > "$BIN/git" <<'GIT'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$FAKE_GIT_CALLS"
case "$1" in
  rev-parse) printf 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n' ;;
esac
exit 0
GIT
cat > "$BIN/docker" <<'DOCKER'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$FAKE_DOCKER_CALLS"
exit 0
DOCKER
chmod +x "$BIN/git" "$BIN/docker"

export PATH="$BIN:$PATH" APP_DIR="$APP" FAKE_GIT_CALLS="$WORK/git-calls" FAKE_DOCKER_CALLS="$WORK/docker-calls"
unset MAINTENANCE_WINDOW_CONFIRMED KNOWN_UPLOAD_URL KNOWN_DOCUMENT_URL
: > "$FAKE_GIT_CALLS"; : > "$FAKE_DOCKER_CALLS"

fail=0
ok()  { echo "  ok   — $1"; }
bad() { echo "  FAIL — $1"; fail=1; }

# --- first bare deploy: no .env, no evidence -> scaffold, then stop for the operator -------------
bash "$APP/deploy.sh" > "$WORK/first-out" 2> "$WORK/first-err"
status=$?

if [ "$status" -eq 1 ] && [ -f "$APP/.env" ] && grep -q 'Created .*/.env from a template' "$WORK/first-out"; then
  ok "first bare deploy reaches the .env scaffold and stops for the operator"
else
  bad "first bare deploy did not reach the .env scaffold (exit $status)"
  sed 's/^/    /' "$WORK/first-out" "$WORK/first-err"
fi
if grep -q 'MAINTENANCE_WINDOW_CONFIRMED=true is required' "$WORK/first-out" "$WORK/first-err"; then
  bad "first bare deploy demanded existing-deploy evidence before the scaffold"
else
  ok "first bare deploy is not refused for missing existing-deploy evidence"
fi
if [ ! -s "$FAKE_DOCKER_CALLS" ]; then
  ok "no docker command ran before the operator filled in the scaffold"
else
  bad "docker ran during a scaffold-only deploy"; sed 's/^/    /' "$FAKE_DOCKER_CALLS"
fi

# --- evidence gates stay closed once a .env exists --------------------------------------------------
rm -rf "$APP/backups"; : > "$FAKE_GIT_CALLS"
bash "$APP/deploy.sh" > "$WORK/gate-out" 2> "$WORK/gate-err"
status=$?
if [ "$status" -ne 0 ] && grep -q 'MAINTENANCE_WINDOW_CONFIRMED=true is required' "$WORK/gate-out" "$WORK/gate-err" \
  && [ ! -s "$FAKE_GIT_CALLS" ]; then
  ok "with a .env present, missing MAINTENANCE_WINDOW_CONFIRMED still fails before any git mutation"
else
  bad "the maintenance-window gate no longer fails closed before git (exit $status)"
  sed 's/^/    /' "$WORK/gate-out" "$WORK/gate-err" "$FAKE_GIT_CALLS"
fi

# --- supplied-but-malformed evidence is rejected even without a .env ---------------------------------
rm -f "$APP/.env"; rm -rf "$APP/backups"; : > "$FAKE_GIT_CALLS"
MAINTENANCE_WINDOW_CONFIRMED=true KNOWN_UPLOAD_URL=image.webp KNOWN_DOCUMENT_URL=manual/guide.pdf \
  bash "$APP/deploy.sh" > "$WORK/bad-out" 2> "$WORK/bad-err"
status=$?
if [ "$status" -ne 0 ] && [ ! -f "$APP/.env" ] && [ ! -s "$FAKE_GIT_CALLS" ]; then
  ok "malformed supplied evidence still fails before git even with no .env"
else
  bad "malformed evidence was accepted without a .env (exit $status)"
  sed 's/^/    /' "$WORK/bad-out" "$WORK/bad-err"
fi

exit "$fail"
