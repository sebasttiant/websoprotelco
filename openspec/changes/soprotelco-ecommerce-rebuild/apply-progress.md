# Apply Progress: soprotelco-ecommerce-rebuild

## Mode
Standard Mode. Strict TDD is not active because the target repo previously had no package metadata or test runner before the PR 1 foundation slice started.

## PR 2 Current Slice
- Verified that the existing base already contains task 2.2: database-backed sessions, scrypt password hashing, server-enforced `requireSession()`/`requirePermission()`, and behavior coverage for invalid credentials and denied permissions.
- Verified that the existing base already contains the local upload metadata adapters required by task 2.3.
- Added `db/migrations/0011_notification_outbox.sql` and `src/server/notifications/outbox.ts` to complete task 2.3 with a validated, provider-independent transactional-outbox enqueue boundary.
- Added behavior-first Vitest coverage proving a valid notification produces the pending-row insert and unsupported channels are rejected before any database write.
- No notification delivery worker, storefront/admin/import behavior, deployment, live migration, port `8585`, or VPS files were touched.

## Corrective Retry: Fresh Slice Gate Remediation
- Added behavior-first `signIn()` tests proving invalid credentials and disabled accounts neither create sessions nor set the authentication cookie.
- Added customer to the first-party role model through `0012_customer_role.sql`; active customers land at `/cuenta`, while staff/admin land at `/admin`.
- Updated `enqueueNotification()` to accept an optional caller-owned transaction client, with tests proving it uses that client instead of the pooled query path.
- Replaced hard-coded storage factories with an explicit, fail-closed `STORAGE_PROVIDER=local` selection contract so a later S3-compatible adapter can be added without silently changing VPS-local behavior.
- Deferred notification delivery semantics precisely: before any email/WhatsApp handoff, implement tested `FOR UPDATE SKIP LOCKED` claims, bounded exponential retry, stale-processing recovery, terminal failures, and idempotency keys/provider receipts. This slice does not claim a worker, dequeue, retry, recovery, or external delivery contract.

## Blocker Correction: Outbox Receiver Binding and Storage Fail-Closed
- `enqueueNotification()` detached `transaction.query` from its instance, so a real `pg.Client`/`pg.PoolClient` threw `TypeError: Cannot read properties of undefined (reading '_Promise')`. The call now runs as `transaction.query(...)` on its own receiver, with the pooled runner used only when no transaction is supplied. Reproduced against live PostgreSQL before the fix and green after it.
- Outbox coverage no longer relies only on `vi.fn()`: a receiver-dependent fake client fails on the previous implementation, and a failing caller transaction is proven not to fall back to the pool.
- `STORAGE_PROVIDER` is now read through a Zod schema (`readStorageProvider()`) mirroring the `readDatabaseEnv()` pattern. An absent variable fails closed under `NODE_ENV=production`; the implicit local default is limited to development/test and is covered by tests. `compose.yaml` declares `STORAGE_PROVIDER` explicitly for the `web` service.
- Deferred: no boot-time storage validation hook exists, so the failure surfaces on the first adapter creation rather than at process start. No DB-backed integration suite is committed, because `pnpm test` must stay runnable without PostgreSQL; the transactional evidence above came from a throwaway probe.

## Workload / PR Boundary
- Mode: chained PR slice
- Chain strategy: feature-branch-chain
- Current work unit: PR 2 — Server foundations completion
- Boundary: starts from the current branch's completed task 2.1 and existing auth/storage foundations; ends with task 2.2 artifact reconciliation plus the provider-independent notification outbox persistence boundary and its behavior tests.
- Review budget impact: 326 changed lines (302 additions, 24 deletions) for the implementation and SDD artifacts, excluding the pre-existing 197-line verify report; within the 400-line chained-PR budget. The child PR targets the feature/tracker branch or immediate prior PR branch, never `main`.

