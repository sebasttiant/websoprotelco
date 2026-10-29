# Migrating the production deployment to Coolify

Moving WEBSOPROTELCO from the manual `./deploy.sh` stack to Coolify-managed
deployments driven by `main`.

The site is live and holds real customer data. This runbook keeps that data and
treats every destructive step as something that must be authorised, reversible,
and verified.

## What makes this risky

Four facts drive every decision below. They were established by auditing the
running server and by a cutover that failed twice before it succeeded, not by
assumption.

**Coolify renames volumes.** It prefixes compose-declared volumes with the
application UUID. The application `websoprotelco-production`
(`eejuwo2zlbhdmv1bvig4waed`) has already registered
`eejuwo2zlbhdmv1bvig4waed_postgres-data`, `_uploads-data` and
`_documents-data`. Deploying `compose.yaml` as-is creates three **empty**
volumes at the correct mount paths. Postgres runs `initdb`, the site serves an
empty database, and the real data stays untouched but unreachable in
`websoprotelco_postgres-data`. `compose.coolify.yaml` fixes this with
`external: true`.

**`external: true` alone is not enough.** Coolify 4.5.3 keeps a
`local_persistent_volumes` row per volume. When such a row exists with the
generated `{uuid}_{volume}` name, `useComposeExternalVolumeAsWritten()` in
`bootstrap/helpers/parsers.php` deliberately **ignores** the external
declaration and keeps the generated name, so the resource does not lose data it
wrote under the old name. The first cutover attempt did exactly that: the
processed compose declared `external: true` at the top level, while the
services still mounted `eejuwo2zlbhdmv1bvig4waed_*`. Deleting those metadata
rows (step 0) is what makes the external declaration take effect. Deleting a
row removes Coolify metadata only; it never removes a Docker volume.

**Two Postgres processes cannot share one PGDATA.** Once the volume is
external, starting the Coolify stack while the manual stack runs gives two
`postgres` processes the same data directory. That corrupts the cluster. The
cutover therefore has one valid order: stop the old stack first. A short
interruption is unavoidable.

**PGDATA is nested.** `postgres:18` keeps data at
`/var/lib/postgresql/18/docker`, and the production volume holds that layout.
The mount target is `/var/lib/postgresql`, never `/var/lib/postgresql/data`.
Changing it makes Postgres initialise an empty cluster.

## Preconditions

- [ ] `main` contains `compose.coolify.yaml`, merged through a PR.
- [ ] `bash tests/deploy/compose-coolify-contract.sh` passes.
- [ ] Coolify Compose location is `/compose.coolify.yaml`, not `/compose.yaml`.
- [ ] Every environment variable below is set in Coolify.
- [ ] No `local_persistent_volumes` rows remain for the application, and the
      **processed** compose mounts the production volumes (step 0).
- [ ] No container carries `coolify.applicationUuid=<uuid>`, running or stopped.
- [ ] A fresh backup is taken and verified (step 2).
- [ ] The Docker guard is paused (step 3).
- [ ] Auto Deploy is OFF. It is enabled only after a verified cutover.

## 0. Clear the legacy storage metadata

Skip this and the deployment silently mounts empty `{uuid}_*` volumes even
though the Compose file says `external: true`. Back the rows up first; they
carry no application secrets.

```bash
docker exec coolify-db psql -U coolify -d coolify -AtF '|' -c \
  "select id,name,mount_path,uuid from local_persistent_volumes
   where resource_type='App\\Models\\Application' and resource_id=<id>" \
  > /root/soprotelco-cutover/storage-metadata.before-delete.txt

docker exec coolify php artisan tinker --execute='
  $a=App\Models\Application::findOrFail(<id>);
  foreach($a->persistentStorages()->get() as $row){ $row->delete(); }
  $a->loadComposeFile();
  echo "reparsed\n";
'
```

Then verify the **processed** compose, not the raw file. The raw file is what
the repository says; the processed one is what Docker will actually run.

```bash
docker exec coolify php artisan tinker --execute='
  $c=parseDockerComposeYaml(App\Models\Application::findOrFail(<id>)->docker_compose);
  echo json_encode([
    "db"=>data_get($c,"services.db.volumes"),
    "web"=>data_get($c,"services.web.volumes"),
    "volumes"=>data_get($c,"volumes"),
  ], JSON_PRETTY_PRINT)."\n";
'
```

Every service entry must read `postgres-data:`, `uploads-data:` or
`documents-data:`. A `eejuwo2zlbhdmv1bvig4waed_` prefix anywhere means a
metadata row survived: stop and fix it before touching production.

