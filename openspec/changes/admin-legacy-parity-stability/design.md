# Design: Admin Legacy Parity Stability

## Technical Approach

Preserve approved decisions: separate Orders from Quotes, COP-only server-priced active products, no VAT, admin+staff `order:*`, ledger-canonical inventory, chained slices ≤400 lines, and forward-only backout. This remediation changes SDD artifacts only.

## Architecture Decisions

| Area | Decision | Rationale |
|------|----------|-----------|
| Duplicate products | Normalize request items by aggregating repeated `productId` quantities before product price reads, ledger stock checks, stale-price checks, and persistence. Persist max one `order_item` per product; DB enforces `UNIQUE(order_id, product_id)`. | Same-product lines must not bypass stock validation or create ambiguous sale movements. |
| Inventory decrement | On `pending -> processing`, validate ledger stock against the aggregate item quantity and insert one sale movement per persisted item using that aggregate quantity. | Movement totals stay identical to the order invariant and retry-safe source keys prevent duplicate decrements. |
| Reconciliation | `0012_inventory_reconciliation.sql` inserts idempotent opening-balance ledger rows for `delta = products.stock_quantity - SUM(stock_movements.quantity)`, then derives scalar stock from ledger. | Existing scalar stock may be meaningful; never zero or discard history blindly. |
| Status/money | Status flow is `pending -> processing -> fulfilled`, `pending -> cancelled`; processing/fulfilled/cancelled are terminal except processing fulfillment. Server re-reads current product snapshots inside transaction. | Avoids hidden restore semantics and client-controlled money. |
| Transactions | Add `withTransaction<T>` plus `DatabaseExecutor`; repositories receive the executor. | No global query calls inside active transactions. |

## Data / DB Contracts

`0011_orders.sql`: `orders` with status CHECK, COP currency CHECK, `subtotal_cents=total_cents`, timestamps, creator FK; `order_items` with product FK, snapshots, positive quantity, line-total CHECK, `UNIQUE(order_id, product_id)`, and indexes for status/order/product.

Create flow: parse items → aggregate by `productId` → reject zero/negative aggregates → read active COP products and current price revisions → validate aggregate quantity against ledger stock → insert order plus one item per product. Required proofs: duplicate input collapses; aggregate oversell rejects atomically; duplicate row insertion violates DB uniqueness.

Status flow: conditional `UPDATE orders ... WHERE id=$1 AND status=$2 RETURNING id`; on `pending -> processing`, lock/read aggregate persisted items, validate ledger, insert `sale` movements with `quantity=-aggregateQuantity`, `source_type='order'`, unique source, then commit. Insufficient stock or stale status rolls back all writes. Quote status updates keep the same conditional pattern and never reuse order states.

## Interfaces / Contracts

```ts
export const ORDER_STATUS_VALUES = ['pending', 'processing', 'fulfilled', 'cancelled'] as const;
export const ORDER_STATUS = Object.fromEntries(ORDER_STATUS_VALUES.map((v) => [v.toUpperCase(), v])) as Record<Uppercase<(typeof ORDER_STATUS_VALUES)[number]>, (typeof ORDER_STATUS_VALUES)[number]>;
export const orderStatusSchema = z.enum(ORDER_STATUS_VALUES);
export type OrderStatus = z.infer<typeof orderStatusSchema>;
```

## File Changes

| File | Action |
|------|--------|
| `db/migrations/0011_orders.sql`, `db/migrations/0012_inventory_reconciliation.sql` | Create |
| `src/server/db/pool.ts`, `src/server/auth/rbac.ts` | Modify |
| `src/domains/orders/**`, `src/app/admin/orders/**` | Create |
| `src/domains/inventory/**`, `src/domains/catalog/**`, `src/domains/quote-order/**` | Modify |
| `tests/server/**`, `tests/app/admin/**`, `tests/admin/orders.spec.ts` | Create/modify |

## Testing / Full Traceability

| Scenario | Planned proof | Slice |
|----------|---------------|-------|
| Orders authorized create | action + create UI tests | 5,7 |
| Orders unauthorized denied | RBAC + route guard + E2E unauthorized | 2,6,12 |
| Server COP snapshots | service money snapshot test | 5 |
| Invalid item rejected | schema/service atomic rejection | 4,5 |
| Stale price blocks | service + UI conflict test | 5,7,12 |
| Reconfirm succeeds | service + UI confirm path | 5,7,12 |
| Allowed transition | status matrix + detail UI | 4,8 |
| Concurrent transition loses | conditional update race test | 5,11 |
| Backout before orders | migration local-only checklist assertion | 3 |
| Backout after orders | export + forward migration checklist | 3 |
| Duplicate products | duplicate-collapse, oversell, uniqueness tests | 3,5 |
| Stock display ledger | inventory service/page tests | 10 |
| Scalar drift reconciled | positive/negative delta migration tests | 9 |
| Order stock ledger-backed | order movement + inventory read tests | 5,10 |
| Failed action no partial stock | transaction rollback test | 1,5 |
| Reconciliation idempotent | repeated-run migration test | 9 |
| Inventory backout preserves ledger | fixture + rollback checklist | 9 |
| Confirmed delete proceeds | confirm-dialog + action test | 0/11 |
| Cancel preserves data | cancel/dismiss no-mutation test | 0/11 |
| Quote state isolated | quote service + orders isolation test | 5,11 |
| Stale admin update rejected | quote/order conditional tests | 8,11 |
| Dashboard order metric | dashboard component test | 12 |
| Mobile Spanish parity | Playwright mobile Spanish smoke | 12 |
| Keyboard/screen reader | focus/a11y + keyboard E2E | 7,8,12 |
| Slice rollback bounded | chained task/PR checklist | all |
| Authorized admin smoke | Playwright admin smoke | 12 |
| E2E unauthorized blocked | Playwright unauthorized route test | 12 |
| E2E create order | Playwright active-product create | 12 |
| E2E stale reconfirm | Playwright stale conflict/reconfirm | 12 |
| E2E reviewable slice | chained delivery checklist | all |
| E2E non-destructive fixtures | unique-prefix fixture helper; no reset/seed/truncate | 12 |

E2E fixtures run only on local/CI base URLs, create unique prefixed records through supported helpers/flows, track IDs, and clean only those records when supported.

## Migration / Rollout

Slices remain: 0 checkpoint, 1 transaction helper, 2 RBAC, 3 orders migration, 4 schemas/status, 5 repositories/actions, 6 list UI, 7 create flow, 8 detail/status UI, 9 reconciliation, 10 ledger reads, 11 conditional updates, 12 dashboard/E2E. Rollback is per slice; applied schema reversal uses compensating forward migrations only.

## Open Questions

- None.