## Completed Tasks
- [x] 1.1 Created `package.json`, `pnpm-lock.yaml`, `.nvmrc`, `tsconfig.json`, `next.config.ts`, PostCSS/Tailwind setup, ESLint config, and minimal App Router skeleton required for build/test harness.
- [x] 1.2 Created `Dockerfile`, `compose.yaml`, `.dockerignore`, and `.github/workflows/ci.yml` for web, PostgreSQL, lint, typecheck, unit tests, E2E smoke, build, Compose validation, and Docker build.
- [x] 1.3 Created and corrected `vitest.config.ts`, `playwright.config.ts`, `tests/base-page.ts`, Playwright home smoke harness, and seed/reset helpers for future database-backed feature slices.
- [x] 2.1 Created versioned PostgreSQL migrations, an ordered/checksum-guarded migration runner, validated database environment parsing, and a pooled server-only client.
- [x] 2.2 Reconciled the existing database-backed auth/RBAC implementation: hashed sessions, scrypt passwords, `requireSession()`, `requirePermission()`, invalid-credential behavior, and bypass denial coverage.
- [x] 2.3 Added the provider-independent notification outbox migration and validated enqueue adapter; existing local upload/document/design-image metadata adapters remain part of this completed task.

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
| `pnpm test tests/server/auth/actions.test.ts tests/server/auth tests/server/storage tests/server/notifications/outbox.test.ts` | Passed; 9 files, 87 tests. |
| `pnpm test` | Passed; 69 files, 550 tests. |
| `pnpm lint` | Passed. |
| `pnpm typecheck` | Passed. |
| `pnpm build` | Passed. |
| `POSTGRES_DB=websoprotelco_test POSTGRES_PORT=55432 docker compose up -d --wait db` | Passed; Compose PostgreSQL became healthy. |
| Two consecutive `pnpm db:migrate` runs against `websoprotelco_test` | Passed; first applied 0001-0012, second reported `No pending migrations.` |
| `POSTGRES_DB=websoprotelco_test POSTGRES_PORT=55432 docker compose down -v` | Passed cleanup. |
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
| `pnpm test tests/server/notifications/outbox.test.ts` | Passed; 2 outbox behavior tests. |
| `pnpm test` | Passed; 67 files, 544 tests. |
| `pnpm lint` | Passed. |
| `pnpm typecheck` | Passed. |
| `pnpm build` | Passed. |
| `docker compose config --quiet` | Passed. |
| Blocker correction — outbox unit test against the pre-fix implementation | Failed as required: `TypeError: Cannot read properties of undefined (reading 'statements')`. |
| Blocker correction — storage unit test against the pre-fix implementation | Failed as required: production with no `STORAGE_PROVIDER` did not throw. |
| Blocker correction — live PostgreSQL probe against the pre-fix implementation | Reproduced the reported `TypeError: Cannot read properties of undefined (reading '_Promise')` from `pg/lib/client.js`. |
| Blocker correction — live PostgreSQL probe after the fix | Passed: insert visible inside the transaction, `0` rows after `ROLLBACK`, `1` pending row after `COMMIT`, and the pool path still writes. Probe file was removed after the run. |
| Two consecutive `pnpm db:migrate` runs against an empty `websoprotelco_test` | Passed; first applied 0001-0012, second reported `No pending migrations.` |
| `pnpm test tests/server/auth tests/server/storage tests/server/notifications` | Passed; 9 files, 93 tests. |
| `pnpm test` | Passed; 69 files, 556 tests. |
| `pnpm lint` | Passed. |
| `pnpm typecheck` | Passed. |
| `pnpm build` | Passed. |
| `docker compose config --quiet` | Passed. |
| `env -u STORAGE_PROVIDER docker compose config` | Failed as required: `required variable STORAGE_PROVIDER is missing a value`. |
| `STORAGE_PROVIDER=local docker compose config --quiet` | Passed; renders `STORAGE_PROVIDER: local`. |
| `bash tests/deploy/compose-contract.sh` | Passed; 2 checks. Against the previous `:-local` default it failed 1 of 2, proving the contract detects the silent fallback. |
| `bash tests/deploy/run.sh` | Passed; 34 existing deploy checks. |
| `pnpm test` | Passed; 69 files, 556 tests. |
| `pnpm lint` | Passed. |
| `pnpm typecheck` | Passed. |
| `pnpm build` | Passed. |

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
- `db/migrations/0011_notification_outbox.sql` — added durable, indexed transactional-outbox storage.
- `src/server/notifications/outbox.ts` — added validated provider-independent outbox enqueue boundary.
- `tests/server/notifications/outbox.test.ts` — added behavior-first queue/rejection coverage.
- `db/migrations/0012_customer_role.sql` — permits customer sessions and makes customer the default role for new accounts.
- `src/server/auth/actions.ts`, `src/server/auth/rbac.ts` — route customer sessions to `/cuenta` and retain admin/staff landing at `/admin`.
- `tests/server/auth/actions.test.ts` — proves invalid/disabled login cannot create a session or set an auth cookie; proves customer/admin landings.
- `src/server/notifications/outbox.ts`, `tests/server/notifications/outbox.test.ts` — support and prove caller-owned transaction execution.
- `src/server/storage/index.ts`, `tests/server/storage/provider.test.ts` — add explicit fail-closed local provider selection.
- `src/server/notifications/outbox.ts` — call `transaction.query` on its instance so a real pg client keeps its receiver.
- `tests/server/notifications/outbox.test.ts` — add receiver-dependent and transaction-failure coverage that a `vi.fn()` mock cannot provide.
- `src/server/storage/index.ts` — validate `STORAGE_PROVIDER` through a Zod schema that fails closed in production.
- `tests/server/storage/provider.test.ts` — cover valid local, unknown provider, absent-in-production, and the development/test default.
- `compose.yaml` — declare `STORAGE_PROVIDER` explicitly for the `web` service.

## Blocker Correction: Compose Fail-Closed Storage Contract
- `compose.yaml` used `${STORAGE_PROVIDER:-local}`, which re-created at the delivery layer exactly the silent default `readStorageProvider()` removes from the runtime. The `web` service now uses `${STORAGE_PROVIDER:?...}`, so Compose refuses to interpolate when the host does not declare the variable.
- `tests/deploy/compose-contract.sh` runs the real `docker compose config`, because grepping the YAML passes with or without a default. `--env-file /dev/null` prevents Compose auto-loading a developer's `.env` and masking the missing-variable case. Verified to fail (`passed: 2 failed: 1`) against the previous `:-local` form.
- Rejection of an unsupported provider stays application behaviour, proven by `tests/server/storage/provider.test.ts` under `pnpm test`.
- `.github/workflows/ci.yml` replaces the bare `docker compose config --quiet` gate with the contract script. `deploy.sh` adds `STORAGE_PROVIDER` to `required_vars`, so a server missing the value aborts with a named error before any build or backup.
- Open item for the maintainer: `.env.example` must document `STORAGE_PROVIDER=local`. The apply session had no read or write access to that path, so the line was not added. Local `.env` files and the server `.env` need the same line or Compose will now refuse to start.

