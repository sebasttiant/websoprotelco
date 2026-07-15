# Tasks: Admin Legacy Parity Stability

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~3,200 across 13 slices |
| 400-line budget risk | Medium (per-slice changed-line gate enforced; densest slice ~380) |
| Chained PRs recommended | Yes |
| Suggested split | PR #1 (slice 0) → PR #2 (1-2) → PR #3 (3) → PR #4 (4) → PR #5 (5) → PR #6 (6) → PR #7 (7) → PR #8 (8) → PR #9 (9) → PR #10 (10) → PR #11 (11) → PR #12 (12) |
| Delivery strategy | forced-chained |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Base | ~Lines |
|------|------|-----------|------|--------|
| 0 (Slice 0) | Preserve/split green P1-P5 checkpoint; tracker branch; reviewable commits | PR #1 | tracker | 140 |
| 1 (Slices 1-2) | Transaction helper + RBAC perms | PR #2 | PR #1 | 300 |
| 2 (Slice 3) | Orders migration 0011 | PR #3 | PR #2 | 150 |
| 3 (Slice 4) | Order schemas/status machine | PR #4 | PR #3 | 250 |
| 4 (Slice 5) | Order repos/service/actions | PR #5 | PR #4 | 380 |
| 5 (Slice 6) | Orders list UI | PR #6 | PR #5 | 280 |
| 6 (Slice 7) | Orders create flow UI | PR #7 | PR #6 | 320 |
| 7 (Slice 8) | Orders detail/status UI | PR #8 | PR #7 | 260 |
| 8 (Slice 9) | Inventory reconciliation migration | PR #9 | PR #8 | 200 |
| 9 (Slice 10) | Ledger canonical reads | PR #10 | PR #9 | 200 |
| 10 (Slice 11) | Conditional quote/order updates | PR #11 | PR #10 | 220 |
| 11 (Slice 12) | Dashboard metric + admin E2E (incl. mobile 375px) | PR #12 | PR #11 | 380 |

### Per-Slice Gate (MANDATORY before next slice)

Each slice MUST pass this gate before starting the next slice:
- [ ] G.a Run `git diff --stat` against parent branch; assert changed lines (additions + deletions) ≤400. **If exceeded: stop, split further, or request maintainer `size:exception`.**
- [ ] G.b Fresh read-only review of the slice diff (focused on its owner file set).
- [ ] G.c Focused verification: run tests for the slice's RED tasks; assert GREEN.
- [ ] G.d Full verification: lint, typecheck, full Vitest suite, prod build, diff-check. **P1-P5 regressions must stay green.**
- [ ] G.e Confirm rollback boundary: the slice's file set can be reverted independently without reverting unrelated work; migrations are forward-only after apply.
- [ ] G.f Record diffstat + gate result in PR body before opening next child PR.

## Phase 0: Checkpoint Preservation (Slice 0)

