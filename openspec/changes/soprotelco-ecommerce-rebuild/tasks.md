# Tasks: SOPROTELCO Ecommerce Rebuild

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 4,000-8,000+ across chained slices |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Tracker → PR 1 → PR 2 → PR 3 → PR 4 → PR 5 → PR 6 → PR 7 |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Runtime, Docker, CI, test harness | PR 1 | base = feature/tracker; verify lint/type/test/build/container |
| 2 | PostgreSQL, auth, RBAC, storage foundations | PR 2 | base = PR 1; rollback before feature data writes |
| 3 | Brand shell and storefront catalog/cart | PR 3 | base = PR 2; visual parity and browse smoke |
| 4 | Quote requests, leads, handoff | PR 4 | base = PR 3; transactional checkout and outbox |
| 5 | Admin catalog/inventory/users/settings/documents | PR 5 | base = PR 4; protected admin operations |
| 6 | Import validation and cutover docs | PR 6 | base = PR 5; no silent data loss |
| 7 | Hardening and final smoke gates | PR 7 | base = PR 6; tracker integration readiness |

## Phase 1: Platform Foundation

- [x] 1.1 Create `package.json`, `pnpm-lock.yaml`, `.nvmrc`, `tsconfig.json`, `next.config.ts`, and Tailwind setup with latest stable aligned versions.
- [x] 1.2 Create `Dockerfile`, `compose.yaml`, `.dockerignore`, and `.github/workflows/ci.yml` for web, PostgreSQL, lint, typecheck, tests, build, and Docker build.
- [x] 1.3 Create `vitest.config.ts`, `playwright.config.ts`, `tests/base-page.ts`, and seed/reset helpers before feature slices.

## Phase 2: Server Foundations

- [x] 2.1 Create `db/migrations/**` and `src/server/db/**` for canonical PostgreSQL tables and migration checks.
  - Deviation: `db/schema.sql` was intentionally not created. Ordered migrations are the single source of truth; a parallel canonical dump would be a second source that silently drifts. Regenerate a dump with `pg_dump --schema-only` if one is ever needed.
  - Delivered: `0001_initial_schema.sql` (users, categories, products, quote_requests, quote_request_items), a checksum/ordering-guarded migration runner with an advisory lock, a validated env layer, a pooled client, and an opt-in DB health probe.
  - Not delivered: no repository/query layer reads these tables yet, and migrations are not run as part of container start-up.
- [ ] 2.2 Create `src/server/auth/**` with sessions, password hashing, `requireSession()`, and `requirePermission()`; test invalid credentials and bypass denial.
- [ ] 2.3 Create `src/server/storage/**` and `src/server/notifications/**` adapters for uploads metadata and `notification_outbox`.

## Phase 3: Storefront and Commerce

- [ ] 3.1 Create `public/assets/brand/**` and `src/app/globals.css` from safe legacy assets/tokens; exclude secrets and Supabase coupling.
- [ ] 3.2 Create public `src/app/**` routes for home, catalog/category/product, cart, contact, account entry, privacy, and terms.
- [ ] 3.3 Create `src/domains/catalog/**`, `storefront/**`, and `quote-order/**` with Zod 4 schemas, repositories, services, and checkout server action.
- [ ] 3.4 Test browse, empty category, unknown product, cart validation, no payment UI, request creation, and handoff unavailable/success states.

## Phase 4: Admin Operations

- [ ] 4.1 Create admin routes in `src/app/admin/**` and protected actions in `src/domains/admin/**`.
- [ ] 4.2 Create domain modules for `inventory`, `leads`, `users`, `settings`, `documents`, and `design` with RBAC-enforced writes.
- [ ] 4.3 Test authorized catalog update, inventory movement history, unauthorized operation denial, request status update, and invalid transition rejection.

## Phase 5: Import, Verification, Documentation

- [ ] 5.1 Create `db/import/**` validators for legacy data conflicts, rejected records, and no silent data loss.
- [ ] 5.2 Create Playwright smoke suites for storefront browse, quote request, sign-in, denied admin access, and permitted admin update.
- [ ] 5.3 Update `README.md` with Docker-first setup, migrations, CI gates, storage/handoff envs, and cutover/rollback checklist.