## Review Size Accounting (uncommitted working tree vs `2ba526b`, added + removed)
| Unit | Added | Removed | Total |
|---|---|---|---|
| PR 2A — implementation, tests, `tasks.md` | 380 | 17 | 397 |
| PR 2B — `apply-progress.md`, `verify-report.md` | see below | see below | under 400 |

PR 2A files: `.github/workflows/ci.yml`, `compose.yaml`, `deploy.sh`, `src/server/auth/actions.ts`, `src/server/auth/rbac.ts`, `src/server/storage/index.ts`, `src/server/notifications/outbox.ts`, `db/migrations/0011_notification_outbox.sql`, `db/migrations/0012_customer_role.sql`, `tests/server/auth/actions.test.ts`, `tests/server/notifications/outbox.test.ts`, `tests/server/storage/provider.test.ts`, `tests/deploy/compose-contract.sh`, `openspec/changes/soprotelco-ecommerce-rebuild/tasks.md`.

PR 2B depends on PR 2A and must be opened against it: it records evidence for code that only exists in PR 2A.

## Deviations from Design
None — the implementation matches the server-foundation design. Task 2.2 was reconciled from verified pre-existing code rather than duplicated.

## Issues Found
- PostgreSQL 18 Docker images reject mounting the data volume directly at `/var/lib/postgresql/data`; the Compose mount must target `/var/lib/postgresql` so the image can manage major-version-specific data directories.
- Playwright `networkidle` is not a reliable readiness condition for the current Next.js smoke page; a page-specific visible heading assertion is the meaningful readiness proof.
- Default Docker build networking can time out when Corepack fetches pnpm in this environment; the CI-equivalent build uses Docker host networking for the build-time registry fetch.
- Mutating DB helpers must share one pre-connection `_test` guard; otherwise seed/reset safety can drift.
- The branch already contains later domain/UI work despite stale SDD task checkboxes; task 2.2 and storage portions of task 2.3 were verified from source, history, and behavior tests before reconciling artifacts.

## Remaining Tasks
- [ ] 3.1-5.3 remain pending in the SDD task artifact and are outside this chained slice.
- [ ] Production storage/handoff configuration, import/cutover, and a fresh full SDD verification pass remain outstanding.

## Status
7/16 tasks complete. PR 3A visual identity foundation is complete and ready for a fresh SDD verify.

## Final Configuration Correction
- Added the non-secret explicit `STORAGE_PROVIDER=local` example under the storage runtime section of `.env.example`; the prior verification warning is resolved without restoring a Compose fallback.
- `bash tests/deploy/compose-contract.sh`, `bash tests/deploy/run.sh`, `docker compose --env-file .env.example config --quiet`, and `pnpm test tests/server/storage/provider.test.ts` passed.
- Recomputed added-plus-deleted accounting: PR 2A is 383 additions + 17 deletions = 400 (now includes `.env.example`); PR 2B is 206 additions + 95 deletions = 301. Both remain within budget.

## PR 3A: Visual Identity Foundation
- Inspected the legacy global theme, layout, and public Header/Hero/Ticker/PromoBanner/Support/Footer components read-only. The extracted palette preserves navy `#0c1a2a`, primary `#0f4c81`, blue `#1b6eac`, cyan `#06d3f9`/`#7cf3ff`, muted `#5e6c80`, and Inter typography.
- Copied only the approved `public/assets/img/sp-logo-white.png` legacy asset to `public/assets/brand/soprotelco-logo-white.png`; both are 2924×1878 RGBA PNGs with SHA-256 `17a2ff85ed9c58ece86b4c0260ddb49c624413f59d1dabcaa7d0d47efdc30f26`.
- Kept `src/app/globals.css` as the selective token translation (not a wholesale legacy CSS copy) and pointed the footer at the provenance-preserving brand path.
- Added contract coverage proving the approved asset exists with a PNG signature, the tokens remain present, and the brand asset/CSS surface contains no Supabase, Base64, or data-URI coupling.

## Workload / PR Boundary — PR 3A
- Mode: chained PR slice; strategy: feature-branch-chain.
- Boundary: visual tokens, one verified static logo, its footer reference, and behavior/contract tests only. No new routes, catalog/cart, quote/checkout, admin, deployment, SSH, live data, or port `8585` work.
- Rollback: revert the brand asset, footer source reference, safety test, and task/artifact entries together.

## PR 3A Verification
- `pnpm test tests/foundation/brand-assets.test.ts tests/components/layout/footer.test.tsx` passed: 2 files, 10 tests.
- `pnpm test` passed: 70 files, 559 tests.
- `pnpm lint`, `pnpm typecheck`, and `pnpm build` passed.
- SHA-256 provenance comparison and PNG inspection passed; targeted static source scan found no Supabase, data-URI, or Base64 coupling in the brand CSS/footer surface.