- [x] 0.1 CHECKPOINT GATE (behavioral, not file-set): run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`; record green status + targeted P1-P5 regressions (catalog, quotes, leads, inventory, documents) + diffstat of current diff (37 tracked files, 663 insertions/381 deletions). **Owner: chore**. **Dep: none**. **Trace: Slice rollback bounded, Backout before orders (admin-stability/orders-spec)**. **Rollback: no file changes; pure verification**
- [x] 0.2 BRANCH PREFLIGHT: verify clean base relation — confirm main HEAD is the expected green base; create tracker branch `feature/admin-legacy-parity-stability` from main WITHOUT disturbing the working tree (use `git checkout -b` while keeping uncommitted changes in place; NEVER stash-and-lose untracked files as primary flow). Confirm all untracked files present after branch creation. **Owner: chore**. **Dep: 0.1**. **Rollback: `git checkout main` preserves working tree; branch discardable**
- [x] 0.3 SPLIT CHECKPOINT: split current P1-P5 uncommitted diff into reviewable work-unit commits/slices on the tracker branch before any Orders work — group by deliverable behavior (catalog/UI components/boundaries/upload), keep tests with code. **Owner: chore**. **Dep: 0.2**. **Trace: Slice reviewable (admin-e2e-spec)**. **Rollback: reset commits to pre-split; working tree recoverable from reflog**
- [ ] 0.4 NAMED-STASH FALLBACK (only if 0.2/0.3 cannot proceed): `git stash push -u -m "p1-p5-checkpoint-restore"`; record `git stash list` + stash hash; on restore verify hash matches and `git stash pop`; re-verify untracked files present (never lose untracked files). **Owner: chore**. **Dep: 0.3**. **Rollback: pop verifies hash; guaranteed restoration**
- [ ] 0.5 PREP: open draft/no-merge tracker PR describing branch + split (PREPARATION ONLY — PR body only; no execution beyond branch). **Test: checkpoint gate passes on main and tracker**

## Phase 1: Foundation Infrastructure (Slices 1-2)

- [ ] 1.1 RED: `tests/server/db/pool.test.ts` — `withTransaction<T>` rolls back on throw; commits on success; no global query calls inside active txn. **Owner: db**. **Dep: 0**. **Trace: Failed action no partial stock (orders/inventory-spec)**
- [ ] 1.2 GREEN: `src/server/db/pool.ts` add `withTransaction<T>` + `DatabaseExecutor`; executor passed to repos. **Files: pool.ts only**. **Rollback: revert pool.ts**. **Gate: per-slice gate before next**
- [ ] 2.1 RED: `tests/server/auth/rbac.test.ts` — assert admin AND staff ARE ALLOWED `order:read`/`order:write`; assert unauthenticated user denied; assert role lacking `order:read`/`order:write` denied orders; assert staff denied ONLY from unrelated privileged modules (e.g. settings/users); assert staff still lacks `catalog:write` unchanged. **Owner: auth**. **Dep: 1**. **Trace: Authorized admin creates an order, Unauthorized access is denied (orders-spec)**
- [ ] 2.2 GREEN: `src/server/auth/rbac.ts` add `order:read`/`order:write`; grant BOTH admin and staff. **Files: rbac.ts only**. **Rollback: revert rbac.ts**. **Gate: per-slice gate before next**

## Phase 2: Orders Server (Slices 3-5)

- [ ] 3.1 RED: `tests/server/db/migrations/0011.test.ts` — schema CHECK status/COP, `UNIQUE(order_id,product_id)`, totals, snapshots. **Owner: db**. **Dep: 2**. **Trace: Migration Compatibility and Backout (orders-spec)**
- [ ] 3.2 GREEN: `db/migrations/0011_orders.sql` only. **Files: migration only**. **Rollback: forward-only compensating migration after apply; local disposable DB drop allowed pre-apply only**. **Gate**
- [ ] 4.1 RED: `tests/server/domains/orders/schemas.test.ts` — ORDER_STATUS_VALUES source-of-truth, transitions matrix, money COP, line-total CHECK. **Owner: orders-domain**. **Dep: 3**. **Trace: Allowed transition succeeds (orders-spec)**
- [ ] 4.2 GREEN: `src/domains/orders/schemas.ts` + `orderStatus.ts` consts/zod. **Files: orders/schemas.ts, orderStatus.ts**. **Rollback: revert files**. **Gate**
- [ ] 5.1 RED: `tests/server/domains/orders/service.test.ts` — duplicate-collapse aggregate by productId BEFORE price reads; oversell reject; server COP snapshot (always re-reads current price, client sends no authoritative price/currency/total); stale-price block when client observed price revision/fingerprint mismatches server; reconfirm at price B only; conditional `pending->processing` stock movement; transaction rollback leaves no partial stock; quote isolation. **Owner: orders-domain**. **Dep: 4**. **Trace: Orders authorized create, Server COP snapshots, Invalid item rejected, Stale price blocks, Reconfirm succeeds, Concurrent transition loses, Duplicate products, Order stock ledger-backed, Failed action no partial stock, Quote state isolated (orders/inventory/admin-stability-spec)**
- [ ] 5.2 GREEN: `src/domains/orders/repository.ts` + `service.ts` + `actions.ts` + `index.ts` using `DatabaseExecutor`; client may submit non-authoritative observed server price revision/fingerprint solely for stale detection; server always re-reads/snapshots current price. **Files: domains/orders/** only (no UI, no quote edits)**. **Rollback: revert orders domain**. **Gate**

## Phase 3: Orders Admin UI (Slices 6-8)

- [ ] 6.1 RED: `tests/app/admin/orders/page.test.tsx` — list renders server rows; admin+staff allowed (200); user lacking order perm denied (404, no data leak); no quote mixing. **Owner: orders-ui**. **Dep: 5**. **Trace: Authorized admin creates, Unauthorized access denied (orders-spec)**
- [ ] 6.2 GREEN: `src/app/admin/orders/page.tsx` list + loader; sidebar nav link. **Files: app/admin/orders/page.tsx, components/admin/sidebar.tsx nav entry**. **Rollback: revert; nav link removal only**. **Gate**
- [ ] 7.1 RED: `tests/app/admin/orders/create.test.tsx` — active-product select; server current price display; client sends NO authoritative price/currency/total (only observed revision/fingerprint); stale-price conflict UI (conflict shown, block creation); reconfirm at server price B path; keyboard focus order + accessible names. **Owner: orders-ui**. **Dep: 6**. **Trace: Create order from active product, Stale price requires reconfirmation, Keyboard and screen-reader flow (orders/admin-e2e/admin-stability-spec)**
- [ ] 7.2 GREEN: create modal + product selection server action; client only selects existing products + quantity + optional observed revision/fingerprint. **Files: app/admin/orders/create/**. **Rollback: revert create flow**. **Gate**
- [ ] 8.1 RED: `tests/app/admin/orders/[id]/page.test.tsx` — status controls allowed transitions; stale admin update rejected; destructive status action (cancel) requires ConfirmDialog confirmation; cancel/dismiss preserves data; a11y names + status messages. **Owner: orders-ui**. **Dep: 7**. **Trace: Allowed transition succeeds, Stale admin update rejected, Confirmed delete proceeds, Cancel preserves data (orders/admin-stability-spec)**
- [ ] 8.2 GREEN: detail page + status controls (conditional update client); ConfirmDialog for destructive cancel action. **Files: app/admin/orders/[id]/page.tsx**. **Rollback: revert detail**. **Gate**

## Phase 4: Inventory + Resilience (Slices 9-11)

- [ ] 9.1 RED: `tests/server/db/migrations/0012.test.ts` — idempotent opening-balance rows for +/- delta, ledger preserved, repeat-run creates no extra rows. **Owner: db**. **Dep: 8**. **Trace: Scalar drift reconciled, Reconciliation idempotent, Inventory backout preserves ledger (inventory-spec)**
- [ ] 9.2 GREEN: `db/migrations/0012_inventory_reconciliation.sql` only. **Files: migration only**. **Rollback: restore UI/write behavior; ledger rows remain; forward-only**. **Gate**
- [ ] 10.1 RED: `tests/server/domains/inventory/service.test.ts` + `tests/app/admin/inventory/page.test.tsx` — display equals ledger SUM; scalar not contradictory; catalog edit reads stock from ledger. **Owner: inventory-domain**. **Dep: 9**. **Trace: Stock display matches ledger, Order stock impact ledger-backed (inventory-spec)**
- [ ] 10.2 GREEN: `src/domains/inventory/**` ledger reads; route catalog edit reads stock from ledger. **Files: domains/inventory/**, catalog read path**. **Rollback: revert reads**. **Gate**
- [ ] 11.1 RED: `tests/server/domains/quote-order/service.test.ts` + `tests/server/domains/orders/service.test.ts` — conditional `UPDATE WHERE status=$expected` for quote AND order; quote transitions unchanged (518 tests green); stale update rejected + re-loadable. **Owner: quote-domain**. **Dep: 10**. **Trace: Quote state remains isolated, Stale admin update rejected (admin-stability-spec)**
- [ ] 11.2 GREEN: `src/domains/quote-order/repository.ts` conditional update; same pattern for orders; remove `stockQuantity` from `productAdminInputSchema`/insert/update so ledger is sole write path; add `ConfirmDialog` to design-banner delete and document delete. **Files: quote-order/repository.ts, catalog/schemas.ts, catalog/repository.ts, design/documents delete wiring**. **Rollback: revert; 518 quote tests must stay green**. **Trace: Confirmed delete proceeds, Cancel preserves data (admin-stability-spec)**. **Gate**

## Phase 5: Dashboard + E2E (Slice 12)

- [ ] 12.1 RED: `tests/app/admin/dashboard.test.tsx` — orders metric visible; quotes not counted as orders; per-metric permission ownership. **Owner: dashboard**. **Dep: 11**. **Trace: Dashboard shows order metric (admin-stability-spec)**
- [ ] 12.2 GREEN: `src/app/admin/page.tsx` orders metric + per-metric permission review. **Files: app/admin/page.tsx**. **Rollback: revert metric**
- [ ] 12.3 RED: `tests/app/admin/mobile-spanish-parity.test.tsx` — 375px mobile viewport, Spanish UI context; dashboard, orders, products, inventory labels/layout/primary actions remain usable + legacy-aligned. **Owner: orders-ui**. **Dep: 12.2**. **Trace: Mobile Spanish parity preserved (admin-stability-spec)**
- [ ] 12.4 GREEN: responsive + Spanish label fixes for mobile 375px parity. **Files: affected admin pages**. **Rollback: revert**. **Trace: same**
- [ ] 12.5 RED: `tests/admin/login.spec.ts`, `nav.spec.ts`, `rbac.spec.ts` (Playwright smoke, unique-prefix fixtures, local/CI base URLs only, no reset/seed/truncate) — login, nav, RBAC denial for no-perm user. **Owner: e2e**. **Dep: 12.4**. **Trace: Authorized admin smoke path, Unauthorized user is blocked, Non-destructive fixtures (admin-e2e-spec)**
- [ ] 12.6 RED: `tests/admin/orders.spec.ts` — create from active product (server-snapshotted values, no auto tax); stale-price conflict + reconfirm; conditional status update feedback; keyboard + screen-reader on create/confirm flow. **Owner: e2e**. **Dep: 12.5**. **Trace: Create order from active product, Stale price requires reconfirmation, Keyboard and screen-reader flow (admin-e2e/admin-stability-spec)**
- [ ] 12.7 GREEN: Playwright page objects + helpers; advisory gating (E2E advisory first, no CI gating until stable). **Files: tests/admin/** only**. **Rollback: revert E2E suite; no app code in this task**. **Gate (final)**

## Chain Preparation (No Execution)

- [ ] C.1 PREP: define tracker branch `feature/admin-legacy-parity-stability` (draft/no-merge PR) as base for PR #1. **No branch creation here — preparation spec only**
- [ ] C.2 PREP: document child PR base boundary — PR #N base = PR #(N-1) branch; retarget/rebase on polluted diff before review. **No execution**
- [ ] C.3 PREP: issue/tracker stub — prepare GitHub issue + tracker PR body templates (dependency diagrams, 📍 markers, per-slice diffstats). **No issue/PR created**
