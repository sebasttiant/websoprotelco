#!/usr/bin/env bash
# Regression tests for deploy-lib.sh — the decision logic behind deploy.sh and rollback.sh.
# Legacy documents migration is intentionally manual: deploy must fail closed instead of
# resuming state, scanning old archives, or inferring a migration from an empty volume.
#
# No docker daemon and no VPS: `docker` is a stub on PATH (see fake-docker).
#
#   bash tests/deploy/run.sh
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

pass=0; fail=0
ok()   { echo "  ok   — $1"; pass=$((pass + 1)); }
bad()  { echo "  FAIL — $1"; fail=$((fail + 1)); }
is()   { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (expected '$3', got '$2')"; fi; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
export PATH="$HERE:$PATH"
ln -sf "$HERE/fake-docker" "$HERE/docker" 2>/dev/null || true

new_case() {
  CASE="$WORK/$1"; rm -rf "$CASE"; mkdir -p "$CASE/backups"
  export FAKE_DOCKER_STATE="$CASE/docker"; mkdir -p "$FAKE_DOCKER_STATE"
  BACKUP_DIR="$CASE/backups"
  MANIFEST_FILE="$BACKUP_DIR/rollback-manifest"
  BACKUP_RETENTION=10
  export BACKUP_DIR MANIFEST_FILE BACKUP_RETENTION
}

mk_archive() { # path, n files
  local out="$1" n="$2" d="$WORK/stage"
  rm -rf "$d"; mkdir -p "$d"
  local i=1; while [ "$i" -le "$n" ]; do echo "content$i" > "$d/f$i.pdf"; i=$((i + 1)); done
  tar -czf "$out" -C "$d" .
}

# shellcheck source=../../deploy-lib.sh disable=SC1091
. "$ROOT/deploy-lib.sh"

echo "== no automatic documents migration state remains =="
new_case no_state
mk_archive "$BACKUP_DIR/documents-20260101-000000.tar.gz" 5
mk_archive "$BACKUP_DIR/documents-20260303-000000.tar.gz" 9
if grep -qE 'migration_state_|migration_action|migration_resume_action|newest_documents|-name .documents-\*\.tar\.gz.' "$ROOT/deploy.sh" "$ROOT/deploy-lib.sh"; then
  bad "automatic documents migration/resume/archive-selection code is still present"
else
  ok "deploy code has no migration state machine or historical archive auto-selection"
fi
if [ -e "$ROOT/deploy-state.sh" ]; then
  bad "deploy-state.sh still exists"
else
  ok "deploy-state.sh was removed"
fi

echo
echo "== legacy writable-layer documents fail closed before rebuild =="
new_case fail_closed
is "running legacy container can be inspected first" "$(file_backup_plan running 1 1)" "archive_running"
is "stopped legacy container aborts"                "$(file_backup_plan stopped 1 1)" "abort_stopped_legacy"
is "stopped mounted container reads volumes"        "$(file_backup_plan stopped 0 1)" "archive_volumes"
is "absent container on previously deployed host aborts" "$(file_backup_plan absent 0 1)" "abort_legacy_unknown"
is "absent container on fresh host reads volumes"        "$(file_backup_plan absent 0 0)" "archive_volumes"

echo
echo "== container states are read explicitly =="
new_case running
echo "abc123" > "$FAKE_DOCKER_STATE/ps_all"; echo "abc123" > "$FAKE_DOCKER_STATE/ps_running"
is "running container"  "$(web_container_state web)" "running"
new_case stopped
echo "abc123" > "$FAKE_DOCKER_STATE/ps_all"; : > "$FAKE_DOCKER_STATE/ps_running"
is "stopped container (ps -q alone would say absent)" "$(web_container_state web)" "stopped"
new_case gone
: > "$FAKE_DOCKER_STATE/ps_all"; : > "$FAKE_DOCKER_STATE/ps_running"
is "absent container"   "$(web_container_state web)" "absent"

echo
echo "== docker inspect decides whether documents are legacy =="
new_case mounted
printf '/app/public/uploads\n/app/public/documents\n' > "$FAKE_DOCKER_STATE/mounts"
if container_has_mount abc123 /app/public/documents; then ok "documents volume detected"; else bad "documents volume not detected"; fi
new_case legacy
printf '/app/public/uploads\n' > "$FAKE_DOCKER_STATE/mounts"
if container_has_mount abc123 /app/public/documents; then bad "false positive on legacy container"; else ok "legacy container (no documents mount) detected"; fi

echo
echo "== retention =="
new_case retention
BACKUP_RETENTION=2
i=1; while [ "$i" -le 6 ]; do
  f="$BACKUP_DIR/uploads-2026010${i}-000000.tar.gz"; echo x > "$f"; touch -d "2026-01-0${i}" "$f"; i=$((i + 1))
done
printf 'ts\tsha\t-\tdb\t%s\t-\n' "$BACKUP_DIR/uploads-20260101-000000.tar.gz" > "$MANIFEST_FILE"
prune_backups 'uploads-*.tar.gz'
is "prunes down to retention + the manifest's file" "$(find "$BACKUP_DIR" -name 'uploads-*.tar.gz' | wc -l | tr -d ' ')" "3"
if [ -f "$BACKUP_DIR/uploads-20260101-000000.tar.gz" ]; then
  ok "never prunes the file the last manifest entry references (even though it is oldest)"
else
  bad "pruned the rollback target"
fi

new_case retention_documents
BACKUP_RETENTION=1
for i in 1 2 3; do
  f="$BACKUP_DIR/documents-2026010${i}-000000.tar.gz"; echo x > "$f"; touch -d "2026-01-0${i}" "$f"
done
printf 'ts\tsha\t/db.dump\tdb\t/u.tgz\t%s\n' "$BACKUP_DIR/documents-20260101-000000.tar.gz" > "$MANIFEST_FILE"
prune_backups 'documents-*.tar.gz'
if [ -f "$BACKUP_DIR/documents-20260101-000000.tar.gz" ]; then
  ok "retention protects the current rollback documents snapshot"
else
  bad "retention pruned the current rollback documents snapshot"
fi

echo
echo "== manifest =="
new_case manifest
manifest_append "sha1" "$BACKUP_DIR/db.dump" "appdb" "$BACKUP_DIR/u.tar.gz" "$BACKUP_DIR/d.tar.gz"
entry="$(manifest_last_entry)"
is "six columns"        "$(manifest_entry_columns "$entry")" "6"
is "column 2 is the SHA" "$(manifest_entry_field "$entry" 2)" "sha1"
is "column 6 is documents" "$(manifest_entry_field "$entry" 6)" "$BACKUP_DIR/d.tar.gz"
manifest_append "sha2" "" "appdb" "" ""
entry="$(manifest_last_entry)"
is "absent snapshots become '-'" "$(manifest_entry_field "$entry" 5)" "-"
is "column count holds with '-'" "$(manifest_entry_columns "$entry")" "6"

echo
echo "== no '-' may allow a partial restore =="
new_case dash
# Mirrors rollback.sh's gate: reject if any snapshot column is "-".
reject() {
  local e="$1" c
  [ "$(manifest_entry_columns "$e")" -lt 6 ] && { echo reject; return; }
  for c in 3 5 6; do [ "$(manifest_entry_field "$e" "$c")" = "-" ] && { echo reject; return; }; done
  echo accept
}
is "db missing        -> reject" "$(reject "$(printf 'ts\tsha\t-\tappdb\t/u.tgz\t/d.tgz')")" "reject"
is "uploads missing   -> reject" "$(reject "$(printf 'ts\tsha\t/db.dump\tappdb\t-\t/d.tgz')")" "reject"
is "documents missing -> reject" "$(reject "$(printf 'ts\tsha\t/db.dump\tappdb\t/u.tgz\t-')")" "reject"
is "legacy 4-column   -> reject" "$(reject "$(printf 'ts\tsha\t/db.dump\tappdb')")" "reject"
is "all three present -> accept" "$(reject "$(printf 'ts\tsha\t/db.dump\tappdb\t/u.tgz\t/d.tgz')")" "accept"

echo
echo "== rollback restores all three from ONE snapshot =="
new_case triple
manifest_append "shaX" "$BACKUP_DIR/db-1.dump" "appdb" "$BACKUP_DIR/uploads-1.tar.gz" "$BACKUP_DIR/documents-1.tar.gz"
manifest_append "shaY" "$BACKUP_DIR/db-2.dump" "appdb" "$BACKUP_DIR/uploads-2.tar.gz" "$BACKUP_DIR/documents-2.tar.gz"
entry="$(manifest_last_entry)"
is "uses the newest entry"        "$(manifest_entry_field "$entry" 2)" "shaY"
is "db from that entry"           "$(basename "$(manifest_entry_field "$entry" 3)")" "db-2.dump"
is "uploads from the SAME entry"  "$(basename "$(manifest_entry_field "$entry" 5)")" "uploads-2.tar.gz"
is "documents from the SAME entry" "$(basename "$(manifest_entry_field "$entry" 6)")" "documents-2.tar.gz"

echo
echo "== counting guards =="
new_case counts
if require_number "5" "x" 2>/dev/null; then ok "accepts a number"; else bad "rejected a number"; fi
if require_number "" "x" 2>/dev/null; then bad "accepted empty"; else ok "rejects empty (else [ -ne ] exits 2 and 'if' reads it as false)"; fi
if require_number "a" "x" 2>/dev/null; then bad "accepted non-numeric"; else ok "rejects non-numeric"; fi

echo
echo "== compose volume check is anchored =="
new_case anchored
repo="$CASE/repo"; mkdir -p "$repo"; ( cd "$repo" && git init -q && git config user.email t@t && git config user.name t )
printf 'services:\n  web:\n    # documents-data explained here\n    volumes:\n      - uploads-data:/app/public/uploads\n' > "$repo/compose.yaml"
( cd "$repo" && git add -A && git commit -qm no-vol )
novol="$(cd "$repo" && git rev-parse HEAD)"
printf 'services:\n  web:\n    volumes:\n      - uploads-data:/app/public/uploads\n      - documents-data:/app/public/documents\n' > "$repo/compose.yaml"
( cd "$repo" && git add -A && git commit -qm vol )
withvol="$(cd "$repo" && git rev-parse HEAD)"
(
  cd "$repo"
  if commit_mounts_volume "$novol" "documents-data:/app/public/documents"; then
    echo "  FAIL — comment-only commit passed the anchored check"; exit 1
  else
    echo "  ok   — a commit that only mentions documents-data in a comment is rejected"
  fi
  if commit_mounts_volume "$withvol" "documents-data:/app/public/documents"; then
    echo "  ok   — a commit that really mounts documents-data is accepted"
  else
    echo "  FAIL — real mount rejected"; exit 1
  fi
) && pass=$((pass + 2)) || fail=$((fail + 1))

rm -f "$HERE/docker"
echo
echo "=================================="
echo " passed: $pass   failed: $fail"
echo "=================================="
[ "$fail" -eq 0 ]
