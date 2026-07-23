# Proposal: Admin Legacy Parity Stability

## Intent

Add legacy-parity Pedidos stability without breaking the green P1–P5 checkpoint or the existing `quote_requests` quote state machine. Legacy remains authoritative for observable behavior, visual, and mobile parity; Supabase internals and unsafe client-price writes must not be copied.

## Scope

### In Scope
- Prerequisite: split/review the current uncommitted P1–P5 checkpoint before orders work.
- Separate `orders`/`order_items` tables plus `src/domains/orders/**`; Orders and Quotes stay separate UI modules, routes, permissions, states, reporting, and tests.
- COP-only orders from active products; server aggregates duplicate product lines by `productId` before price/stock reads; aggregate quantity is validated against ledger stock; server persists at most one `order_item` per product with `UNIQUE(order_id, product_id)`; stock movement uses the aggregate quantity; server snapshots product name/SKU/price/currency; stale price requires explicit reconfirmation; `subtotal=total` with no VAT/tax calculation.
- `order:read`/`order:write` for admin and staff; canonical inventory reconciliation through `stock_movements`; dashboard metric, CRUD/status resilience, and admin E2E smoke.

### Out of Scope
- Unifying orders with `quote_requests`, changing quote states, or merging quote/order UI.
- Mixed currencies, manual lines, arbitrary discounts, client-controlled prices, fiscal/VAT claims, DB reset/seed/deploy.

## Capabilities

### New Capabilities
- `orders`: order persistence, snapshots, status workflow, RBAC, admin UI, and tests.
- `inventory-consistency`: `products.stock_quantity` reconciliation with the ledger source of truth.
- `admin-stability`: confirm destructive actions and use conditional status updates.
- `admin-e2e`: Playwright smoke coverage for login, nav, RBAC, orders, and inventory display.

### Modified Capabilities
- None; `openspec/specs/` has no active specs. Quote behavior is preserved.

## Approach

Use forced chained delivery, each slice ≤400 changed lines; no PR creation is claimed here.

1. Checkpoint split/review: preserve current green P1–P5 work.
2. Orders server: migrations, domain, server pricing, stale-price outcome, RBAC, Vitest.
3. Orders admin UI: list/detail/create/status/nav/dashboard tests.
4. Inventory + resilience: ledger reconciliation, remove scalar writes, delete confirms, conditional quote/order updates.
5. Dashboard + E2E: metric polish and Playwright admin smoke.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `db/migrations/0011_orders.sql` | New | Orders/items schema and snapshots. |
| `db/migrations/0012_inventory_reconciliation.sql` | New | Safe stock reconciliation. |
| `src/domains/orders/**` | New | Order business rules/actions. |
| `src/app/admin/orders/**`, nav, dashboard | New/Modified | Admin parity UI. |
| `src/domains/catalog/**`, `quote-order/**` | Modified | Ledger stock and conditional updates. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Stale-price UX ambiguity | Med | Block creation until explicit reconfirmation. |
| Inventory divergence | High | Backfill from ledger; stop scalar writes. |
| Quote regression | Med | Preserve states; add conditional-update tests. |
| Review budget overflow | High | Forced chained slices ≤400 lines. |

## Rollback Plan

Rollback per slice. Before production migration, take a backup/export. Deployment rollback is allowed only while the schema remains backward-compatible; schema reversal requires a compensating FORWARD migration. If orders exist, preserve/export them before reversal. Never edit/remove an applied migration and never reset production. Dropping migrations is allowed only in isolated disposable local/test DBs before application. Inventory rollback must preserve ledger rows and restore only UI/write-path behavior.

## Dependencies

- OpenSpec/Engram exploration artifacts and approved business/architecture decisions.
- Current green P1–P5 checkpoint must be split and reviewed first.

## Success Criteria

- [ ] P1–P5 checkpoint remains green before orders work starts.
- [ ] Orders and Quotes remain separate with COP-only, server-priced orders.
- [ ] Repeated product IDs are normalized to one order item per product before persistence, ledger stock validation, and sale movement creation; DB uniqueness protects the invariant.
- [ ] Inventory display/write paths agree with `stock_movements` ledger.
- [ ] Each implementation slice can be reviewed under 400 changed lines.
