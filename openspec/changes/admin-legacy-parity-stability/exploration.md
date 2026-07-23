## Exploration: admin-legacy-parity-stability

### Current State

The rebuilt SOPROTELCO admin app is at a green P1–P5 checkpoint: lint, typecheck,
518/518 Vitest tests, and prod build all pass on an uncommitted diff (37 tracked files
changed, 663 insertions / 381 deletions). The `complete-missing-domains` SDD change
(settings, leads, inventory, documents, design) is fully implemented (migrations
0001–0010). Server-first domain boundaries, first-party auth/RBAC, PostgreSQL, and a
local storage adapter are in place. Supabase internals were never copied.

The legacy baseline at `/home/sebastian/Documentos/DEV/SOPROTELCO/web/web_completo/web`
remains larger than the rebuild. A user-established parity matrix (Engram
`admin/parity-matrix`) inventories the gaps. The largest confirmed missing capability is
**Pedidos (orders)**, followed by canonical-inventory drift, CRUD resilience gaps,
dashboard polish, and the absence of admin E2E.

- **Quote model today** (`src/domains/quote-order/`): `quote_requests` with a 6-state
  machine (`received → in_review → quoted → won/lost/cancelled`), enforced transitions
  (`QUOTE_TRANSITIONS` in `service.ts`). Items are `quote_request_items(product_id,
  description, quantity>0)` — **no price snapshot, no currency, no totals, no order
  type**, no manual creation, no items UI, no detail view. Admin can only list + change
  status.
- **Orders today**: none. Legacy `pedidos/page.tsx` reads from a single `orders` table
  (discriminator `type='order'/'quote'`) with `order_items(product_id, product_name,
  quantity, price)` and totals; manual create-with-cart; status
  `pending/processing/completed/cancelled`; COP formatting. Legacy sends the client
  cart `price` straight to the DB — an unsafe pattern that MUST NOT be copied.
- **Inventory canonical state**: `stock_movements` SUM is the decided canonical stock
  source (Engram `architecture/inventory-stock-source`). `findCurrentStock` and
  `findLowStockProducts` both aggregate the ledger. **However** `products.stock_quantity`
  still exists as a writable column: `insertProduct`/`updateProductById`
  (`src/domains/catalog/repository.ts`) persist `input.stockQuantity` from the admin
  product form, and the products admin list reads `p.stock_quantity`. So catalog admin
  and inventory admin show two stock numbers, and staff can hand-edit the cache,
  breaking the ledger contract.
- **RBAC** (`src/server/auth/rbac.ts`): two roles, `admin` (all perms) and `staff`
  (catalog:read, quote + leads + inventory + documents read/write). No `order:read` /
  `order:write` yet; legacy had admin/vendedor/viewer. Staff lack catalog:write here
  (deliberate).
- **Dashboard** (`src/app/admin/page.tsx`): `force-dynamic`, counts products, open
  quotes, leads, low-stock. No orders metric.
- **Tests / E2E**: Vitest unit/component/server-layer coverage is strong. Playwright is
  configured (`playwright.config.ts`, `testMatch: **/*.spec.ts`, webServer on `pnpm dev`)
  but **no `*.spec.ts` admin E2E exists**.

User decisions in force (Engram): Orders and Quotes stay separate user-facing modules;
a shared internal model is allowed only if type-isolated; COP-only orders; no automatic
VAT/tax this phase; only existing products; server controls prices; stale prices require
explicit reconfirmation; admin and staff get order read/write; preserve the P1–P5
checkpoint; keep the working diff split into ≤400-line review units.

### Affected Areas