## PR 3A Corrective Retry
- Replaced the obsolete foundation-heading E2E assertion with the visible, accessible `Navegación principal` landmark and its scoped `Productos` link; this verifies the current public SOPROTELCO shell without coupling the smoke test to dynamic hero content.
- Strengthened the brand contract to reject a symlink or arbitrary PNG: it now requires the approved brand-root path, PNG signature, 2924×1878 IHDR dimensions, and SHA-256 `17a2ff85ed9c58ece86b4c0260ddb49c624413f59d1dabcaa7d0d47efdc30f26`.
- Added only values evidenced in legacy `src/app/globals.css`: `#f4f7fc` background, `#fff` surface, `#0a1728` ink, `#e0e8f2` border, 0.875rem/1.125rem spacing, 16px radius, legacy shadow, and body 16.5px/1.6/500 rendering. The body now uses the evidenced surface and typography tokens.
- Deferred to task 3.2: apply the legacy heading values (`h1` 32–52px/900/1.1, `h2` 26–38px/950/1.1/-0.02em, `h3` 17.5px/700/1.3) and component-level layout spacing only when public-route component ownership is in scope; no values were invented or applied to inherited route components here.

## PR 3A Corrective Verification
- Focused Vitest: `pnpm test tests/foundation/brand-assets.test.ts tests/foundation/design-tokens.test.ts tests/components/layout/footer.test.tsx` passed (3 files, 18 tests).
- Full Vitest: `pnpm test` passed (70 files, 560 tests). Playwright: after an isolated local PostgreSQL migration run, `PORT=8595 PLAYWRIGHT_BASE_URL=http://127.0.0.1:8595 ... pnpm test:e2e` passed (1 test); port 8585 was not used.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, `bash tests/deploy/compose-contract.sh`, `bash tests/deploy/run.sh`, direct SHA-256/PNG dimension checks, and `git diff --check` passed.

## PR 3A Corrective Review Accounting
- Corrective source/test/documentation delta: 76 additions and 9 deletions; this 14-line OpenSpec evidence record brings the corrective total to 90 additions and 9 deletions (99 changed lines). The bounded visual-foundation slice remains below 400 changed lines.
- No task checkbox changed because task 3.1 was already checked in both hybrid task artifacts. No task 3.2+, admin, deploy, SSH, live access, commit, push, PR, secret, or destructive Git action occurred.

## PR 3B: Shared Public Shell and Home Parity Foundation
- Read-only legacy comparison covered `src/app/page.tsx`, `Header.tsx`, `Hero.tsx`, `Ticker.tsx`, `PromoBanner.tsx`, `Support.tsx`, and `Footer.tsx`. The legacy home order is header → hero → ticker → promotional banner → product content → support → footer.
- Preserved the existing responsive public shell and added only the legacy-evidenced global heading scale: `h1` 32–52px/900/1.1, `h2` 26–38px/950/1.1/-0.02em, and `h3` 17.5px/700/1.3. Heading colors remain component-owned so existing public and future admin contexts are not overridden.
- Added behavior-first coverage for compact-navigation semantics (open state, mobile landmark, route, Escape dismissal) and optional hero-background absence. Playwright now proves the public shell at desktop and the `375×812` compact viewport.
- No legacy image was copied in this slice. The prior approved static brand asset remains regular, non-symlinked, PNG-valid, and pinned to SHA-256 `17a2ff85ed9c58ece86b4c0260ddb49c624413f59d1dabcaa7d0d47efdc30f26`; no Supabase URL, Base64 data URI, secret, or generated artifact was introduced.

## PR 3B Verification
- `pnpm test` passed: 70 files, 564 tests.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, `bash tests/deploy/compose-contract.sh`, `bash tests/deploy/run.sh`, and `git diff --check` passed.
- An isolated local PostgreSQL container accepted migrations `0001`–`0012`; `PORT=8595 PLAYWRIGHT_BASE_URL=http://127.0.0.1:8595 pnpm test:e2e` passed 2 Chromium tests. The temporary container, network, and volume were removed. Port `8585` was not bound or used.

## PR 3B Scope and Task Disposition
- Mode: chained PR slice; strategy: feature-branch-chain. Child targets the immediate PR 3A parent/tracker branch, never `main`.
- Boundary: shared shell typography, primary-navigation accessibility evidence, optional-asset fallback evidence, and home smoke coverage. Rollback is limited to `globals.css`, the three focused test surfaces, and these OpenSpec records.
- Review budget: 121 additions + 0 deletions = 121 changed lines against the pre-PR-3B working-tree baseline, including the task and apply-progress records; within the 400-line limit.
- Task `3.2` remains unchecked: catalog, category, product, cart, contact, account-entry, privacy, and terms route completion has not been claimed or fully evidenced by this slice.

## PR 3C: Catalog, Category, and Product Detail Parity Foundation
- Read-only legacy evidence: `src/app/productos/page.tsx` uses a filter/sidebar + responsive 2/3-column product grid, Spanish labels, `Cargando catálogo...`, and a `No encontramos productos` empty state; `src/app/productos/[category]/page.tsx` retains the same layout for a decoded category with `Cargando categoría...` and a category-specific empty state; `src/app/producto/[id]/ProductClient.tsx` uses breadcrumbs, a square contained image area, a Spanish product-not-found view, quote contact, and related products. Legacy Supabase queries, remote `placehold.co` fallbacks, cart writes, and client-side diagnostics were intentionally excluded.
- Verified existing current-branch foundations at `/productos` and `/producto/[slug]`: server-side active-product queries, Spanish product cards/quote entry, product `notFound()` behavior, same-category related products, and the safe inline `Sin imagen` placeholder. This slice does not claim to have authored those existing routes.
- Added `/productos/[category]` as a server route through `getCategories()` and `getProducts({ categorySlug })`, preserving the responsive catalog/grid layout, Spanish breadcrumbs, product count, empty category state, and a clear `/productos` return link. Added segment loading boundaries for catalog/category and product detail (`Cargando catálogo...` / `Cargando producto...`).
- Added behavior-first Vitest coverage for browsing, empty category navigation, unknown products, and missing-image fallback. The new category test failed first because `@/app/productos/[category]/page` did not exist; it passed after implementation.
- Data truth: there is no fixture or demo fallback. Browse/category/detail use the existing PostgreSQL repository/service boundary; without a reachable configured database, runtime data cannot be rendered. No migration, live database, Supabase URL, secret, Base64 payload, or generated artifact was used.

