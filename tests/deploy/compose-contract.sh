#!/usr/bin/env bash
# Fail-closed storage configuration contract for compose.yaml — bash tests/deploy/compose-contract.sh
#
# Runs the real `docker compose config`: grepping the YAML would still pass with a
# `${STORAGE_PROVIDER:-local}` default, the silent fallback this contract forbids.
# `--env-file /dev/null` stops Compose auto-loading a developer's ./.env and masking case 1.
# Rejection of an unsupported provider is application behaviour and is proven by
# tests/server/storage/provider.test.ts, which runs under `pnpm test`.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.." || exit 1

pass=0; fail=0
ok()  { echo "  ok   — $1"; pass=$((pass + 1)); }
bad() { echo "  FAIL — $1"; fail=$((fail + 1)); }
cfg() { env -u STORAGE_PROVIDER "$@" docker compose --env-file /dev/null config 2>&1; }

if out="$(cfg)"; then
  bad "compose validated without STORAGE_PROVIDER"
else
  case "$out" in
    *STORAGE_PROVIDER*) ok "compose fails closed and names the missing variable" ;;
    *) bad "compose failed for an unrelated reason: $out" ;;
  esac
fi

if out="$(cfg STORAGE_PROVIDER=local)"; then
  case "$out" in
    *"STORAGE_PROVIDER: local"*) ok "compose renders an explicitly declared local provider" ;;
    *) bad "compose validated but did not render STORAGE_PROVIDER: local" ;;
  esac
else
  bad "compose rejected an explicit local provider: $out"
fi

echo " passed: $pass   failed: $fail"
[ "$fail" -eq 0 ]