## 1. Environment variables

Set these under **Environment Variables** on the application. Values come from
`/opt/docker/websoprotelco/.env` on the server. Never commit them, never paste
them into a chat or an issue.

| Variable | Required | Notes |
| --- | --- | --- |
| `POSTGRES_DB` | yes | Must match the existing cluster exactly |
| `POSTGRES_USER` | yes | Must match the existing cluster exactly |
| `POSTGRES_PASSWORD` | yes | Must match the existing cluster exactly |
| `STORAGE_PROVIDER` | yes | `local` — files live on the mounted volumes |
| `DATABASE_SSL` | no | Defaults to `disable`; traffic never leaves the host |
| `DATABASE_POOL_MAX` | no | Defaults to 10 for `web`, 5 for `migrate` |
| `SESSION_COOKIE_SECURE` | no | **Leave empty.** Traefik terminates TLS |

Do not copy `SESSION_COOKIE_SECURE` from the server `.env`. The manual stack
sets it to `false` because it published `0.0.0.0:8686` for plain-HTTP access.
Under Coolify every request arrives over TLS, so the value must be empty and
the session cookie must come back `Secure`. Verify it after the first
deployment instead of trusting the setting:

```bash
curl -sSi -X POST https://soprotelco.com/login | grep -i '^set-cookie: session'
```

`DATABASE_URL` is derived inside the compose file from the three `POSTGRES_*`
values, so the credentials cannot drift apart. Do not set it separately.

`ADMIN_EMAIL` and `ADMIN_PASSWORD` are **not** needed. They exist for
`deploy.sh`'s admin-creation step, which stays a manual, audited operation.

A wrong `POSTGRES_USER` or `POSTGRES_PASSWORD` does not fail loudly: Postgres
starts, the existing cluster ignores the mismatched values, and the application
fails to authenticate. Copy them, do not retype them.

## 2. Fresh verified backup

`deploy.sh` writes backups to `/opt/docker/websoprotelco/backups/`, but only
when it runs. At audit time the newest set was ~40 hours old and missed two
uploaded images. It also lives on the same disk, inside the directory being
changed. Take a fresh one, outside that tree.

```bash
mkdir -p /root/soprotelco-cutover && cd /root/soprotelco-cutover
TS=$(date +%Y%m%d-%H%M%S)

docker exec websoprotelco-db-1 sh -lc \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "db-$TS.dump"
echo "pg_dump exit: $?"

for v in uploads-data documents-data postgres-data; do
  docker run --rm -v "websoprotelco_$v:/src:ro" \
    -v "/root/soprotelco-cutover:/dst" \
    alpine tar -czf "/dst/$v-$TS.tar.gz" -C /src .
  echo "$v tar exit: $?"
done

cp -a /data/coolify/proxy/dynamic "traefik-dynamic-$TS"
git -C /opt/docker/websoprotelco rev-parse HEAD > "deployed-sha-$TS"
docker images --no-trunc --format '{{.Repository}}:{{.Tag}} {{.ID}}' \
  | grep websoprotelco > "images-$TS"

sha256sum ./*-"$TS".* > "checksums-$TS.txt"
```

Verify before trusting it. A dump that cannot be listed is not a backup.

```bash
docker run --rm -v /root/soprotelco-cutover:/b:ro postgres:18 \
  pg_restore --list "/b/db-$TS.dump" | tail -n 20
sha256sum -c "checksums-$TS.txt"
```

The `postgres-data` tarball is taken while Postgres is running, so it is a
crash-consistent filesystem copy, not a clean snapshot. The authoritative
database backup is `db-$TS.dump`. The tarball exists only as a last resort.

