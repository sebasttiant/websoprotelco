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
- Superseded by later correction: the CI runtime image build now uses `docker build --network host --target runner -t websoprotelco:ci .` because local verification showed the default Docker build network could time out while host networking succeeded.

## PR 1 Verification Blocker Corrections
- Replaced the Playwright base navigation helper's `networkidle` wait with `domcontentloaded` navigation plus a visible `body` readiness check. Page-specific assertions continue to prove the actual smoke outcome, avoiding a flaky idle heuristic on a simple Next.js page.
- Updated the CI runtime image build command to `docker build --network host --target runner -t websoprotelco:ci .` after fresh verification proved default Docker networking could time out while the same Dockerfile succeeded through host networking. Runtime container behavior remains unchanged.

## PR 1 Pre-PR Review Cleanup
- Moved the `_test` database-name safety contract into `tests/helpers/database-url.ts`, so every helper using `getTestDatabaseUrl()` fails before opening a PostgreSQL connection when `DATABASE_URL` targets a protected or non-`_test` database.
- `tests/helpers/reset-database.ts` and `tests/helpers/seed-database.ts` now share the same `_test` safety guard before any destructive or mutating database work.
- Added Vitest unit coverage in `tests/helpers/database-url.test.ts` proving `_test` URLs are accepted and non-`_test`/protected URLs are rejected without requiring a live database.
- Added `.atl/` to `.gitignore` because those generated AI registry artifacts contain local absolute paths and are not product artifacts. The two files remain **tracked** and are therefore still regenerated in place by the registry tooling; `.gitignore` does not untrack an already-tracked path. A maintainer must run `git rm -r --cached .atl` to complete the cleanup.
- Added least-privilege `permissions: contents: read` to `.github/workflows/ci.yml`.
- Cleaned verification documentation so final current-state evidence no longer claims reset/seed against non-`_test` databases succeeded and no longer describes PR1 files as untracked.

## Client Delivery Hygiene Cleanup
- Replaced placeholder-only `README.md` with a concise Docker-first readiness guide covering local setup, environment creation, validation commands, Compose run, DB helper safety, and the remaining client-delivery gap.
- Changed `.env.example` and Compose fallback credentials to explicit local-only placeholder values (`local_dev_user` / `local_dev_password_change_me`) without introducing real secrets.
- Documented the current PostCSS advisory risk: `postcss@8.4.31` is pulled transitively by `next@16.2.10`, so this cleanup avoids an unverified package override and leaves the fix to a safe Next update or separately verified override.
- Re-ran the requested lightweight verification gates after the hygiene cleanup; `pnpm` reported a Node engine warning because the local shell uses `v24.18.0` while the project pins `24.16.0`, but lint, typecheck, tests, and Compose config still passed.

## Verification Evidence
| Command | Result |
|---|---|
| `POSTGRES_PORT=55432 docker compose down -v` | Passed cleanup before retry. |
| `POSTGRES_PORT=55432 docker compose up -d --wait db` | Passed; PostgreSQL service became healthy after the volume mount correction. |
| Historical unsafe DB helper check against `.../websoprotelco` | Superseded by the `_test` guard. Current reset and seed helpers reject this URL before connecting. |
| `pnpm lint` | Passed. |
| `pnpm typecheck` | Passed. |
| `pnpm test` | Passed; 1 Vitest test. |
| `pnpm build` | Passed; Next.js 16.2.10 standalone build completed. |
| `pnpm test:e2e` | Passed; 1 Playwright Chromium smoke test. |
| `docker compose config --quiet` | Passed. |
| `docker build --network host --target runner -t websoprotelco:pr1-correction .` | Passed. |
| `POSTGRES_PORT=55432 docker compose down -v` | Passed cleanup after retry. |
| `POSTGRES_DB=websoprotelco_test POSTGRES_PORT=55432 docker compose down -v && POSTGRES_DB=websoprotelco_test POSTGRES_PORT=55432 docker compose up -d --wait db` | Passed; PostgreSQL service became healthy with localhost-only host port binding. |
| `DATABASE_URL=postgresql://local_dev_user:local_dev_password_change_me@127.0.0.1:55432/websoprotelco_test pnpm test:db:reset` | Passed; reset helper allows `_test` database. |
| `DATABASE_URL=postgresql://local_dev_user:local_dev_password_change_me@127.0.0.1:55432/websoprotelco_test pnpm test:db:seed` | Passed. |
| `DATABASE_URL=postgresql://local_dev_user:local_dev_password_change_me@127.0.0.1:55432/websoprotelco pnpm test:db:reset` | Failed as expected before connecting. Current shared guard reports `Refusing to use non-test database: websoprotelco`. |
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
| `pnpm lint` | Passed after pre-PR blocker/noise cleanup. |
| `pnpm typecheck` | Passed after pre-PR blocker/noise cleanup. |
| `pnpm test` | Passed after pre-PR blocker/noise cleanup; 2 test files, 5 tests. |
| `pnpm test tests/helpers/database-url.test.ts` | Passed; 4 DB safety unit tests prove `_test` allow and non-`_test`/protected rejection without a live database. |
| `DATABASE_URL=postgresql://user:password@localhost:5432/websoprotelco pnpm test:db:reset` | Failed as expected before connecting with `Refusing to use non-test database: websoprotelco`. |
| `DATABASE_URL=postgresql://user:password@localhost:5432/websoprotelco pnpm test:db:seed` | Failed as expected before connecting with `Refusing to use non-test database: websoprotelco`. |
| `docker compose config --quiet` | Passed after CI permission hardening. |
| `pnpm lint` | Passed after client-delivery hygiene cleanup; emitted a local Node engine warning (`current v24.18.0`, expected `24.16.0`). |
| `pnpm typecheck` | Passed after client-delivery hygiene cleanup; emitted the same local Node engine warning. |
| `pnpm test` | Passed after client-delivery hygiene cleanup; 2 files, 5 tests, with the same local Node engine warning. |
| `docker compose config --quiet` | Passed after client-delivery hygiene cleanup. |