## PR 3C Verification
- Focused routes: `pnpm test tests/app/storefront-catalog-routes.test.tsx tests/app/producto/page.test.tsx` passed: 2 files, 8 tests.
- Full Vitest: `pnpm test` passed: 71 files, 568 tests. `pnpm lint`, `pnpm typecheck`, `pnpm build`, `bash tests/deploy/compose-contract.sh`, `bash tests/deploy/run.sh`, focused brand asset/token tests, and `git diff --check` passed.
- Bounded Playwright was attempted on port `8596` (not `8585`) and was blocked before tests by the local `.env` database host `db` being unreachable (`getaddrinfo ENOTFOUND db`). No container, seed, migration, deployment, or production service was started. The Vitest route contracts are the evidence for this slice; a seeded local PostgreSQL environment is required for a browser browse smoke.

## PR 3C Scope and Task Disposition
- Mode: chained PR slice; strategy: feature-branch-chain. Child targets the immediate PR 3B parent/tracker branch, never `main`.
- Boundary: category route, loading UI, catalog/product behavior contracts, and hybrid SDD records. Rollback removes those four source/test files and these records; it does not alter the pre-existing catalog/product foundations.
- Review budget: 213 additions + 0 deletions, including OpenSpec records, within the 400-line limit.
- Task `3.2` remains unchecked because cart, contact, account entry, privacy, and terms are not implemented or evidenced by PR 3C. Task `3.3` database/catalog domain wiring is not claimed complete.

## PR 3C Corrective Retry
- Added one centralized storefront image policy: canonical local adapter paths are accepted; every remote, malformed, Base64/data, Supabase, and arbitrary configured-origin value becomes the local `Sin imagen` fallback before render. Both the service read model and card/detail render path apply it.
- Added the Spanish `/producto/[slug]/not-found` boundary, named catalog/product breadcrumbs, legacy-evidenced `grid-cols-2 lg:grid-cols-3` catalog grids, and `Cargando categoría...` category loading copy.
- Catalog cards now expose the existing `/contacto?producto=<slug>` quote entry only; no cart, checkout, payment, or task 3.3 work was added.
- `tests/catalog/catalog.spec.ts` proves PostgreSQL-backed browse/category/empty-category/unknown-product/null-and-unsafe-image fallback/quote accessibility. The test is run only after the existing `_test` reset and migrations; its ephemeral Compose database, volume, network, and app port are removed after the run.

## PR 3C Corrective Verification
- Focused Vitest: 3 files, 31 tests passed. Full Vitest: 71 files, 573 tests passed. Lint, typecheck, build, Compose contract, deploy safety checks, Docker runner build, and `git diff --check` passed.
- Isolated PostgreSQL `websoprotelco_test` at `127.0.0.1:55434` accepted migrations 0001–0012 and the committed catalog seed; Playwright passed at port `8598`. Port `8585` was not used. Cleanup removed the temporary DB container, network, and volume.

## PR 3C Corrective Boundary
- Mode: chained PR slice, feature-branch-chain, target the immediate PR 3C parent/tracker branch and never `main`.
- Boundary: only catalog safety/parity blockers and their tests/artifacts; rollback removes the image-policy, not-found/loading, card entry, catalog seed/spec, and this evidence. Task `3.2` remains unchecked.

## PR 3C Incident Correction
- The catalog image-policy tests now deterministically reject `file:` as a stored value and prove `NEXT_PUBLIC_CATALOG_IMAGE_ORIGIN` has no effect on renderability.
- The product-detail route has a semantic contract for the visible `Solicitar cotización` link and its encoded `/contacto?producto=<slug>` target.
- CI owns one `websoprotelco_ci_test` PostgreSQL 18 service with non-production credentials. It waits for health, migrates twice to prove idempotency, resets, migrates again, seeds, then runs Playwright at port `8598`; E2E no longer depends on an optional secret. GitHub Actions owns service teardown and the always-run diagnostics step preserves cleanup evidence.
- Local CI lifecycle evidence: a temporary `websoprotelco_ci_test` Compose database at `127.0.0.1:55435` passed health → migration → idempotency → reset → migration → seed → all three Playwright tests at `8598`; the container, network, and volume were removed by the shell cleanup trap.
- Review units were recomputed from base `2ba526b7c80b395b44b725b31cbd0997ca99d097` using deterministic path-restricted binary diffs. PR 3C is split into policy/CTA and routes/E2E/CI units; task `3.2` remains unchecked.
- Receipt: PR 3A `119 + 4 = 123`, SHA-256 `f0facfb4ebc7d7a129ae2c7cdb9393c4267f3a921b620a29e7a760a62dd7c83f`; PR 3B `73 + 7 = 80`, SHA-256 `27caa2deae7eb626b37345deecb1bd184a9a03d2aeaa228d770ad7ae69e653c4`.
- Receipt: PR 3C1 `124 + 14 = 138`, SHA-256 `b51fd5e5483a73cbbde289cbdcdaffb3769beae580841fed4f66339cc5861ffa`; PR 3C2 `319 + 7 = 326`, SHA-256 `54be2ea15d5c01ea4a0355eebfbccfb687c6130545798779b75c50fbae1abec0`.