- `db/migrations/0011_orders.sql` (new) — orders/items table, status CHECK, price+name+currency snapshots, totals; must NOT touch `quote_requests`.
- `db/migrations/0012_inventory_reconciliation.sql` (new) — backfill `products.stock_quantity` from ledger, make derived/deprecated (column left for display or dropped later).
- `src/domains/orders/` (new) or `src/domains/quote-order/` (extended) — order repository/service/actions/schemas/index with a type-isolated status machine, server-controlled pricing, and conditional (optimistic-lock) status updates.
- `src/server/auth/rbac.ts` — add `order:read` / `order:write`; grant both to `admin` and `staff`.
- `src/domains/catalog/repository.ts` + `schemas.ts` — remove `stockQuantity` from `productAdminInputSchema` and `insertProduct`/`updateProductById`; stop persisting the scalar, so the ledger is the only write path.
- `src/app/admin/orders/` (new) — list, detail/create modal, status controls; `src/app/admin/layout.tsx` + `src/components/admin/sidebar.tsx` nav link.
- `src/app/admin/page.tsx` — add orders metric(s); re-confirm per-metric permission ownership.
- `src/components/admin/*` — reuse `ConfirmDialog` (already used by products) for design-banner delete and document delete (currently unconfirmed).
- `src/domains/quote-order/repository.ts` — change `updateQuoteStatusById` from read-then-write to conditional `UPDATE ... WHERE status = $expected` (lost-update resilience), and use the same pattern for new orders.
- `tests/server/domains/orders/` + `tests/app/admin/orders/` — domain + page tests (Vitest).
- `tests/admin/*.spec.ts` (new) — Playwright admin E2E smoke (login, nav, RBAC 404, orders flow).

### Approaches

1. **Separate `orders` table + new `orders` domain (lowest risk to the green baseline)**
   — Add `orders`/`order_items` as a new table alongside `quote_requests`; build a
   dedicated `src/domains/orders/` domain with its own status machine, price snapshots,
   totals, and server-controlled pricing. Quotes stay untouched.
   - Pros: zero risk to the verified 518-test quote status machine; physical type
     isolation satisfies "separate user-facing modules"; explicit price/currency
     snapshots don't pollute quote item semantics; smallest blast radius; can ship behind
     chained PRs that each pass the 400-line budget.
   - Cons: a second terminal/finance table exists (some schema duplication of customer
     fields); no single shared model — slightly more code than a unified table.
   - Effort: Medium

2. **Type-isolated extension of `quote_requests` (shared internal model)**
   — Add a `type` discriminator (`order`/`quote`) and price-snapshot/total columns to
     the existing `quote_requests` schema; keep separate TypeScript domains
     (`orders/` vs `quote-order/`) reading the same table through type-isolated
     repositories.
   - Pros: matches "shared internal model allowed if type-isolated"; one table backing
     both user-facing modules; fewer customer-field duplications.
   - Cons: requires migrating the live `quote_requests` CHECK + rows under a green
     checkpoint (high regression risk); price-snapshot/total columns must be nullable
     for quote rows, complicating validation; mixing two terminal-state machines in one
     table invites cross-type query bugs; harder to split into ≤400-line PRs without
     touching quote tests.
   - Effort: High

3. **Hybrid: new `orders` table now, future unification later**
   — Ship Approach 1 now to protect the checkpoint; document an optional later migration
     that unifies orders + quotes into one type-discriminated table once quotes are
     stable and tested at the integration layer.
   - Pros: immediate low-risk delivery; preserves the option the user explicitly left
     open ("shared internal model allowed"); defers the risky schema merge to a dedicated
     future change with its own SDD cycle.
   - Cons: technical debt of two tables acknowledged and deferred (must be tracked).
   - Effort: Medium

### Recommendation

