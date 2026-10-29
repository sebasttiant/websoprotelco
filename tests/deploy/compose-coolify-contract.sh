#!/usr/bin/env bash
# Contract for compose.coolify.yaml — bash tests/deploy/compose-coolify-contract.sh
#
# Runs the real `docker compose config`: grepping the YAML would pass against a
# `${POSTGRES_USER:-local_dev_user}` default, the silent fallback this contract
# forbids. `--env-file /dev/null` stops Compose auto-loading a developer's ./.env
# and masking the fail-closed cases.
#
# Each assertion pins a failure that would cost production data or availability:
#   - a default credential starts a SECOND, empty cluster beside the real one
#   - a non-external volume resolves to an empty Coolify-prefixed volume
#   - the wrong postgres mount path makes initdb run on an empty directory
#   - a published host port collides with the manual stack during cutover
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.." || exit 1

FILE="compose.coolify.yaml"
pass=0
fail=0
ok() {
  echo "  ok   — $1"
  pass=$((pass + 1))
}
bad() {
  echo "  FAIL — $1"
  fail=$((fail + 1))
}

# Every required variable, unset in the environment, so a missing `:?` shows up.
cfg() {
  env -u STORAGE_PROVIDER -u POSTGRES_DB -u POSTGRES_USER -u POSTGRES_PASSWORD \
    "$@" docker compose -f "$FILE" --env-file /dev/null config 2>&1
}

full() {
  cfg STORAGE_PROVIDER=local POSTGRES_DB=contractdb \
    POSTGRES_USER=contractuser POSTGRES_PASSWORD=contractpass
}

# 1. Fail closed on every required variable.
if out="$(cfg)"; then
  bad "compose validated with no variables set at all"
else
  case "$out" in
    *required*) ok "compose fails closed and names a missing variable" ;;
    *) bad "compose failed for an unrelated reason: $out" ;;
  esac
fi

if out="$(cfg POSTGRES_DB=d POSTGRES_USER=u POSTGRES_PASSWORD=p)"; then
  bad "compose validated without STORAGE_PROVIDER"
else
  case "$out" in
    *STORAGE_PROVIDER*) ok "STORAGE_PROVIDER has no silent default" ;;
    *) bad "missing STORAGE_PROVIDER produced an unrelated error" ;;
  esac
fi

if out="$(cfg STORAGE_PROVIDER=local POSTGRES_DB=d POSTGRES_USER=u)"; then
  bad "compose validated without POSTGRES_PASSWORD"
else
  ok "POSTGRES_PASSWORD has no silent default"
fi

# 2. The three production volumes are external, under their real names.
out="$(full)"
for v in postgres-data uploads-data documents-data; do
  if [[ "$out" == *"name: websoprotelco_$v"* ]]; then
    ok "$v resolves to the production volume websoprotelco_$v"
  else
    bad "$v does not resolve to websoprotelco_$v (Coolify would create it empty)"
  fi
done

if [[ "$(grep -c 'external: true' <<<"$out")" == "3" ]]; then
  ok "all three volumes are declared external"
else
  bad "expected exactly 3 external volumes"
fi

# 3. PGDATA's parent, not its data directory.
if [[ "$out" == *"source: postgres-data"*"target: /var/lib/postgresql"* ]] &&
  [[ "$out" != *"target: /var/lib/postgresql/data"* ]]; then
  ok "postgres mounts /var/lib/postgresql, preserving the 18/docker layout"
else
  bad "postgres mount path would make initdb run on an empty directory"
fi

# 4. No host ports: Traefik reaches web over the Docker network only.
if [[ "$out" == *"published:"* ]]; then
  bad "a host port is published; it collides with the manual stack at cutover"
else
  ok "no host ports are published"
fi

if [[ "$out" == *"- \"8686\""* ]] || [[ "$out" == *"- 8686"* ]]; then
  ok "web exposes 8686 to the proxy network"
else
  bad "web does not expose 8686; Coolify cannot route to it"
fi

# 5. The seed never reaches a Coolify deployment.
if [[ "$out" == *"seed:"* ]]; then
  bad "the seed service is present; it can create and overwrite accounts"
else
  ok "the seed service is absent from the Coolify definition"
fi

echo " passed: $pass   failed: $fail"
[ "$fail" -eq 0 ]