## PR 3C Final Image-Origin Correction
- Catalog rendering is now local-only: `getSafeCatalogImageUrl()` accepts only the canonical `/uploads/<date>-<uuid>.(jpg|png|webp)` contract and ignores `NEXT_PUBLIC_CATALOG_IMAGE_ORIGIN` entirely. Absolute URLs, protocol-relative values, credentials, Base64/data, javascript, blob, file, malformed, and traversal-like values fall back to `Sin imagen`.
- Deterministic Vitest cases prove matching configured Supabase, arbitrary HTTPS, and credential-bearing origins remain rejected; a hostile configured Supabase origin cannot affect canonical local rendering. The obsolete remote-origin example was removed from `.env.example`.
- Playwright ran with `NEXT_PUBLIC_CATALOG_IMAGE_ORIGIN=https://project.supabase.co` against a seeded matching Supabase product URL. It rendered `Sin imagen`, rendered no unsafe product image, and observed zero Supabase requests. The owned `websoprotelco_ci_test` lifecycle at `127.0.0.1:55437` completed health → migrate → idempotency → reset → migrate → seed → browser test → cleanup; port 8585 was not used.
- Updated receipts from base `2ba526b7c80b395b44b725b31cbd0997ca99d097`: PR 3C1 `93 + 15 = 108`, SHA-256 `7d77a7726923f88df1ff9e90bafabe19adeba148f2d3903b22bcd26882fea687`; PR 3C2 `323 + 7 = 330`. Both remain within the 400-line limit. Task 3.2 remains unchecked. The PR 3C2 SHA-256 is superseded by the reproducible receipt below; the earlier `e26fd5f5095e1a08b0d1b74dab228ceb2a81a4725470bcf1bb5f30f188260fd0` value never matched the ordered manifest and is retired.

### PR 3C2 reproducible review receipt

Base:
2ba526b7c80b395b44b725b31cbd0997ca99d097

Ordered manifest (11 files, git tree order):
1. .env.example
2. .github/workflows/ci.yml
3. src/app/producto/[slug]/loading.tsx
4. src/app/producto/[slug]/not-found.tsx
5. src/app/productos/[category]/loading.tsx
6. src/app/productos/[category]/page.tsx
7. src/app/productos/loading.tsx
8. src/app/productos/page.tsx
9. tests/app/storefront-catalog-routes.test.tsx
10. tests/catalog/catalog.spec.ts
11. tests/helpers/seed-database.ts

Recipe:
Same convention that reproduces PR 3C1 exactly — a path-restricted `git diff` against the base, hashed with SHA-256, with additions/deletions from `git diff --numstat`. Because this unit contains new (untracked) files, the manifest paths are intent-to-added into a throwaway index copy so `git diff` renders them as additions; the real index is never modified (no staging). `git diff` emits files in tree order, so the SHA-256 depends only on the file set and base, not on argument order. Run from the repository root:

```bash
BASE=2ba526b7c80b395b44b725b31cbd0997ca99d097
FILES=(
  .env.example
  .github/workflows/ci.yml
  "src/app/producto/[slug]/loading.tsx"
  "src/app/producto/[slug]/not-found.tsx"
  "src/app/productos/[category]/loading.tsx"
  "src/app/productos/[category]/page.tsx"
  src/app/productos/loading.tsx
  src/app/productos/page.tsx
  tests/app/storefront-catalog-routes.test.tsx
  tests/catalog/catalog.spec.ts
  tests/helpers/seed-database.ts
)
TMPIDX="$(mktemp)"; cp .git/index "$TMPIDX"
GIT_INDEX_FILE="$TMPIDX" git add -N -- "${FILES[@]}"
GIT_INDEX_FILE="$TMPIDX" git diff --numstat "$BASE" -- "${FILES[@]}"   # additions/deletions
GIT_INDEX_FILE="$TMPIDX" git diff "$BASE" -- "${FILES[@]}" | sha256sum # receipt hash
rm -f "$TMPIDX"
```

Additions: 323
Deletions: 7
Total: 330 (≤ 400)
SHA-256: 639cb2ef34d35845d2d2c0fcd535884ed291fcebc82f96be7714e940e6089159

Reproduction:
- Run 1: 11 files, 323 + 7 = 330, SHA-256 `639cb2ef34d35845d2d2c0fcd535884ed291fcebc82f96be7714e940e6089159`
- Run 2: 11 files, 323 + 7 = 330, SHA-256 `639cb2ef34d35845d2d2c0fcd535884ed291fcebc82f96be7714e940e6089159`
- Match: Yes
- Matches the independent verification's fresh computation (`639cb2ef…`) exactly; no overlap with PR 3A, PR 3B, or PR 3C1; no duplicate paths; `apply-progress.md`/`verify-report.md` are excluded as separate evidence.

## PR 3D: Public Routes Non-Cart Parity Slice

