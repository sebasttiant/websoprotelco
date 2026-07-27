#!/usr/bin/env bash
# Deterministic ordering contracts for deployment state and shared serialization.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
deploy="$ROOT/deploy.sh"
rollback="$ROOT/rollback.sh"

line() { grep -nF "$1" "$2" | cut -d: -f1 | head -1; }

state_line="$(line 'deployment_state="$(deployment_state' "$deploy")"
db_start_line="$(line 'docker compose up -d "$DB_SERVICE"' "$deploy")"
lock_line="$(line 'flock -n 9' "$deploy")"
fetch_line="$(line 'git fetch origin "$BRANCH"' "$deploy")"
rollback_lock_line="$(line 'flock -n 9' "$rollback")"
rollback_reset_line="$(line 'git reset --hard "$target_sha"' "$rollback")"

[ "$state_line" -lt "$db_start_line" ] || { echo 'FAIL — first-deploy state is not captured before DB initialization'; exit 1; }
[ "$lock_line" -lt "$fetch_line" ] || { echo 'FAIL — deploy lock is not acquired before Git fetch'; exit 1; }
[ "$rollback_lock_line" -lt "$rollback_reset_line" ] || { echo 'FAIL — rollback lock does not serialize Git reset'; exit 1; }
echo '  ok   — fresh state precedes DB initialization and deploy/rollback serialize Git mutations'
