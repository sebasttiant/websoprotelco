# Verify Report: soprotelco-ecommerce-rebuild — PR 1 Corrective Re-verify

## Status
PASS for the PR 1 foundation slice and the later client-delivery hygiene cleanup. This does not mean the full ecommerce/admin product is client-delivery complete.

## Mode
Standard SDD verify. Strict TDD Mode was not active per `apply-progress.md`.

## Scope
Verified PR 1 only: runtime, Docker, CI, and test harness foundation after corrective fixes for Playwright readiness, CI-equivalent Docker build networking, DB helper safety, local artifact cleanup, and CI permission hardening. Phase 2+ auth/RBAC/storage/catalog/admin/import work remains intentionally out of scope and was checked only for leakage into PR 1.

## Artifact Evidence
- OpenSpec files read: `proposal.md`, `design.md`, `tasks.md`, `apply-progress.md`, prior `verify-report.md`, and all change specs under `openspec/changes/soprotelco-ecommerce-rebuild/specs/**`.
- Skills read from exact injected paths: `sdd-verify`, `delivery-docker-first`, `chained-pr`, `typescript`, `zod-4`, `playwright`, and `work-unit-commits`.
- Runtime source inspected: `package.json`, `.nvmrc`, `Dockerfile`, `compose.yaml`, `.github/workflows/ci.yml`, `.env.example`, `src/app/**`, and `tests/**`.

## Completeness
| Task | Status | Evidence |
|---|---|---|
| 1.1 Runtime/package/TypeScript/Next/Tailwind setup | Complete | `package.json`, `pnpm-lock.yaml`, `.nvmrc`, `tsconfig.json`, `next.config.ts`, Tailwind/PostCSS/ESLint setup present; lint, typecheck, unit tests, and build passed. |
| 1.2 Docker, Compose, dockerignore, CI | Complete for PR 1 | `Dockerfile`, `compose.yaml`, `.dockerignore`, and `.github/workflows/ci.yml` present; Compose config passed; CI runtime image command uses `docker build --network host --target runner -t websoprotelco:ci .`; matching Docker build passed. |
| 1.3 Vitest, Playwright, base page, seed/reset helpers | Complete for PR 1 | Vitest passed; Playwright smoke passed after replacing `networkidle`; DB reset and seed helpers share the same pre-connection `_test` guard; DB safety unit tests prove `_test` URLs are accepted and non-`_test`/protected URLs are rejected without a live database. |

## Command Evidence
| Command | Result |
|---|---|
| `node --version` | Passed: `v24.16.0`. |
| `pnpm --version` | Passed: `11.9.0`. |
| `pnpm lint` | Passed. |
| `pnpm typecheck` | Passed. |
| `pnpm test` | Passed: 1 Vitest test in `tests/foundation/runtime.test.ts`. |
| `pnpm test` | Passed after DB helper safety cleanup: 2 Vitest files, 5 tests. |
| `pnpm test tests/helpers/database-url.test.ts` | Passed: 4 DB helper safety tests cover `_test` allow and non-`_test`/protected rejection without a live database. |
| `pnpm build` | Passed: Next.js 16.2.10 standalone build completed; routes `/`, `/_not-found`, and `/api/health`. |
| `pnpm test:e2e` | Passed: 1 Playwright Chromium smoke test in 10.5s. |
| `docker compose config --quiet` | Passed. |
| `docker compose config` | Passed and showed PostgreSQL port binding with `host_ip: 127.0.0.1` and volume target `/var/lib/postgresql`. |
| `POSTGRES_DB=websoprotelco_test POSTGRES_PORT=55432 docker compose down -v` | Passed cleanup before DB verification. |
| `POSTGRES_DB=websoprotelco_test POSTGRES_PORT=55432 docker compose up -d --wait db` | Passed; PostgreSQL 18 service became healthy. |
| `DATABASE_URL=.../websoprotelco_test pnpm test:db:reset` | Passed; `_test` database was accepted. |
| `DATABASE_URL=.../websoprotelco_test pnpm test:db:seed` | Passed during earlier live DB verification. Current seed helper still requires `_test` before connecting. |
| `DATABASE_URL=.../websoprotelco pnpm test:db:reset` | Failed as expected before connecting with `Refusing to use non-test database: websoprotelco`. |
| `DATABASE_URL=.../websoprotelco pnpm test:db:seed` | Failed as expected before connecting with `Refusing to use non-test database: websoprotelco`. |
| `POSTGRES_DB=websoprotelco_test POSTGRES_PORT=55432 docker compose down -v` | Passed cleanup after DB verification. |
| `docker build --network host --target runner -t websoprotelco:ci .` | Passed; validates the CI-equivalent updated Docker build gate. |
| `docker compose config --quiet` | Passed after CI permission hardening. |
| `pnpm lint` | Passed after client-delivery hygiene cleanup; emitted a local Node engine warning (`current v24.18.0`, expected `24.16.0`). |
| `pnpm typecheck` | Passed after client-delivery hygiene cleanup; emitted the same local Node engine warning. |
| `pnpm test` | Passed after client-delivery hygiene cleanup; 2 files and 5 tests passed, with the same local Node engine warning. |
| `docker compose config --quiet` | Passed after client-delivery hygiene cleanup. |