### Legacy evidence and implementation truth
- Read-only comparison: legacy `/contacto` supplies the Spanish `Contáctanos` hero, WhatsApp/email/hours cards, and required name/email/phone/subject/message controls; its submit handler only prevents the default browser submit. Legacy `/privacidad` and `/terminos` are setting-backed pages with a visible unavailable fallback, and the footer links both legal routes. Legacy `/cuenta` is a protected customer dashboard.
- The rebuilt contact route keeps the recognizable Spanish contact layout and required labelled controls, preserves the catalog handoff only for a lowercase hyphenated `?producto=<slug>`, and drops malformed values before render.
- Persistence truth: this slice deliberately removes the contact form's `createLead` server action. The corrective retry replaces the initial GET fallback with a non-submitting control while retaining the honest `role=status` notice and WhatsApp/email alternatives; it neither inserts a lead nor claims that a message was received. Lead/request writes belong to task 3.3/3.4.
- Existing first-party role landing remains evidenced by auth contracts: customer sign-in targets `/cuenta`; staff/admin target `/admin`. Existing legal pages retain Colombian privacy content, last-updated metadata, and footer navigation without Supabase or external images.

### Route and test matrix
| Route / behavior | Evidence | Result |
|---|---|---|
| `/contacto?producto=fusionadora-segura` | Required labelled form fields, accessible WhatsApp link, safe product context, non-persistent availability state | Vitest + Playwright passed |
| malformed `?producto=` | Script-like value omitted from rendered contact context | Vitest passed |
| `/privacidad`, `/terminos` | Spanish legal headings, Ley 1581 de 2012, settings-based identity/contact, footer navigation | Existing Vitest + Playwright passed |
| `/cuenta` unauthenticated entry | Redirects to accessible `/login`; customer/admin role landings remain in auth action tests | Existing Vitest + Playwright passed |

### PR boundary and reproducible receipt
- Mode: chained PR slice; strategy: feature-branch-chain. This child targets the immediate PR 3C2 parent/tracker branch, never `main`.
- Boundary: contact availability/trusted product context plus behavior and browser coverage. No cart, checkout/payment, admin, domain persistence write, live service, migration, deployment, secret, or Supabase change is included.
- Rollback: revert only `src/app/contacto/page.tsx`, `tests/app/contacto/page.test.tsx`, and `tests/public-routes/public-routes.spec.ts`; the separately recorded SDD evidence can be reverted independently.
- Base: `2ba526b7c80b395b44b725b31cbd0997ca99d097`.
- Ordered manifest (git tree order): `src/app/contacto/page.tsx`; `tests/app/contacto/page.test.tsx`; `tests/public-routes/public-routes.spec.ts`.
- Recipe: copy `.git/index` to `TMPIDX`; use `GIT_INDEX_FILE="$TMPIDX" git add -N -- "${FILES[@]}"`; then run `GIT_INDEX_FILE="$TMPIDX" git diff --numstat "$BASE" -- "${FILES[@]}"` and hash `GIT_INDEX_FILE="$TMPIDX" git diff "$BASE" -- "${FILES[@]}" | sha256sum`; delete `TMPIDX`. The real index was never staged or modified.
- Reproduced twice: 84 additions + 18 deletions = 102 changed lines; SHA-256 `9523c486eba545b3561e2ceeb1570601fd94a019d5c40f13a54cd2121501776a`; ≤400 and non-overlapping with the PR 3C manifests. `apply-progress.md` and `tasks.md` are separate evidence and excluded from the implementation receipt.

### PR 3D verification
- Focused Vitest: `tests/app/contacto/page.test.tsx`, `tests/app/cuenta/page.test.tsx`, and `tests/app/legal/legal.test.tsx` — 3 files, 13 tests passed.
- Full Vitest: 72 files, 579 tests passed. `pnpm lint`, `pnpm typecheck`, and `pnpm build` passed.
- Isolated PostgreSQL `websoprotelco_public_routes_test` at `127.0.0.1:55439` passed health → migrate → idempotency → guarded reset → migrate → seed → Playwright at port `8599` → cleanup. Port `8585` was not used.
- `bash tests/deploy/compose-contract.sh`, `bash tests/deploy/run.sh`, `docker compose --env-file .env.example config --quiet`, runner/migrator Docker builds, and `git diff --check` passed.
- Task 3.2 remains unchecked: cart is intentionally not implemented, so its cart readiness and invalid-quantity scenarios are still outstanding. 7/16 top-level tasks are complete.

### PR 3D corrective gate retry
- Slice status: **SUCCESS**. The bounded contact/account-entry/privacy/terms evidence is complete for PR 3D; no cart route or persistence behavior is claimed.
- Parent task status: **INCOMPLETE**. Task 3.2 remains unchecked because cart implementation, cart readiness, and invalid-quantity acceptance scenarios are the explicit next work.
- Receipt revalidated twice from the declared three-path manifest: `84 + 18 = 102` changed lines and SHA-256 `9523c486eba545b3561e2ceeb1570601fd94a019d5c40f13a54cd2121501776a`; it has no path overlap with PR 3A–3C2.

### PR 3D contact privacy corrective retry
- Replaced the GET form with a non-submitting `fieldset` and a `type="button"` control. Entering or clicking with contact PII cannot navigate, issue a form request, reach a URL/history/query string, or invoke persistence; the visible Spanish availability state and legacy WhatsApp/email fallbacks remain.
- Focused Vitest passed (3 tests); isolated `_test` Playwright passed after filling PII and clicking `Preparar mensaje` at port `8601`. It observed an unchanged URL, no requests after the click, and the honest unavailable status. Port `8585` was not used; the temporary database was removed.
- Reproducible three-path receipt from base `2ba526b7c80b395b44b725b31cbd0997ca99d097`: two matching runs, `104 + 20 = 124` changed lines, SHA-256 `aaef568052f57ca483344e8119b737b645c41265da8ef1429b25aca4d5a509af`. Task 3.2 remains unchecked; task 3.3 and all persistence remain out of scope.

