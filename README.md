# websoprotelco

SOPROTELCO ecommerce rebuild: a Next.js storefront and `/admin` back office on PostgreSQL, deployed with Docker Compose to a single VPS.

**Status.** This is a hardened rebuild, **not a statement that it is ready for production traffic**. What is verified is limited to the checks listed in [Validation](#validation) and the observations in [Known limitations](#known-limitations). Credential rotation, TLS, reverse proxy, legacy data import and cutover remain operator work (see [Operator responsibilities](#operator-responsibilities)).

## Stack

Versions are pinned in `package.json`, `.nvmrc`, `Dockerfile` and `.github/workflows/ci.yml`. A test (`tests/foundation/docs-contract.test.ts`) fails if this table stops matching `package.json`.

| Piece | Version |
| --- | --- |
| Node.js `24.22.0` | `.nvmrc`, `engines.node`, Docker base image, CI |
| pnpm `12.14.0` | `packageManager`, `engines.pnpm`, CI |
| Next.js `16.4.2` | App Router, `output: "standalone"` |
| React `19.3.1` | with `react-dom` |
| TypeScript `6.0.3` | kept on 6.x: TypeScript 7 breaks `eslint-config-next`'s peers |
| PostgreSQL 18 | `postgres:18` in `compose.yaml` and CI |

`AGENTS.md` warns that this Next.js has breaking changes. Read the matching guide in `node_modules/next/dist/docs/` before changing framework-level code.

## Quick start

```bash
corepack enable pnpm
pnpm install
cp .env.example .env          # host-local placeholders; replace for any shared environment
# `STORAGE_PROVIDER=local` must be set in .env or exported; Compose has no default (see below)
docker compose up db          # PostgreSQL on 127.0.0.1:${POSTGRES_PORT:-5432}
pnpm db:migrate
pnpm dev                      # http://127.0.0.1:8686
```

Requirements: Node.js `24.22.0`, pnpm `12.14.0`, Docker with Compose.

The full stack instead: `docker compose up --build` (the `migrate` service runs migrations first). `compose.yaml` gives `STORAGE_PROVIDER` no default on purpose: every `docker compose` command fails, naming the variable, until `STORAGE_PROVIDER=local` is set in `.env` or exported.

## Validation

Run these from the repository root. Each row says what passing proves, so you can pick the cheapest check that covers your change.

| Command | What it proves | Needs |
| --- | --- | --- |
| `pnpm lint` | ESLint (Next config) is clean | nothing |
| `pnpm typecheck` | `tsc --noEmit` is clean | nothing |
| `pnpm test` | Vitest unit/integration suite (jsdom) | nothing beyond `pnpm install` |
| `pnpm test:coverage` | Same suite, plus a coverage report in `coverage/` (untracked) | nothing beyond `pnpm install` |
| `pnpm build` | Production build succeeds | nothing |
| `pnpm test:contract:assets` | Black-box check of the standalone server: files written to `data/uploads` and `data/documents` after boot are served immediately | builds if stale; no database |
| `pnpm test:contract:deploy` | `deploy.sh` / `rollback.sh` shell contracts, with `docker` and `git` stubbed | bash, `flock`; no Docker daemon |
| `bash tests/deploy/compose-contract.sh` | `compose.yaml` fails closed without `STORAGE_PROVIDER` and mounts the volumes at `/app/data/*` | Docker Compose |
| `bash tests/deploy/runtime-manifest.sh` | POSIX shell logic works in the runtime base image | Docker daemon |
| `pnpm test:e2e:auth` | Authenticated browser suite against an isolated database (below) | Docker, free port `55432`, Chromium |
| `pnpm test:e2e` | Public smoke tests against `pnpm dev` | host-resolvable `DATABASE_URL`, Chromium |

First time only: `pnpm exec playwright install chromium`.

Coverage has **no global threshold on purpose**. A repository-wide percentage rewards easy lines and says nothing about authorization, uploads or deploy safety; those are pinned by named tests (the `@critical` authenticated E2E specs, `tests/app/admin/rbac-integration.test.tsx`, `tests/deploy/`). The report is uploaded as a CI artifact so the numbers stay inspectable.

### Isolated authenticated E2E

```bash
pnpm test:e2e:auth
```

This runs the `authenticated` Playwright project against throwaway state and is the command that proves who can reach `/admin`:

- starts PostgreSQL from `compose.e2e.yaml` (project `websoprotelco-e2e`, tmpfs, no volume) on `127.0.0.1:55432`; override with `E2E_DB_PORT` (1024–65535, never `5432`);
- generates the database password and both account passwords per run; nothing is printed or written to disk;
- refuses any database that is not `websoprotelco_e2e_test` on a loopback host with a non-default port, because the suite resets its schema;
- runs the app from a temporary workspace, so uploads never touch the repository's `data/`; the runner removes the workspace and the container even on failure or Ctrl-C;
- covers anonymous, `customer` and `admin` access to the dashboard, reports and exports, and image/document uploads (`tests/e2e/authenticated/admin-authorization.spec.ts`). It does **not** exercise the `staff` role in a browser; `staff` is covered by unit/integration tests only.

It does not read the repository `.env` (the app workspace is forbidden from containing one) and overrides any `DATABASE_URL` exported in your shell.

## Docker Compose

```bash
docker compose up --build
```

The web app listens on port `8686`: <http://127.0.0.1:8686>. Compose binds the web app and PostgreSQL to `127.0.0.1` by default; `pnpm dev` and `pnpm start` use the same port so local and VPS stay aligned.

On a VPS keep `WEB_HOST=127.0.0.1` when a reverse proxy (Caddy, nginx, Traefik) terminates TLS and proxies to `http://127.0.0.1:8686`. Set `WEB_HOST=0.0.0.0` only intentionally, with firewall rules that restrict direct access.

## Database

Apply pending migrations from the host (needs `.env` with the host-local `DATABASE_URL`):

```bash
pnpm db:migrate
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_POOL_MAX` | `10` | Maximum pooled connections (1–100). |
| `DATABASE_SSL` | `disable` | Set to `require` for a certificate-verified TLS connection. |

`DATABASE_SSL` defaults to `disable` because Compose reaches PostgreSQL over a private Docker network. **Set `DATABASE_SSL=require` whenever the database is a separate host, including a managed provider**; otherwise the password and all query traffic cross the network in cleartext. This is not enforced in code because it would break the local Compose stack.

**Two connection strings, on purpose.** `compose.yaml` gives the `migrate`, `seed` and `web` services an internal `DATABASE_URL` pointing at host `db`, which only resolves inside the Compose network. Host-side commands (`pnpm db:migrate`, `pnpm db:create-admin`, `pnpm dev`, `pnpm test:e2e`) need `127.0.0.1:${POSTGRES_PORT:-5432}`, which is what `.env.example` contains. Copying the Compose-style `db` URL into a local `.env` breaks those commands (see [Known limitations](#known-limitations)).

Migrations do not run inside the `web` image: it is the Next.js standalone bundle with no TypeScript sources, `tsx` or `zod`. The `migrator` build stage carries the toolchain instead.

Add a migration as a new `.sql` file in `db/migrations/`, named with the next four-digit number (for example `0015_add_orders.sql`). Never edit one that has been applied anywhere shared: the runner records a checksum per migration and refuses to run if it changed. Concurrent runs serialise on a PostgreSQL advisory lock and each migration is its own transaction.

### Database safety

`pnpm test:db:reset` and `pnpm test:db:seed` refuse to run unless `DATABASE_URL` names a database ending in `_test`. Never aim them at shared, staging or production data. `pnpm db:migrate` has no such guard, because it must run against staging and production.

## Health check

- `GET /api/health` returns `{"status":"ok"}` without touching the database; the container `HEALTHCHECK` calls it, so it must stay cheap.
- `GET /api/health?check=db` also runs `SELECT 1`; `503` with `{"status":"degraded"}` if the database is unreachable.
- `GET /api/health?check=storage` builds the configured storage adapter; `503` if `STORAGE_PROVIDER` is missing or unsupported. `deploy.sh` probes it so a misconfigured deploy fails there instead of on the first upload.

## Authentication and authorization

### Who can open `/admin`

`src/app/admin/layout.tsx` only requires a **session** (anonymous visitors are redirected to `/login`). It does not check a permission, so it cannot be relied on to keep a role out. Authorization is declared **per page** with `requirePermission(...)` from `src/server/auth/guards.ts`, evaluated before that page issues any data query. Without the permission the page responds `404` (not a redirect), so a signed-in user does not learn which sections exist. The sidebar only lists links the role can open.

Route handlers cannot render a `404`, so they answer JSON: `401` when signed out, `403` when the role lacks the permission.

| Surface | Permission |
| --- | --- |
| `/admin` dashboard | `quote:read` **and** `catalog:read`, `leads:read`, `inventory:read` (it aggregates all four domains) |
| `/admin/orders`, `/admin/quotes`, `/admin/reports`, `GET /admin/reports/export` | `quote:read` |
| `/admin/leads`, `/admin/leads/[id]` | `leads:read` |
| `/admin/products`, `/admin/categories` (lists) | `catalog:read` |
| Product and category create/edit, `/admin/products/import`, `POST /api/upload` | `catalog:write` |
| `/admin/inventory`, `/admin/inventory/movements` | `inventory:read` |
| `/admin/documents` | `documents:read`; `POST /api/documents/upload` needs `documents:write` |
| `/admin/design` | `design:read`; `POST /api/design/upload` needs `design:write` |
| `/admin/settings` | `settings:read` |
| `/admin/users` | `admin:access` |

### Roles

The role-to-permission map lives in `src/server/auth/rbac.ts`; that file is the source of truth, and `tests/foundation/docs-contract.test.ts` checks that this section lists every `staff` permission.

| Role | Permissions | Lands on after sign-in |
| --- | --- | --- |
| `admin` | every permission, including `admin:access`, `settings:*`, `design:*` | `/admin` |
| `staff` | `catalog:read`, `quote:read`, `quote:write`, `leads:read`, `leads:write`, `inventory:read`, `inventory:write`, `documents:read`, `documents:write` | `/admin` |
| `customer` | none; created by public self-registration at `/registro` | `/cuenta` |

So `staff` can read the catalog but not edit it, and cannot open users, settings or design. A `customer` is refused every admin surface.

### Passwords

Every path enforces **12–200 characters**: public sign-up, admin user creation, the Zod schemas, the sign-up/new-user forms and `hashPassword` itself. A shorter password is rejected before any row or session is written. Hashes are `scrypt` with a per-password salt.

### Accounts and seed credentials

**No password is tracked in this repository, and none is a default.** Each command takes its password from explicit environment variables and fails closed without them.

First administrator (also what `deploy.sh` runs from the server `.env`):

```bash
pnpm db:migrate
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='<12+ characters>' pnpm db:create-admin
```

Against a running Compose stack, use the `seed` tooling image (the `web` image cannot run this):

```bash
docker compose run --rm -e ADMIN_EMAIL=you@example.com -e ADMIN_PASSWORD='<12+ characters>' seed pnpm db:create-admin
```

`db:create-admin` upserts the user with role `admin`, resets the password if the user exists, and never prints it.

Development accounts (`db/seeds/001-users.ts`) need both passwords explicitly:

```bash
SEED_ADMIN_PASSWORD='<12+ characters>' SEED_STAFF_PASSWORD='<12+ characters>' pnpm seed:users
```

Emails default to `admin@ilasesorias.com` and `staff@ilasesorias.com`; override with `SEED_ADMIN_EMAIL` and `SEED_STAFF_EMAIL`. The seed never overwrites an existing password and refuses to run with `NODE_ENV=production`. Under Compose the `seed` service does not forward the `SEED_*` variables, so pass them with `-e`:

```bash
docker compose run --rm -e SEED_ADMIN_PASSWORD='<12+ characters>' -e SEED_STAFF_PASSWORD='<12+ characters>' seed
```

### Sessions

- Opaque 32-byte random tokens; only a SHA-256 hash is stored in `sessions`, so a database dump cannot be replayed as a live session.
- Cookie is `httpOnly`, `sameSite: lax`, and `Secure` outside development. TTL is 7 days.
- Expired sessions are filtered in SQL on every lookup, but **nothing deletes them yet**. `deleteExpiredSessions()` in `src/server/auth/session.ts` exists and must be scheduled.
- Not implemented: password reset, email verification, MFA, rate limiting on `/login`.

### TLS is required

Outside development the session cookie is `Secure`, so browsers **discard it over plain HTTP**. A VPS on `http://` shows a silent login loop: credentials accepted, session created, cookie thrown away. Serve the site over HTTPS. `SESSION_COOKIE_SECURE=false` exists only to reach a fresh server over plain HTTP before TLS is in place; remove it afterwards.

## Runtime assets: `data/`

User uploads are written under the process working directory, never under `public/`:

| Kind | Disk path | Public URL | Compose volume |
| --- | --- | --- | --- |
| Images | `data/uploads` | `/uploads/...` | `uploads-data` at `/app/data/uploads` |
| Documents | `data/documents` | `/documents/...` | `documents-data` at `/app/data/documents` |

Both are served by route handlers (`src/app/uploads/[...path]`, `src/app/documents/[...path]`) so a file written after boot is reachable immediately; `pnpm test:contract:assets` proves that against the real standalone server. Running the app locally writes to `data/` in the repository root. **`data/` is ignored by Git**, so local uploads cannot be staged accidentally. The cutover from the old `/app/public/*` mounts is described in [`docs/operations/runtime-asset-cutover.md`](docs/operations/runtime-asset-cutover.md), and writable-layer documents from an older image follow [`docs/operations/legacy-documents-migration.md`](docs/operations/legacy-documents-migration.md).

## Deploying to a VPS

`./deploy.sh` is the only supported path. It never runs the development seed; it creates the administrator from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the server `.env`. Set `NODE_ENV=production` there so the dev seed refuses to run even by hand.

### First deploy

A bare `./deploy.sh` on a host with no `.env` does **only** this: it writes a template `.env` and exits `1`, before any lock, Git update, backup or container work.

1. Run `./deploy.sh`. It creates `.env` from the template.
2. Replace every `CHANGE_ME`: `POSTGRES_PASSWORD` (the same value inside `DATABASE_URL`), `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12–200 characters).
3. Review two template defaults that suit a first plain-HTTP boot but not a finished site: `WEB_HOST=0.0.0.0` and `SESSION_COOKIE_SECURE=false`. Restore both once TLS and the proxy are in front.
4. Run `./deploy.sh` again. Deploy refuses to continue while any required value is missing or still `CHANGE_ME`.

A first deploy needs no asset evidence: the candidate creates, fetches and removes probe files in both runtime roots.

### Existing deployments

A host with a recorded successful deploy, a non-empty rollback manifest, or any `web` container (even stopped) is an existing deployment. Before any migration or container recreation, `deploy.sh` requires, and validates the shape of, all of:

```bash
MAINTENANCE_WINDOW_CONFIRMED=true
KNOWN_UPLOAD_URL=/uploads/<policy-valid-file>
KNOWN_DOCUMENT_URL=/documents/manual/<policy-valid-file>.pdf
```

Export them for one run or keep the three lines in the server `.env`. Missing, `false`, query-bearing or policy-invalid evidence aborts before mutation. It also requires a complete rollback snapshot (database, uploads and documents together). `rollback.sh` restores all three from a single manifest entry and refuses partial ones.

The exact grammar, volume handling and rollback order are in [`docs/operations/runtime-asset-cutover.md`](docs/operations/runtime-asset-cutover.md).

## CI

`.github/workflows/ci.yml` runs on pull requests and on pushes to `main` and `feature/**`, with `contents: read` only. Node.js and pnpm versions match `package.json`.

| Job | Runs |
| --- | --- |
| `quality` | throwaway PostgreSQL service; migrate twice (idempotency), reset, migrate, seed; `pnpm lint`; `pnpm typecheck`; `pnpm test:coverage` (uploads `coverage/` as the `coverage-report` artifact); public `pnpm test:e2e`; `pnpm build`; `pnpm test:contract:assets` |
| `container` | `bash tests/deploy/run-all.sh`; `bash tests/deploy/compose-contract.sh`; `bash tests/deploy/runtime-manifest.sh`; builds the `runner` and `migrator` images |
| `e2e-authenticated` | Playwright Chromium, then `pnpm test:e2e:auth` (isolated database; no secrets) |

The unit suite runs once, inside `quality`. CI never deploys and never reaches real infrastructure.

### CI secrets

`quality` provisions its own PostgreSQL service and reads two repository secrets. There is no fallback: a missing secret fails the job rather than running against a default password.

| Secret | Purpose |
| --- | --- |
| `CI_TEST_PASSWORD` | Password for the ephemeral `websoprotelco_ci_test` service. |
| `CI_DATABASE_URL` | Connection string for that service. Must embed `CI_TEST_PASSWORD` and end in a `_test` database name. |

```text
CI_DATABASE_URL = postgresql://ci_test_user:<CI_TEST_PASSWORD>@127.0.0.1:5432/websoprotelco_ci_test
```

## Known limitations

- **Default public Playwright needs a host-resolvable `DATABASE_URL`.** `pnpm test:e2e` starts `pnpm dev`, which reads your local `.env`. It was observed failing when that `.env` used the Compose hostname `db`, because `db` does not resolve from the host. Use the host-local URL from `.env.example` (`127.0.0.1`), or run `pnpm test:e2e:auth`, which does not read `.env`.
- **What "verified" means.** The authenticated E2E, unit, deploy-shell and asset-contract checks were observed passing on the development machine. They show the guarded behaviour they assert, not that a real VPS deploy, backup restore or TLS setup works. No deployment against real infrastructure was run.
- **`staff` has no browser-level test**; its permissions are checked by unit/integration tests.
- **Dependency advisory.** The lockfile resolves `postcss@8.5.23` through `next@16.4.2`. It is transitive; revisit when Next publishes a patched path or after verifying an override in CI and Docker.

## Operator responsibilities

These are not done by this repository and are not claimed as done:

- **Rotate any credential that was ever committed or shared**, in every environment that used it. Removing a password from the tree does not invalidate copies in Git history, backups or existing databases; credential rotation is an external operator action.
- Set strong `POSTGRES_PASSWORD`, `ADMIN_PASSWORD` and, for a remote database, `DATABASE_SSL=require`.
- Terminate TLS in front of the app and then drop `SESSION_COOKIE_SECURE=false`.
- Schedule `deleteExpiredSessions()`.
- Decide production storage (the supported provider is `local` on named volumes) and take off-host backups of `backups/`.
- Plan the legacy data import, cutover and rollback rehearsal.