## Corrective Fix Verification
| Fix | Result | Evidence |
|---|---|---|
| Playwright readiness no longer waits for `networkidle` | Passed | `tests/base-page.ts` uses `page.goto(..., { waitUntil: "domcontentloaded" })` plus visible `body`; `pnpm test:e2e` passed. |
| CI-equivalent Docker build uses host networking | Passed | `.github/workflows/ci.yml` runs `docker build --network host --target runner -t websoprotelco:ci .`; same command passed locally. |
| Shared `_test` database helper guard | Passed | `tests/helpers/database-url.ts` enforces the `_test` contract; reset and seed helpers both call `getTestDatabaseUrl()` before constructing a `pg` client. |
| DB safety unit coverage | Passed | `tests/helpers/database-url.test.ts` proves `_test` URLs are accepted and non-`_test`/protected URLs are rejected without requiring a live database. |
| `.env.example` safe values | Passed | `.env.example` exists and uses `POSTGRES_DB=websoprotelco_test` plus `DATABASE_URL=.../websoprotelco_test`, aligned with the reset guard. |
| Compose localhost PostgreSQL binding | Passed | `compose.yaml` publishes `127.0.0.1:${POSTGRES_PORT:-5432}:5432`; Compose config is valid and exposes `host_ip: 127.0.0.1`. |
| Local `.atl/` artifacts removed | Failed | `.gitignore` ignores `.atl/`, but both files are still tracked and still regenerated by the registry tooling. `.gitignore` has no effect on tracked paths. Requires `git rm -r --cached .atl`. |
| CI least privilege | Passed | `.github/workflows/ci.yml` declares `permissions: contents: read`. |

## Spec Compliance Matrix
| Requirement Area | PR1 Finding |
|---|---|
| delivery-platform / modern Docker-first runtime | Compliant for PR 1. Versions align across `.nvmrc`, `package.json`, CI, and Dockerfile; host-network CI-equivalent runtime Docker build passed. |
| delivery-platform / CI gates | Compliant for PR 1. Lint, typecheck, unit test, Playwright smoke, build, Compose validation, and Docker build all passed. |
| delivery-platform / PostgreSQL service | Compliant for PR 1 foundation. Compose uses `postgres:18`, localhost-only host port binding, and a PostgreSQL 18-compatible volume target. |
| testing-quality / test harness | Compliant for PR 1 foundation. Vitest, Playwright page-object smoke, and DB reset/seed helpers are present; DB helper safety has live-DB-free unit coverage. |
| postgres-persistence / full domain model | Out of scope for PR 1. Canonical schema/migrations begin in Phase 2 and remain intentionally incomplete. |
| Phase 2+ feature scenarios | Out of scope for PR 1 and not evaluated as failures. |

## PR1 Boundary Check
- No `src/domains/**`, `src/server/**`, `db/**`, catalog, checkout, admin, auth/RBAC, storage, import, or feature commerce implementation was found.
- `src/app/**` contains only the minimal home page, root layout, global CSS, and `/api/health` route needed for foundation/build/health checks.
- Keyword/path checks found no PR2+ runtime implementation leakage; matches in OpenSpec artifacts are planning/spec text only.
- The `.atl/` cleanup is incomplete: the paths are ignored but still tracked, so they keep reappearing as modifications. Final staging/PR creation should still review the diff boundary and changed-line budget, and there is no claim that the full ecommerce/admin product is delivery-complete.

## Design Coherence
- The implementation remains inside the intended PR 1 foundation slice.
- Docker-first alignment is present across local scripts, CI metadata, Dockerfile, and Compose.
- Playwright uses a page-object structure and deterministic page readiness for the current smoke page.
- Mutating DB helpers are safer than the initial foundation by requiring `_test` databases before connecting.

## Issues
### Critical
- None.

### Warnings
- Phase 2+ spec scenarios are intentionally unimplemented; this report proves PR1 readiness only, not full ecommerce rebuild compliance.
- `postcss@8.4.31` is present transitively through `next@16.2.10`; no dependency override was applied in this small cleanup because that needs separate verification against Next, CI, and Docker.

### Suggestions
- Keep the CI Docker build command aligned with the verified host-network command unless the runner network issue is resolved another way.
- Before PR creation, run `git status --short` and a staged diff/stat review after staging only PR1 files.

## Final Verdict
PR 1 remains a verified platform foundation slice. Full client delivery is still blocked by the later ecommerce/admin/auth/data/import/cutover work.
