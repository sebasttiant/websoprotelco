#!/usr/bin/env bash
# Runs every deploy/rollback shell contract that needs no Docker daemon, no network and no VPS:
# `docker` and `git` are stubs on PATH inside each script. Every script runs even if an earlier one
# fails, so one invocation reports the whole picture.
#
#   pnpm test:contract:deploy      (or: bash tests/deploy/run-all.sh)
#
# Deliberately NOT included, because they call a real Docker daemon:
#   tests/deploy/compose-contract.sh   (`docker compose config`)
#   tests/deploy/runtime-manifest.sh   (`docker run` against the runtime base image)
# CI runs those two next to the image builds. The black-box standalone asset contract is a separate
# command: `pnpm test:contract:assets`.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CONTRACTS=(
  run.sh
  deploy-abort.sh
  deploy-reexec.sh
  deploy-state-contract.sh
  deploy-verify-fail.sh
  rollback-unset-db.sh
)

failed=()
for contract in "${CONTRACTS[@]}"; do
  echo
  echo "##### tests/deploy/$contract"
  if ! bash "$HERE/$contract"; then
    failed+=("$contract")
  fi
done

echo
echo "=================================="
echo " deploy contracts: $((${#CONTRACTS[@]} - ${#failed[@]}))/${#CONTRACTS[@]} passed"
if [ "${#failed[@]}" -gt 0 ]; then
  printf ' FAILED: %s\n' "${failed[@]}"
fi
echo "=================================="
[ "${#failed[@]}" -eq 0 ]