## PR 3E: Cart Public-Route Completion

### Corrective retry status — complete
- The cart parser uses a strict Zod contract derived from the PostgreSQL product default (`COP`): hostile browser-local records with an unsupported currency, malformed identity/slug/name, invalid price or quantity, or unexpected `imageUrl` are omitted before render. `/carrito` formats only the canonical `COP` constant, so untrusted currency never reaches `Intl.NumberFormat`.
- Focused Vitest and isolated `_test` Playwright passed, including a malicious `NOT_A_CURRENCY` localStorage seed that reaches `/carrito` safely with the empty state and no total.
- `src/components/catalog/product-card.tsx` is restored exactly to the persisted PR 3C1 receipt (`93 + 15 = 108`, SHA-256 `7d77a7726923f88df1ff9e90bafabe19adeba148f2d3903b22bcd26882fea687`, reproduced twice).
- Cart totals now fail closed outside the safe-integer range. `calculateCartTotal()` rejects any line total or running sum that is not a safe integer, and `/carrito` renders an `role="alert"` Spanish message instead of a silently rounded number. Covered by extreme-value unit cases (`priceCents = Number.MAX_SAFE_INTEGER`, `quantity = 99`) and an accumulation case.
- A Playwright contract (`@CART-E2E-003`) intercepts every request across add, update, and remove and asserts zero `POST`/`PUT`/`PATCH`/`DELETE` and zero `/api/` requests, proving the cart performs no server write.
- **Former blocker resolved by commit ordering, not by path duplication.** `src/app/productos/page.tsx` and `src/app/productos/[category]/page.tsx` import `CartProductCard`, so the cart slice is committed *before* the catalog-route slice. Each path stays in exactly one commit, and every commit typechecks and builds on its own. Ordering the chain — rather than splitting a file across two units — is what removes the overlap.

### Cart persistence truth and legacy parity
- Legacy evidence: catalog cards expose `Cotizar` and `Comprar`; its drawer increments/decrements/removes quantities, displays a subtotal and an empty state. The legacy order API, Supabase, payment coordination, and fake order-received state are deliberately excluded.
- The rebuilt catalog now provides `Agregar`; `/carrito` retains the branded Spanish layout, a quantity field, removal control, estimated total, empty return to `/productos`, and `Preparar cotización` to the existing contact preparation route.
- Cart data is browser-local only. It creates no request, lead, order, payment, API call, server action, or PII payload; the visible disclosure says so. Malformed browser-local entries are ignored, and availability is not represented as an order promise.

### Complete task 3.2 route and scenario matrix
| Route / scenario | Evidence | Result |
|---|---|---|
| `/` home; `/productos`; `/productos/[category]`; `/producto/[slug]` | PR 3B/3C Vitest and isolated PostgreSQL Playwright coverage | Passed previously, retained |
| `/carrito` add/update/remove/empty/totals | 9 focused Vitest tests and isolated Chromium `@CART-E2E-001` | Passed |
| Invalid, zero, negative, fractional, and over-limit quantity | `validateQuantity()` rejects non-positive/non-integers and clamps over-limit to 99; focused Vitest | Passed |
| Unavailable card/malformed local cart entry; image fallback | unavailable products expose no add control; malformed cached values are ignored; PR 3C local-only `Sin imagen` contracts remain | Passed |
| `/contacto`, `/cuenta`, `/privacidad`, `/terminos` | PR 3D Vitest and isolated Playwright evidence | Passed previously, retained |
| No payment, fake success, or server persistence | visible cart disclosure plus source/browser tests; no new write boundary | Passed |

### PR 3E receipt and verification
- Ordered manifest: `openspec/changes/soprotelco-ecommerce-rebuild/tasks.md`, `src/app/carrito/page.tsx`, `src/components/cart/add-to-cart-button.tsx`, `src/components/cart/cart-content.tsx`, `src/components/cart/cart-storage.ts`, `src/components/catalog/product-card.tsx`, `src/components/layout/header.tsx`, `tests/cart/cart.spec.ts`, `tests/components/cart/cart-storage.test.tsx`.
- Throwaway-index reproduction against `2ba526b7c80b395b44b725b31cbd0997ca99d097` ran twice: `262 + 6 = 268` changed lines; SHA-256 `3bc2b5f456d40e448397e8c7652b2ad36239acfd8b7879b56b8c5e435c4df134`. The real index was not staged or changed. The task checkbox evidence is included; the cumulative apply-progress record remains separate to avoid re-charging prior slices.
- Focused and full Vitest passed (9 focused; 73 files/588 tests full); lint, typecheck, build, Compose/deploy checks, runner/migrator Docker builds, and `git diff --check` passed. Isolated PostgreSQL `websoprotelco_cart_test` at `127.0.0.1:55440` completed health → migrate → idempotency → guarded reset → migrate → seed → Playwright at port `8602` → cleanup. Port `8585` was not bound.

### Task disposition
- Task 3.2 is complete and checked in both hybrid task artifacts. Task 3.3 remains pending: no quote/order persistence, checkout action, payment UI, admin work, notification, or external handoff was added.
