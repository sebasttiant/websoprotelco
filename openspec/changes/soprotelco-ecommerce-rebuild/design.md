# Design: SOPROTELCO Ecommerce Rebuild

## Technical Approach

Build a new Docker-first Next.js App Router application in `websoprotelco`, using the legacy app only as evidence for routes, domain behavior, and visual identity. The target repo currently has no app source, package metadata, tests, Dockerfile, or CI. The legacy source shows Supabase-coupled auth/database/storage, client-side admin writes, no tests, app-only Docker, and no CI; therefore the rebuild will use server-first PostgreSQL boundaries, explicit RBAC, versioned migrations, upload abstractions, and tests before feature slices.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| Clean rebuild vs copy legacy | Copying preserves pixels faster but imports Supabase coupling, hard-coded bypasses, schema drift, and secret patterns. | Clean rebuild with selective visual/domain migration. |
| PostgreSQL + typed repositories vs Supabase adapters | More upfront schema work, but removes runtime Supabase dependency and centralizes transactions. | PostgreSQL latest stable with versioned migrations and server-only repositories. |
| First-party sessions/RBAC vs frontend checks | Requires auth tables and policy helpers, but prevents admin bypass. | DB-backed sessions, password hashing, roles/permissions checked in server actions/route handlers. |
| Transactional outbox vs RabbitMQ first | Less infrastructure initially, queue can be added later if volume/retry needs justify it. | Use `notification_outbox`; add worker service only when processing must be async. |
| Local/S3-compatible storage vs Supabase Storage | Requires adapter and metadata model, but avoids Supabase keys and URL assumptions. | Store upload metadata in PostgreSQL; local Docker volume for dev, S3-compatible adapter for production. |
| Forced chained PRs | More coordination, smaller review surface. | Feature Branch Chain / stacked slices under 400 changed lines. |

## Data Flow

```text
Storefront Server Components ──→ domain queries ──→ PostgreSQL
Cart Client Component ──→ checkout server action ──→ quote/order transaction
Admin UI ──→ protected server action/route ──→ requirePermission() ──→ repository
Upload form ──→ storage adapter ──→ uploads volume/S3 + document/image metadata
Quote/order created ──→ notification_outbox ──→ email/WhatsApp handoff processor
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `package.json`, `pnpm-lock.yaml`, `.nvmrc` | Create | Latest stable functional Node/Next/React/Tailwind/TypeScript metadata; align with CI and Docker. |
| `next.config.ts` | Create | `output: "standalone"`, safe image domains/storage URLs, no Supabase host dependency. |
| `src/app/**` | Create | Public routes `/`, `/productos`, `/productos/[category]`, `/producto/[id]`, `/contacto`, `/cuenta`, `/privacidad`, `/terminos`, and admin routes. |
| `src/domains/{storefront,admin,catalog,quote-order,inventory,leads,users,settings,documents,design}/**` | Create | Screaming domain modules with schemas, repositories, services, and actions. |
| `src/server/{auth,db,storage,notifications}/**` | Create | Server-only auth/RBAC, PostgreSQL client, storage adapter, outbox/handoff boundary. |
| `db/schema.sql`, `db/migrations/**`, `db/seeds/**`, `db/import/**` | Create | Canonical PostgreSQL schema, migrations, test seed data, legacy import validation. |
| `public/assets/brand/**`, `src/app/globals.css` | Create | Approved logo/theme token migration from legacy CSS/assets; no wholesale CSS copy. |
| `Dockerfile`, `compose.yaml`, `.dockerignore` | Create | App + PostgreSQL services, upload volume, health checks, migration-safe startup. |
| `.github/workflows/ci.yml` | Create | Lint, typecheck, unit/integration/e2e smoke, build, Docker build, migration validation. |
| `tests/**`, `playwright.config.ts`, `vitest.config.ts` | Create | TDD harness, PostgreSQL integration, Playwright page objects and smoke flows. |

## Interfaces / Contracts

Use Zod 4 schemas at server boundaries and strict TypeScript const-object enums. Core contracts: `requireSession()`, `requirePermission(permission)`, `createQuoteRequest(input)`, `recordInventoryMovement(input)`, `storeUpload(file, purpose)`, and repositories imported only from server modules. Domain writes must be transactional and never executed directly from client components.

Canonical tables: `users`, `sessions`, `roles`, `permissions`, `user_roles`, `categories`, `products`, `product_assets`, `inventory_movements`, `leads`, `quote_requests`, `quote_request_items`, `settings`, `banners`, `documents`, `uploads`, `notification_outbox`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Zod schemas, status transitions, RBAC helpers, cart totals. | Vitest before each feature slice. |
| Integration | PostgreSQL repositories, migrations, auth/session, quote/order transactions, upload metadata. | Test database via Compose; migration reset + seed per suite. |
| E2E | Storefront browse, quote request, sign-in, denied admin access, permitted admin update. | Playwright smoke suites with page objects and role/label selectors. |

## Migration / Rollout

No in-place migration. Build chained PRs: 1) runtime/Docker/CI/test harness, 2) database/auth/storage foundations, 3) visual tokens/assets shell, 4) storefront/catalog/cart, 5) quote/leads handoff, 6) admin slices by domain, 7) import validator and cutover checklist. Legacy `.env` and exposed credentials must be treated as compromised and rotated.

## Open Questions

- [ ] Confirm production storage target: local volume, S3-compatible provider, or another approved object store.
- [ ] Confirm whether email/WhatsApp handoff must be synchronous at first release or requires a worker immediately.