For a restore rehearsal that touches nothing live, see
[Rehearsing the restore](#rehearsing-the-restore).

## 3. Pause the Docker guard

`/opt/docker/scripts/docker_guard_vps_coolify.sh` runs every 6 hours from both
cron and `docker-guard.timer`. In `auto` mode it never removes volumes — that
was verified by reading it. But at or above 80% disk it runs:

```bash
docker container prune -f   # removes the stopped rollback containers
docker network prune -f     # removes websoprotelco_default once it empties
```

and at or above 88% it runs `docker image prune -a -f --filter until=24h`.
The cron overrides the script's own 336h (14-day) rollback window with `24h`.
`websoprotelco-web` is built locally and exists in no registry: if it is pruned
while stopped, rollback means rebuilding, not restoring.

Disk sat at 50% during the audit, below the 70% warn threshold, so the guard
exits immediately. A Next.js build during the cutover window moves that number.
Pause it rather than bet on timing.

```bash
systemctl stop docker-guard.timer
systemctl disable docker-guard.timer
crontab -l > /root/soprotelco-cutover/crontab.bak
crontab -l | sed 's#^0 \*/6 .*docker_guard_vps_coolify.*#\# PAUSED FOR CUTOVER: &#' | crontab -
crontab -l | grep -n docker_guard
```

Restoring it is step 8. It is not optional.

## 4. Pre-build the images without starting services

The interruption is dominated by the Next.js build, not by the data. Populate
the host's BuildKit cache before stopping anything, but **never press Deploy**
for this step. Once Coolify reads `compose.coolify.yaml`, a deployment can
start its Postgres against the external production volume even while the
manual Postgres is still running. A missing domain does not prevent that.

Update the server checkout to the reviewed merge commit, validate the rendered
compose file, then run only the build subcommand. `build` creates images and
cache layers; it does not create or start containers.

```bash
cd /opt/docker/websoprotelco
git fetch origin main
git switch main
git pull --ff-only origin main

docker compose --env-file .env -f compose.coolify.yaml config --quiet
docker compose --env-file .env -f compose.coolify.yaml build migrate web
```

Compose parses `.env` itself, so passwords containing shell metacharacters are
not reinterpreted by `source`, `xargs` or `eval`. Neither command prints the
resolved values.

Confirm no Coolify container is running before continuing:

```bash
docker ps --filter "name=eejuwo2zlbhdmv1bvig4waed" \
  --format '{{.Names}} {{.Status}}'
```

That command must print nothing. If it prints a container, stop and
investigate: a Coolify Postgres must never run beside the manual one.

## 5. Cutover

Each step is reversible until step 5.4. Announce a maintenance window first.

**5.1 — Stop the manual stack.** `stop`, never `down`. `down` removes
containers and the network, discarding the fastest rollback path.

```bash
cd /opt/docker/websoprotelco
docker compose stop web
docker compose stop db
docker compose ps --all
```

Both must read `Exited`. The containers still exist — that is the point.

**5.2 — Confirm the volumes survived.**

```bash
docker volume ls | grep websoprotelco_
du -sh /var/lib/docker/volumes/websoprotelco_postgres-data/_data
```

Expect all three volumes and roughly 64 MB. If anything is missing, stop and
restore from step 2 before going further.

**5.3 — Hand the domain to Coolify.** In the UI: **Add Domain** →
`https://soprotelco.com`, port `8686`. Add `https://www.soprotelco.com` as a
second domain. Then remove the file-provider router that points at the old
container, so two providers never claim the same Host rule:

```bash
mv /data/coolify/proxy/dynamic/websoprotelco.yaml \
   /root/soprotelco-cutover/websoprotelco.yaml.disabled
```

Traefik watches that directory and reloads on its own. Do not restart the
proxy: it serves every other site on this host.

**5.4 — Deploy.** Press **Deploy**. Watch Deployment Logs. The `migrate`
service must complete before `web` starts; migrations are serialised by a
Postgres advisory lock, so a concurrent run waits rather than corrupting the
schema.

## 6. Verification

HTTP 200 on the homepage proves almost nothing. Check all of it.

Select containers by Coolify's own label, never by a guessed name. Coolify
names each container `<service>-<uuid>-<timestamp>`, so the timestamp changes
on every deployment, and the label is `coolify.applicationUuid` — there is no
`coolify.applicationId` label on a container.

```bash
UUID=eejuwo2zlbhdmv1bvig4waed
docker ps -a --filter "label=coolify.applicationUuid=$UUID" \
  --format '{{.Names}}\t{{.Status}}'

# The new containers must hold the production volumes, not UUID-prefixed ones.
docker ps -q --filter "label=coolify.applicationUuid=$UUID" \
  | xargs -r docker inspect \
      -f '{{.Name}}{{range .Mounts}} {{.Name}}->{{.Destination}}{{end}}'
```

Every volume name printed must start with `websoprotelco_`. A name starting
with `eejuwo2zlbhdmv1bvig4waed_` means the deployment used empty volumes: stop,
roll back (step 7), and clear the storage metadata (step 0).

Orphan `{uuid}_*` volumes may still exist from an earlier attempt. They are
harmless while no running container mounts them. The mounts above are the
authority, not `docker volume ls`. Never delete a volume during a cutover.

```bash
# Row counts must match the pre-cutover numbers exactly, not merely be non-zero.
db_id=$(docker ps -q --filter "label=coolify.applicationUuid=$UUID" \
  --filter 'label=com.docker.compose.service=db')
docker exec "$db_id" \
  sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
    "select relname, n_live_tup from pg_stat_user_tables order by relname"'

curl -sS -o /dev/null -w 'root  %{http_code} ssl=%{ssl_verify_result}\n' \
  https://soprotelco.com
curl -sS -o /dev/null -w 'www   %{http_code} ssl=%{ssl_verify_result}\n' \
  https://www.soprotelco.com
curl -sS -o /dev/null -w 'upload %{http_code}\n' "$KNOWN_UPLOAD_URL"
curl -sS -o /dev/null -w 'doc    %{http_code}\n' "$KNOWN_DOCUMENT_URL"
```

`KNOWN_UPLOAD_URL` and `KNOWN_DOCUMENT_URL` are in the server `.env`; the
manual `deploy.sh` uses them for the same purpose. They prove the volumes are
mounted and served, which a homepage request does not.

Then, by hand in a browser:

- [ ] Log in as an admin. Sessions depend on the cookie staying `Secure`.
- [ ] A product page renders with its image.
- [ ] Upload a new image and confirm it persists after a page reload.
- [ ] Download a document.
- [ ] Submit a quote request (a write path through the database).

And confirm nothing else moved:

```bash
docker ps --format '{{.Names}}\t{{.Status}}' | grep -vE 'websoprotelco|eejuwo'
dig +short soprotelco.com MX
dig +short mail.soprotelco.com A
```

When comparing against a pre-cutover container list, exclude both the manual
`websoprotelco-*` names **and** the application UUID. A container from an
earlier attempt is not an unrelated service, and treating it as one reports a
false failure.

The mail records must still read `0 mail.soprotelco.com.` and
`95.216.181.83`. Mail stays on the previous host and is out of scope; this
check exists to prove the migration did not touch it.

## 7. Rollback

Rollback is fast because the old containers were stopped, not removed.

```bash
UUID=eejuwo2zlbhdmv1bvig4waed

# 7.1 Cancel the deployment first, then remove every container it owns.
#     Stopping containers while the queue still runs lets the worker recreate
#     them seconds later, beside the manual Postgres, on the same PGDATA.
docker exec coolify php artisan tinker --execute='
  $d=App\Models\ApplicationDeploymentQueue::where("deployment_uuid","<uuid>")->first();
  if ($d && in_array($d->status,["queued","in_progress"],true)) {
    $d->update(["status"=>"cancelled-by-user"]);
    App\Actions\Application\CleanupCancelledDeployment::run($d,(int)$d->application->team()->id);
  }
  echo $d?->status."\n";
'
docker rm -f $(docker ps -aq --filter "label=coolify.applicationUuid=$UUID")
[ -z "$(docker ps -aq --filter "label=coolify.applicationUuid=$UUID")" ] || exit 1

# 7.2 Restart the manual containers directly.
#     NOT `docker compose start web`: that resolves depends_on and fails with
#     "web is missing dependency migrate", because `migrate` is a one-shot
#     container that no longer exists after the Coolify deployment.
docker start websoprotelco-db-1
docker start websoprotelco-web-1
docker inspect websoprotelco-web-1 --format '{{.State.Health.Status}}'

# 7.3 Restore the Traefik router only after the target is healthy.
#     A router pointing at a dead service is worse than no router.
mv /root/soprotelco-cutover/websoprotelco.yaml.disabled \
   /data/coolify/proxy/dynamic/websoprotelco.yaml
```

Then remove the domains from the Coolify application, so its labels stop
claiming the Host rule.

**Returning to the previous commit does not restore the database.** If
migrations changed the schema and the application has to go back, the database
has to be restored too — and that is a separate, explicitly authorised
operation, because it discards everything written since the dump:

```bash
# DESTRUCTIVE. Only with explicit authorisation, and only after confirming
# which writes will be lost.
docker exec -i websoprotelco-db-1 sh -lc \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' \
  < /root/soprotelco-cutover/db-<TS>.dump
```

## Rehearsing the restore

Prove the dump restores before the cutover, against a throwaway container on a
throwaway volume. This touches neither production container nor production
volume.

```bash
docker run -d --name restore-rehearsal \
  -e POSTGRES_DB=rehearsal -e POSTGRES_USER=rehearsal \
  -e POSTGRES_PASSWORD="$(openssl rand -hex 16)" \
  -v rehearsal-data:/var/lib/postgresql \
  postgres:18

sleep 10
docker exec -i restore-rehearsal \
  pg_restore -U rehearsal -d rehearsal --clean --if-exists \
  < /root/soprotelco-cutover/db-<TS>.dump

docker exec restore-rehearsal psql -U rehearsal -d rehearsal \
  -c "select relname, n_live_tup from pg_stat_user_tables \
      order by n_live_tup desc limit 10"
```

Compare those counts with production. Then clean up the rehearsal only — these
two names, never a `prune`:

```bash
docker rm -f restore-rehearsal
docker volume rm rehearsal-data
```

## 8. Restore the Docker guard

```bash
systemctl enable --now docker-guard.timer
crontab /root/soprotelco-cutover/crontab.bak
crontab -l | grep docker_guard
systemctl list-timers docker-guard.timer --no-pager
```

Consider raising `--until 24h` back toward the script's own `336h` default, so
a prune cannot destroy the only copy of a locally built rollback image. That is
a separate change, proposed on its own.

## 9. Enable automatic deployment

Only after a cutover that passed every check in step 6, and after at least one
manual redeploy from Coolify that kept the data intact.

Turn on **Auto Deploy** for branch `main`. The flow becomes:

```text
feature branch → PR → CI → merge to main → Coolify webhook → production
```

Branch protection on `main` is what keeps an unreviewed push from reaching
production. Without it, Auto Deploy means any push deploys.

Auto Deploy is on by default on a new Coolify application. Turn it **off**
before a cutover and back on afterwards, so a push cannot start a deployment
in the middle of the window.

```bash
docker exec coolify php artisan tinker --execute='
  $a=App\Models\Application::findOrFail(<id>);
  $a->settings->is_auto_deploy_enabled=true;   # false before a cutover
  $a->settings->save();
  echo ($a->settings->fresh()->is_auto_deploy_enabled?"on":"off")."\n";
'
```

The GitHub App must have a webhook secret, or Coolify rejects every delivery:

```bash
docker exec coolify-db psql -U coolify -d coolify -AtF '|' -c \
  "select name, app_id, installation_id, webhook_secret is not null
   from github_apps where id=(select source_id from applications where id=<id>)"
```

The flag, the secret and a reachable endpoint are necessary but not sufficient.
Only a real merge to `main` proves the delivery path end to end.

## Known follow-ups

Found during the audit, outside this migration's scope. Each needs its own
change.

- **ACME renewal is failing.** Traefik logs `Cannot retrieve the ACME
  challenge` for `soprotelco.com` and `www` every three hours. The current
  certificate is valid until 2027-01-26, so this is not urgent, but unattended
  it ends in an expired certificate. Re-check after the cutover: routing
  through Coolify-managed routers may resolve it.
- **Port 8686 is public.** The manual stack publishes `0.0.0.0:8686`, letting
  anyone bypass TLS. `compose.coolify.yaml` publishes no host port, which
  closes it — but only once the manual stack is retired for good.
- **Webmin on 10000 and the Traefik dashboard on 8080** are reachable from the
  Internet. Unrelated to this migration; worth their own review.
- **Build artefacts litter the production directory.** Around 30 empty files
  named `Building`, `Creating`, `sha256:...` from a redirected build log. Safe
  to delete, untracked, cosmetic.
- **Orphan `{uuid}_*` volumes** remain from the first attempt, holding an empty
  cluster and no files. Nothing mounts them. Remove them only outside a cutover
  window, one explicit name at a time, never with `docker volume prune`.
- **The manual stack is still on disk**, stopped, at
  `/opt/docker/websoprotelco`. Keep it until Coolify has run unattended for a
  while: it is the fastest rollback path and the only copy of the previously
  deployed image.

## What actually went wrong

Kept because the next migration will hit the same walls.

**Attempt 1 silently used empty volumes.** `external: true` was in the Compose
file and in the parsed top-level `volumes`, but the services still mounted
`{uuid}_*`, because `local_persistent_volumes` rows from the initial import
overrode it (see step 0). The deployment reported success. No data was lost:
the manual stack still held the production volumes, and the two Postgres
processes never shared a data directory.

**Attempt 1's rollback failed safely.** `docker compose start web` refused with
`web is missing dependency migrate`, so the router was deliberately not
restored to a dead service and the script exited non-zero. Recovery was
`docker start` on the two existing containers, then the router (see step 7).

**Attempt 2 aborted in preflight.** `KNOWN_UPLOAD_URL` is a path, not a URL,
so `curl` rejected it. Nothing in production had been touched yet. The checks
now prefix `https://soprotelco.com`.

**Attempt 3 succeeded** after step 0 cleared the metadata and the leftover
containers were removed. Every one of the 15 table counts matched the
pre-cutover snapshot exactly.
