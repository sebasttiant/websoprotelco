#!/usr/bin/env bash
# Read-only audit of the WEBSOPROTELCO production stack.
#
# Mutates nothing: no up/down/restart/prune/rm/volume operations.
# Secret VALUES are never printed; only variable names are listed.
# The only thing written is a timestamped report under /root/soprotelco-audit/.
#
# Usage on the VPS:  bash /root/vps-audit.sh

set -uo pipefail

OUT="/root/soprotelco-audit/report-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"
PROJECT_DIR="/opt/docker/websoprotelco"

section() { echo; echo "===== $* ====="; }
run() { echo; echo "\$ $*"; "$@" 2>&1 || echo "[exit $?]"; }
sh_run() { echo; echo "\$ $1"; bash -lc "$1" 2>&1 || echo "[exit $?]"; }
# Keys only: never print the values of container environment variables.
env_keys() {
  docker inspect "$1" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null |
    cut -d= -f1 | sort
}

{
  section "01 HOST"
  run uname -a
  run cat /etc/debian_version
  run df -h
  run free -h
  run nproc
  run uptime
  run docker version --format '{{.Server.Version}}'
  run docker compose version

  section "02 ALL CONTAINERS (full inventory; non-soprotelco must stay untouched)"
  run docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}'

  section "03 SOPROTELCO CONTAINERS"
  run docker ps -a --filter name=websoprotelco --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}'
  for c in websoprotelco-web-1 websoprotelco-db-1; do
    run docker inspect "$c" --format 'Name={{.Name}} State={{.State.Status}} Health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} Restarts={{.RestartCount}} Image={{.Config.Image}} Started={{.State.StartedAt}}'
    run docker inspect "$c" --format 'MOUNTS:{{range .Mounts}}{{println "" .Type .Name .Source "->" .Destination "rw=" .RW}}{{end}}'
    run docker inspect "$c" --format 'NETWORKS:{{range $k,$v := .NetworkSettings.Networks}}{{println "" $k "ip=" $v.IPAddress "aliases=" $v.Aliases}}{{end}}'
    run docker inspect "$c" --format 'PORTS:{{range $p,$b := .NetworkSettings.Ports}}{{println "" $p $b}}{{end}}'
    run docker inspect "$c" --format 'RestartPolicy={{.HostConfig.RestartPolicy.Name}} LogDriver={{.HostConfig.LogConfig.Type}} LogOpts={{.HostConfig.LogConfig.Config}}'
    run docker inspect "$c" --format 'LABELS:{{range $k,$v := .Config.Labels}}{{println "" $k "=" $v}}{{end}}'
    echo
    echo "ENV KEYS ONLY for $c (values intentionally omitted):"
    env_keys "$c"
  done

  section "04 VOLUMES"
  run docker volume ls
  for v in postgres-data uploads-data documents-data; do
    run docker volume inspect "websoprotelco_${v}"
    p="/var/lib/docker/volumes/websoprotelco_${v}/_data"
    echo
    echo "\$ ls -la $p (first 25 entries)"
    ls -la "$p" 2>&1 | head -n 25
    echo
    echo "\$ du -sh $p"
    timeout 180 du -sh "$p" 2>&1 || echo "[du timed out or failed]"
  done

  section "05 NETWORKS"
  run docker network ls
  run docker network inspect coolify --format 'coolify members:{{range .Containers}}{{println "" .Name}}{{end}}'
  run docker network inspect websoprotelco_default --format 'websoprotelco_default members:{{range .Containers}}{{println "" .Name}}{{end}}'

  section "06 PRODUCTION COMPOSE ON DISK"
  run ls -la "$PROJECT_DIR"
  run cat "$PROJECT_DIR/compose.yaml"
  echo
  echo "\$ .env KEYS ONLY (values intentionally omitted)"
  if [ -f "$PROJECT_DIR/.env" ]; then
    grep -oE '^[A-Za-z_][A-Za-z0-9_]*' "$PROJECT_DIR/.env" | sort
  else
    echo "[no .env present]"
  fi
  sh_run "cd '$PROJECT_DIR' && docker compose config --no-interpolate"
  sh_run "cd '$PROJECT_DIR' && docker compose ps --all"
  run git -C "$PROJECT_DIR" rev-parse HEAD
  run git -C "$PROJECT_DIR" status --porcelain
  run git -C "$PROJECT_DIR" log --oneline -5

  section "07 POSTGRES HEALTH (read-only queries only)"
  run docker exec websoprotelco-db-1 sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
  run docker exec websoprotelco-db-1 sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select version()"'
  run docker exec websoprotelco-db-1 sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "show data_directory"'
  run docker exec websoprotelco-db-1 sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select datname, pg_size_pretty(pg_database_size(datname)) from pg_database order by 1"'
  run docker exec websoprotelco-db-1 sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select schemaname, relname, n_live_tup from pg_stat_user_tables order by n_live_tup desc limit 25"'
  run docker exec websoprotelco-db-1 sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select count(*) as active_backends from pg_stat_activity"'
  run docker exec websoprotelco-db-1 sh -lc 'ls -la /var/lib/postgresql'

  section "08 APP PAYLOAD (read-only)"
  run docker exec websoprotelco-web-1 sh -lc 'ls -la /app/data/uploads | head -n 20; echo; ls -la /app/data/documents | head -n 20'
  run docker exec websoprotelco-web-1 sh -lc 'id; stat -c "%U:%G %a %n" /app/data/uploads /app/data/documents'
  run docker exec coolify-proxy sh -lc 'wget -qS -O /dev/null http://websoprotelco-web-1:8686/ 2>&1 | head -n 15'

  section "09 TRAEFIK / PROXY"
  run docker inspect coolify-proxy --format 'Image={{.Config.Image}} State={{.State.Status}} Restarts={{.RestartCount}}'
  run docker inspect coolify-proxy --format 'MOUNTS:{{range .Mounts}}{{println "" .Source "->" .Destination}}{{end}}'
  run ls -laR /data/coolify/proxy/dynamic
  for f in /data/coolify/proxy/dynamic/*.y*ml; do
    [ -f "$f" ] || continue
    echo
    echo "--- $f"
    cat "$f"
  done
  run docker logs --tail 80 coolify-proxy

  section "10 PUBLIC SURFACE + DNS (external, read-only)"
  run ss -tulpn
  for u in https://soprotelco.com https://www.soprotelco.com; do
    echo
    echo "\$ curl $u"
    curl -sS -o /dev/null -w 'http=%{http_code} ssl_verify=%{ssl_verify_result} time=%{time_total}\n' --max-time 15 "$u" 2>&1
  done
  sh_run "echo | openssl s_client -connect soprotelco.com:443 -servername soprotelco.com 2>/dev/null | openssl x509 -noout -subject -issuer -dates"
  run dig +short soprotelco.com A
  run dig +short www.soprotelco.com
  run dig +short soprotelco.com MX
  run dig +short mail.soprotelco.com A
  run dig +short soprotelco.com TXT
  run dig +short NS soprotelco.com

  section "11 COOLIFY STATE"
  run docker ps -a --filter name=coolify --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'
  run docker logs --tail 60 coolify

  section "12 BACKUP SURFACE"
  run ls -la /root
  run ls -la /var/backups
  run ls -la /opt/backups
  run crontab -l
  run systemctl list-timers --all --no-pager
} >"$OUT/audit.txt" 2>&1

# Defence in depth: redact anything secret-shaped that slipped through.
sed -i -E \
  -e 's/((PASSWORD|SECRET|TOKEN|APIKEY|API_KEY|PRIVATE_KEY|PASSWD)[A-Z0-9_]*[=:][[:space:]]*)[^[:space:]]+/\1***REDACTED***/Ig' \
  -e 's#(postgres(ql)?://[^:/@]+:)[^@]+@#\1***REDACTED***@#Ig' \
  "$OUT/audit.txt"

echo "Report written to: $OUT/audit.txt"
wc -l "$OUT/audit.txt"
