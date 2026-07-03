# Apply Progress: soprotelco-ecommerce-rebuild

## Mode
Standard Mode. Strict TDD is not active because the target repo previously had no package metadata or test runner before the PR 1 foundation slice started.

## Workload / PR Boundary
- Mode: chained PR slice
- Chain strategy: feature-branch-chain
- Current work unit: PR 1 — Runtime, Docker, CI, and test harness foundation
- Boundary: starts from SDD/bootstrap-only target repo; ends with runnable Next.js foundation, Docker/Compose, CI, Vitest, Playwright, and test database seed/reset helpers.
- Review budget impact: Foundation slice only; no server foundations, storefront features, admin, import, or feature UI beyond minimal build/test skeleton.

## Completed Tasks
- [x] 1.1 Created `package.json`, `pnpm-lock.yaml`, `.nvmrc`, `tsconfig.json`, `next.config.ts`, PostCSS/Tailwind setup, ESLint config, and minimal App Router skeleton required for build/test harness.
- [x] 1.2 Created `Dockerfile`, `compose.yaml`, `.dockerignore`, and `.github/workflows/ci.yml` for web, PostgreSQL, lint, typecheck, unit tests, E2E smoke, build, Compose validation, and Docker build.
- [x] 1.3 Created and corrected `vitest.config.ts`, `playwright.config.ts`, `tests/base-page.ts`, Playwright home smoke harness, and seed/reset helpers for future database-backed feature slices.

## Corrective Retry Evidence
- Fixed `tests/helpers/reset-database.ts` and `tests/helpers/seed-database.ts` by replacing top-level await with explicit promise error handling so `tsx` can execute the helpers through the current CommonJS transform path.
- Fixed `compose.yaml` PostgreSQL 18 volume mount from `/var/lib/postgresql/data` to `/var/lib/postgresql`, matching the PostgreSQL 18 Docker image layout and allowing the database service to become healthy.
- Added a destructive reset guard requiring database names to end with `_test`; non-test database URLs now fail before connecting.
- Added `.env.example` with safe local/test values for PostgreSQL, web port, and `DATABASE_URL` aligned to the `_test` reset guard.
- Bound the Compose PostgreSQL published port to `127.0.0.1` to avoid exposing the database on all interfaces during local development.
- CI Docker build networking was not changed; if the first CI Docker build cannot fetch packages in the runner environment, retry with `docker build --network host --target runner -t websoprotelco:ci .` as a CI-only adjustment.

## PR 1 Verification Blocker Corrections
- Replaced the Playwright base navigation helper's `networkidle` wait with `domcontentloaded` navigation plus a visible `body` readiness check. Page-specific assertions continue to prove the actual smoke outcome, avoiding a flaky idle heuristic on a simple Next.js page.
- Updated the CI runtime image build command to `docker build --network host --target runner -t websoprotelco:ci .` after fresh verification proved default Docker networking could time out while the same Dockerfile succeeded through host networking. Runtime container behavior remains unchanged.

