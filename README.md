# websoprotelco

SOPROTELCO ecommerce rebuild foundation.

This repository is a local/VPS PostgreSQL rebuild of the SOPROTELCO ecommerce/admin app. The storefront, admin catalog/quote surfaces, local image uploads, Docker/Compose runtime, migration flow, test harness, and server-side auth/RBAC foundation are present. Final deployment hardening, import/cutover work, and production storage decisions still need a separate pass.

## Local setup

Requirements:

- Node.js `24.16.0`
- pnpm `11.9.0`
- Docker with Docker Compose

Install dependencies:

```bash
corepack enable pnpm
pnpm install
```

Create a local environment file from the non-secret example:

```bash
cp .env.example .env
```

The example values are local/test placeholders only. Replace them for any shared, staging, or production environment.

## Core validation

Run these checks before delivery review:

```bash
pnpm lint
pnpm typecheck
pnpm test
docker compose config --quiet
```

Optional runtime checks:

```bash
pnpm build
pnpm test:e2e
```

## Docker Compose

Start the local stack:

```bash
docker compose up --build
```

The web app is exposed on port `8585`, so the local URL is <http://localhost:8585>. By default Compose binds both the web app and PostgreSQL to `127.0.0.1` only.

For a VPS, keep `WEB_HOST=127.0.0.1` when a local reverse proxy (Caddy, nginx, or Traefik) terminates TLS and proxies to `http://127.0.0.1:8585`. Only set `WEB_HOST=0.0.0.0` intentionally, and only with host firewall rules that restrict direct access.

## Database

Start PostgreSQL locally:

```bash
docker compose up db
```

Copy `.env.example` to `.env` (see [Local setup](#local-setup)) so the host-local `DATABASE_URL` is available, then apply pending migrations:

```bash
pnpm db:migrate
```

Two optional variables tune the connection pool. Both have defaults, so neither is required:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_POOL_MAX` | `10` | Maximum pooled connections (1–100). |
| `DATABASE_SSL` | `disable` | Set to `require` to enforce a certificate-verified TLS connection. |

`DATABASE_SSL` defaults to `disable` because the Compose stack reaches PostgreSQL over a private Docker network where TLS adds nothing. That default is only safe while the database is not reachable across an untrusted network.

**Set `DATABASE_SSL=require` on any deployment where the database is a separate host, including a managed provider.** Otherwise the password and all query traffic cross the network in cleartext. This is not enforced in code, because enforcing it would break the local Compose stack.

Under Docker Compose, migrations run automatically as a one-shot `migrate` service that must exit successfully before `web` starts. Nothing extra is needed beyond `docker compose up`.

Compose services use an internal connection string that points at host `db` on the Docker network. Host-side commands such as `pnpm db:migrate` and `pnpm db:create-admin` must instead use `127.0.0.1:${POSTGRES_PORT:-5432}` because the Docker service name `db` is not resolvable from your host shell. The checked-in `.env.example` is intentionally host-local; `compose.yaml` provides the Compose-internal `DATABASE_URL` for the `migrate` and `web` services so automatic migrations continue to work.

Migrations deliberately do **not** run inside the `web` runtime image. That image is the Next.js standalone bundle: it has no TypeScript sources, no `tsx`, and no `zod` (Next bundles `zod` into its server chunks rather than shipping it in `node_modules`). The `migrator` build stage carries the full toolchain instead, which keeps the production image small and free of build-time tooling.

To add a new migration, create a file in `db/migrations/` named with the next zero-padded four-digit number (e.g. `0002_add_orders.sql`). Never edit a migration that has already been applied to any shared environment: the migration runner records a checksum per applied migration and refuses to run if an applied file's content changed.

### Database safety

The reset and seed helpers (`pnpm test:db:reset`, `pnpm test:db:seed`) refuse to run unless `DATABASE_URL` points to a database name ending in `_test`. Do not aim these helpers at shared, staging, or production databases.

`pnpm db:migrate` deliberately does not carry that guard, because it must run against staging and production. It serialises concurrent runs with a PostgreSQL advisory lock and applies each migration in its own transaction.

## Health check

`GET /api/health` returns `{"status":"ok"}` without touching the database; the container `HEALTHCHECK` calls it on port `8585` and relies on this staying cheap.

`GET /api/health?check=db` additionally runs `SELECT 1` and returns `503` with `{"status":"degraded"}` when the database is unreachable.

## Authentication

Bootstrap the first admin user after running migrations. Working from the repository:

```bash
pnpm db:migrate
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=change-me-please pnpm db:create-admin
```

Against a running Compose stack, reuse the `migrate` image — the `web` image cannot run this script:

```bash
docker compose run --rm \
  -e ADMIN_EMAIL=admin@example.com -e ADMIN_PASSWORD=change-me-please \
  migrate pnpm db:create-admin
```

`ADMIN_PASSWORD` must be 12–200 characters; `db:create-admin` upserts the user with role `admin` and never prints the password.

- `/login` signs a user in with email + password.
- `/admin` (and everything under it) requires the `admin:access` permission, enforced server-side in `src/app/admin/layout.tsx`.
- Roles: `admin` (every permission) and `staff` (read the catalog, manage quotes; no admin area, no catalog writes or image uploads).
- Sessions are opaque 32-byte random tokens. Only a SHA-256 hash of the token is stored in the `sessions` table, so a database dump cannot be replayed as a live session. The session cookie is `httpOnly`, `sameSite: lax`, and `secure` outside development. TTL is 7 days.
- Expired sessions are filtered out in SQL on every lookup, but **there is no background cleanup job yet**. `deleteExpiredSessions()` in `src/server/auth/session.ts` exists for this purpose and must be scheduled (e.g. a periodic job or cron) during deployment hardening.
- Not implemented in this slice — tracked as TODOs for a later hardening pass: password reset, email verification, MFA, and rate limiting on `/login`.

### The deployment must terminate TLS

Outside development the session cookie is set with the `Secure` attribute, so **browsers will discard it over plain HTTP**. Deploying to a VPS on `http://` produces a silent login loop: the credentials are accepted, the session row is created, and the browser then throws the cookie away.

Serve the app over HTTPS (a reverse proxy such as Caddy, nginx, or Traefik terminating TLS is enough). `localhost` development over HTTP is unaffected, because `NODE_ENV=development` disables the `Secure` attribute.

## Advisory note

The lockfile includes `postcss@8.4.31` through `next@16.2.10`. This is transitive through Next, so this slice documents the advisory instead of forcing a risky dependency override. Revisit when Next publishes a safe patched dependency path or after verifying an override in CI and Docker.

## Client-delivery gap

This branch is close to a local demo slice, not final production delivery. The remaining blockers are legacy data/import validation, scheduling `deleteExpiredSessions()`, production storage/handoff configuration, VPS TLS/reverse-proxy documentation, and cutover/rollback documentation.