## Files Changed
- `tests/helpers/reset-database.ts` — removed top-level await and added explicit async error handling.
- `tests/helpers/reset-database.ts` — added `_test` database-name guard before destructive schema reset.
- `tests/helpers/seed-database.ts` — removed top-level await and added explicit async error handling.
- `tests/helpers/database-url.ts` — centralized the `_test` safety contract used by reset and seed helpers.
- `tests/helpers/database-url.test.ts` — added live-DB-free Vitest coverage for DB helper allow/reject behavior.
- `compose.yaml` — changed the PostgreSQL named volume mount to `/var/lib/postgresql` for PostgreSQL 18 compatibility.
- `compose.yaml` — bound the PostgreSQL host port to `127.0.0.1`.
- `.env.example` — added safe local/test example values aligned with the reset helper guard.
- `tests/base-page.ts` — replaced `networkidle` with deterministic document/body readiness for the smoke page helper.
- `.github/workflows/ci.yml` — changed the runtime Docker build gate to use host networking for package registry access in CI.
- `.github/workflows/ci.yml` — added least-privilege `permissions: contents: read`.
- `.gitignore` — ignores local/generated `.atl/` AI registry artifacts.
- `.atl/` — still tracked and still regenerated; pending `git rm -r --cached .atl` by a maintainer.
- `README.md` — replaced the placeholder with Docker-first readiness and delivery-gap documentation.
- `openspec/changes/soprotelco-ecommerce-rebuild/apply-progress.md` — recorded cumulative PR 1 apply progress and corrective retry evidence.
- `openspec/changes/soprotelco-ecommerce-rebuild/verify-report.md` — cleaned stale contradictory verification statements.

## Deviations from Design
None — implementation remains inside the PR 1 foundation slice.

## Issues Found
- PostgreSQL 18 Docker images reject mounting the data volume directly at `/var/lib/postgresql/data`; the Compose mount must target `/var/lib/postgresql` so the image can manage major-version-specific data directories.
- Playwright `networkidle` is not a reliable readiness condition for the current Next.js smoke page; a page-specific visible heading assertion is the meaningful readiness proof.
- Default Docker build networking can time out when Corepack fetches pnpm in this environment; the CI-equivalent build uses Docker host networking for the build-time registry fetch.
- Mutating DB helpers must share one pre-connection `_test` guard; otherwise seed/reset safety can drift.

## Remaining Tasks
- [ ] 2.1 Create `db/schema.sql`, `db/migrations/**`, and `src/server/db/**` for canonical PostgreSQL tables and migration checks.
- [ ] 2.2 Create `src/server/auth/**` with sessions, password hashing, `requireSession()`, and `requirePermission()`; test invalid credentials and bypass denial.
- [ ] 2.3 Create `src/server/storage/**` and `src/server/notifications/**` adapters for uploads metadata and `notification_outbox`.
- [ ] Phase 3+ storefront, commerce, admin, import, and hardening tasks remain untouched.
- [ ] Final client delivery still requires domain schema/migrations, auth/RBAC, ecommerce flows, admin operations, import/cutover, production storage/handoff configuration, and a fresh full verification pass.

## Status
3/18 tasks complete. PR 1 verification blockers are corrected and ready for fresh SDD verify.