## Verification Evidence
| Command | Result |
|---|---|
| `POSTGRES_PORT=55432 docker compose down -v` | Passed cleanup before retry. |
| `POSTGRES_PORT=55432 docker compose up -d --wait db` | Passed; PostgreSQL service became healthy after the volume mount correction. |
| `DATABASE_URL=postgresql://websoprotelco:websoprotelco_dev_password@127.0.0.1:55432/websoprotelco pnpm test:db:reset` | Passed. |
| `DATABASE_URL=postgresql://websoprotelco:websoprotelco_dev_password@127.0.0.1:55432/websoprotelco pnpm test:db:seed` | Passed. |
| `pnpm lint` | Passed. |
| `pnpm typecheck` | Passed. |
| `pnpm test` | Passed; 1 Vitest test. |
| `pnpm build` | Passed; Next.js 16.2.10 standalone build completed. |
| `pnpm test:e2e` | Passed; 1 Playwright Chromium smoke test. |
| `docker compose config --quiet` | Passed. |
| `docker build --network host --target runner -t websoprotelco:pr1-correction .` | Passed. |
| `POSTGRES_PORT=55432 docker compose down -v` | Passed cleanup after retry. |
| `POSTGRES_DB=websoprotelco_test POSTGRES_PORT=55432 docker compose down -v && POSTGRES_DB=websoprotelco_test POSTGRES_PORT=55432 docker compose up -d --wait db` | Passed; PostgreSQL service became healthy with localhost-only host port binding. |
| `DATABASE_URL=postgresql://websoprotelco:websoprotelco_dev_password@127.0.0.1:55432/websoprotelco_test pnpm test:db:reset` | Passed; reset helper allows `_test` database. |
| `DATABASE_URL=postgresql://websoprotelco:websoprotelco_dev_password@127.0.0.1:55432/websoprotelco_test pnpm test:db:seed` | Passed. |
| `DATABASE_URL=postgresql://websoprotelco:websoprotelco_dev_password@127.0.0.1:55432/websoprotelco pnpm test:db:reset` | Failed as expected with `Refusing to reset non-test database: websoprotelco`; confirms guard behavior. |
| `pnpm lint` | Passed after warning fixes. |
| `pnpm typecheck` | Passed after warning fixes. |
| `pnpm test` | Passed; 1 Vitest test. |
| `docker compose config --quiet` | Passed after localhost PostgreSQL port binding. |
| `POSTGRES_DB=websoprotelco_test POSTGRES_PORT=55432 docker compose down -v` | Passed cleanup after warning-fix verification. |
| `pnpm test:e2e` | Passed after replacing `networkidle`; 1 Playwright Chromium smoke test. |
| `docker build --network host --target runner -t websoprotelco:pr1-verify .` | Passed; validates the updated CI-equivalent container build path. |
| `pnpm lint` | Passed after PR 1 blocker corrections. |
| `pnpm typecheck` | Passed after PR 1 blocker corrections. |
| `pnpm test` | Passed after PR 1 blocker corrections; 1 Vitest test. |

## Files Changed
- `tests/helpers/reset-database.ts` — removed top-level await and added explicit async error handling.
- `tests/helpers/reset-database.ts` — added `_test` database-name guard before destructive schema reset.
- `tests/helpers/seed-database.ts` — removed top-level await and added explicit async error handling.
- `compose.yaml` — changed the PostgreSQL named volume mount to `/var/lib/postgresql` for PostgreSQL 18 compatibility.
- `compose.yaml` — bound the PostgreSQL host port to `127.0.0.1`.
- `.env.example` — added safe local/test example values aligned with the reset helper guard.
- `tests/base-page.ts` — replaced `networkidle` with deterministic document/body readiness for the smoke page helper.
- `.github/workflows/ci.yml` — changed the runtime Docker build gate to use host networking for package registry access in CI.
- `openspec/changes/soprotelco-ecommerce-rebuild/apply-progress.md` — recorded cumulative PR 1 apply progress and corrective retry evidence.

## Deviations from Design
None — implementation remains inside the PR 1 foundation slice.

## Issues Found
- PostgreSQL 18 Docker images reject mounting the data volume directly at `/var/lib/postgresql/data`; the Compose mount must target `/var/lib/postgresql` so the image can manage major-version-specific data directories.
- Playwright `networkidle` is not a reliable readiness condition for the current Next.js smoke page; a page-specific visible heading assertion is the meaningful readiness proof.
- Default Docker build networking can time out when Corepack fetches pnpm in this environment; the CI-equivalent build now uses Docker host networking for the build-time registry fetch.

## Remaining Tasks
- [ ] 2.1 Create `db/schema.sql`, `db/migrations/**`, and `src/server/db/**` for canonical PostgreSQL tables and migration checks.
- [ ] 2.2 Create `src/server/auth/**` with sessions, password hashing, `requireSession()`, and `requirePermission()`; test invalid credentials and bypass denial.
- [ ] 2.3 Create `src/server/storage/**` and `src/server/notifications/**` adapters for uploads metadata and `notification_outbox`.
- [ ] Phase 3+ storefront, commerce, admin, import, and hardening tasks remain untouched.

## Status
3/18 tasks complete. PR 1 verification blockers are corrected and ready for fresh SDD verify.
