#!/usr/bin/env bash
# A staging stack on the production VPS shares one Docker daemon with production.
#
# Compose namespaces containers, networks and volumes by PROJECT, but it does not namespace
# published ports and it does not stop two projects from naming the same volume. So "staging"
# that keeps the production project name does not merely collide — it mounts the production
# uploads volume and points at the production database, which the rollback path drops and
# recreates. That is a data-loss path, not a test inconvenience.
#
# This contract renders both configurations and asserts they are disjoint. It never contacts a
# VPS, never starts a container, and never writes to any volume: `docker compose config` only
# resolves the model.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

pass=0; fail=0
ok()  { echo "  ok   — $1"; pass=$((pass + 1)); }
bad() { echo "  FAIL — $1"; fail=$((fail + 1)); }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

PRODUCTION_ENV="$WORK/.env.production"
STAGING_ENV="$WORK/.env.staging"

# Production baseline: the committed example, which is what an operator starts from.
cp "$ROOT/.env.example" "$PRODUCTION_ENV"
cp "$ROOT/.env.staging.example" "$STAGING_ENV"

# `docker compose config` refuses to resolve when a required variable is unset.
printf '\nSTORAGE_PROVIDER=local\n' >> "$PRODUCTION_ENV"
printf '\nSTORAGE_PROVIDER=local\n' >> "$STAGING_ENV"

render() {
  local env_file="$1" out="$2"
  ( cd "$ROOT" && docker compose --env-file "$env_file" -f compose.yaml config --format json ) > "$out" 2> "$out.err"
}

if ! render "$PRODUCTION_ENV" "$WORK/production.json"; then
  bad "the production configuration does not resolve"
  sed 's/^/    /' "$WORK/production.json.err" | head -10
fi
if ! render "$STAGING_ENV" "$WORK/staging.json"; then
  bad "the staging configuration does not resolve"
  sed 's/^/    /' "$WORK/staging.json.err" | head -10
fi

# Extracts one facet of a rendered model as newline-separated values.
facet() {
  node -e '
    const fs = require("node:fs");
    const emit = (file, facet) => {
      const model = JSON.parse(fs.readFileSync(file, "utf8"));
      if (facet === "project") return String(model.name ?? "");
      if (facet === "volumes" || facet === "networks") {
        return Object.entries(model[facet] ?? {})
          .map(([key, value]) => value?.name ?? key)
          .sort()
          .join("\n");
      }
      if (facet === "ports") {
        const published = [];
        for (const service of Object.values(model.services ?? {})) {
          for (const port of service.ports ?? []) {
            if (port.published) published.push(String(port.published));
          }
        }
        return published.sort().join("\n");
      }
      return "";
    };
    process.stdout.write(emit(process.argv[1], process.argv[2]));
  ' "$1" "$2"
}

production_project="$(facet "$WORK/production.json" project)"
staging_project="$(facet "$WORK/staging.json" project)"

if [ -n "$staging_project" ] && [ "$production_project" != "$staging_project" ]; then
  ok "staging uses a different Compose project ($production_project vs $staging_project)"
else
  bad "staging shares the production Compose project name"
fi

# Volumes and networks are project-prefixed, so a distinct project makes them disjoint. Asserting
# it directly is what proves staging cannot mount production's uploads or database.
for facet_name in volumes networks; do
  facet "$WORK/production.json" "$facet_name" > "$WORK/production.$facet_name"
  facet "$WORK/staging.json" "$facet_name" > "$WORK/staging.$facet_name"
  shared="$(comm -12 "$WORK/production.$facet_name" "$WORK/staging.$facet_name" | grep -c . || true)"
  if [ "$shared" -eq 0 ]; then
    ok "production and staging share no $facet_name"
  else
    bad "production and staging share $shared $facet_name"
    comm -12 "$WORK/production.$facet_name" "$WORK/staging.$facet_name" | sed 's/^/    /'
  fi
done

# Ports are the one resource Compose does not namespace.
facet "$WORK/production.json" ports > "$WORK/production.ports"
facet "$WORK/staging.json" ports > "$WORK/staging.ports"
shared_ports="$(comm -12 "$WORK/production.ports" "$WORK/staging.ports" | grep -c . || true)"
if [ "$shared_ports" -eq 0 ]; then
  ok "production and staging publish no common port"
else
  bad "production and staging both publish $shared_ports port(s)"
  comm -12 "$WORK/production.ports" "$WORK/staging.ports" | sed 's/^/    /'
fi

# The disposable Compose smoke owns 8687. Staging must not take it either.
if ! grep -qx '8687' "$WORK/staging.ports"; then
  ok "staging does not take the disposable smoke port 8687"
else
  bad "staging publishes 8687, which the Compose smoke owns"
fi

if grep -qx '8686' "$WORK/production.ports"; then
  ok "production still publishes 8686"
else
  bad "production no longer publishes 8686"
fi

# A staging stack pointed at the production database name would be destroyed by, or destroy,
# production state on the next rollback.
production_db="$(grep -E '^POSTGRES_DB=' "$PRODUCTION_ENV" | cut -d= -f2-)"
staging_db="$(grep -E '^POSTGRES_DB=' "$STAGING_ENV" | cut -d= -f2-)"
if [ -n "$staging_db" ] && [ "$production_db" != "$staging_db" ]; then
  ok "staging uses a different database name"
else
  bad "staging points at the production database name"
fi

# Staging must stay unreachable from the internet: it has no TLS front and carries test data.
if grep -qE '^WEB_HOST=127\.0\.0\.1$' "$STAGING_ENV"; then
  ok "staging binds to loopback only"
else
  bad "staging is not restricted to loopback"
fi

# The example must not ship a usable secret.
if grep -qE '^POSTGRES_PASSWORD=CHANGE_ME' "$STAGING_ENV"; then
  ok "the staging example ships no real credential"
else
  bad "the staging example may contain a real credential"
fi

echo
echo "=================================="
echo " passed: $pass   failed: $fail"
echo "=================================="
[ "$fail" -eq 0 ]