Use **Approach 3 — ship a separate `orders` table + domain now, defer unification**.
This protects the green P1–P5 checkpoint (the user's stated priority: "Before Orders,
preserve current P1–P5 work"), delivers the missing Pedidos capability with
server-controlled pricing and stale-price reconfirmation (requirements legacy did not
have and the client-price pattern must not be copied), and keeps the risky
`quote_requests` schema merge as an explicit future decision rather than baking it into
the stability work. Physical table separation gives the cleanest ≤400-line PR split.

Concrete bounded scope (each PR ≤400 changed lines, chained, feature-branch-chain per
`openspec/config.yaml` `chained_pr_strategy: force-chained`):

- **PR-1 — Orders server domain**: migration `0011_orders.sql` (orders + order_items
  with price_cents/currency/name snapshots, totals, status CHECK
  `pending/processing/fulfilled/cancelled`, totals generated server-side); `src/domains/orders/`
  repository/service/schemas/actions with server price control + stale-price
  reconfirmation outcome + conditional `UPDATE WHERE status=$current`; RBAC
  `order:read`/`order:write` for admin+staff; Vitest domain+action tests. Server-only,
  no UI.
- **PR-2 — Orders admin UI**: `/admin/orders` list/detail/create-with-product-selection
  (server controls line price; client only selects existing products and quantity);
  status controls; sidebar + layout nav; dashboard orders metric; component + page
  tests. Reuses `DataTable`, `StatusBadge`, `ConfirmDialog`, `SearchInput`.
- **PR-3 — Canonical inventory + CRUD resilience**: migration
  `0012_inventory_reconciliation.sql` (backfill cache from ledger); remove
  `stockQuantity` from `productAdminInputSchema`/insert/update so the ledger is the only
  write path; route catalog product edit to read stock from ledger; add `ConfirmDialog`
  to design-banner delete and document delete; convert `updateQuoteStatusById` to
  conditional-UPDATE; apply the same conditional-update pattern to order status. Tests
  for each.
- **PR-4 — Dashboard polish + admin E2E**: dashboard metric/permission review and
  polish; Playwright admin smoke specs (`tests/admin/*.spec.ts`) — login, nav, RBAC 404
  for staff on denied section, orders create/status flow, inventory consistency display.
  This PR is test/E2E heavy and stays within budget.

### Risks

- **Stale-price reconfirmation is novel scope**: legacy had no concept of it; the
  server must fetch live product prices at order-create time, snapshot them, and reject
  or prompt explicit reconfirmation when a client-submitted product price fingerprint is
  stale. Mis-scoping this UX is the highest functional risk.
- **`products.stock_quantity` divergence is a live data bug**: catalog admin already
  writes the scalar while inventory reads the ledger; any backfill/drop migration must
  reconcile the live values once, and removing the column from the admin form is a
  behavior change QA must verify.
- **Concurrent status races**: both quote and order status changes are
  read-then-write today; converting to conditional UPDATE must preserve the existing
  verified quote transition semantics (518 tests) — a subtle regression risk for PR-3.
- **Review-budget violation**: the Orders UI (create modal, product search, line
  management, detail) is UI-dense and can blow past 400 lines if not aggressively split
  between PR-1 (server contracts) and PR-2 (UI).
- **Copy-paste temptation**: legacy `pedidos/page.tsx` uses Supabase client writes and
  client-controlled prices; copying its flow wholesale would reintroduce unsafe client
  writes. Server actions + server-controlled pricing are mandatory.
- **RBAC widening**: granting `order:write` to staff is a new privileged path; E2E must
  prove the 404 boundary holds for staff on denied sections once orders enter the nav.
- **E2E flakiness**: `webServer: pnpm dev` E2E is new; CI gating on it before it is
  stabilized could destabilize the pipeline (keep E2E advisory first).

### Ready for Proposal

Yes — proposal can proceed. The orchestrator should tell the user:
- Confirmation that Approach 3 (separate `orders` table + domain now, unification
  deferred) is the recommended low-risk path that protects the green checkpoint while
  honoring "shared internal model allowed if type-isolated" as a future option.
- Four chained ≤400-line PRs planned (orders-server, orders-ui, inventory-canonical +
  CRUD-resilience, dashboard-polish + admin-E2E); feature-branch-chain strategy.
- Two open UX confirmations for the proposal/spec to nail down: (a) the exact
  stale-price-reconfirmation flow (block-and-resurface vs. soft banner), and
  (b) whether `products.stock_quantity` should be dropped later or retained as a
  read-only derived display column.
