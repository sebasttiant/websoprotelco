## Exploration: responsive-web-admin

### Current State

The application is a Next.js App Router storefront plus server-rendered admin under `/admin`. The public header has a mobile menu at `md`, but the admin navigation remains a horizontally scrolling desktop rail. `DataTable` provides horizontal overflow only; most admin pages render wide tables with no mobile information architecture. Forms mostly use `flex-wrap`, `min-w-*`, and desktop-oriented controls. The existing code has strong server actions/RBAC and reusable primitives (`Container`, `DataTable`, `ConfirmDialog`, upload fields), but responsive behavior is inconsistent and not yet treated as an operational requirement.

The screenshot set is primary evidence of a 360-ish phone viewport. It shows clipped admin navigation, clipped table columns and empty-state text, and a storefront/header that is usable but vertically expensive. The image-upload and sharp-runtime Docker work is an explicit prerequisite and is out of scope here; responsive implementation must not touch it until that work is complete.

### Screenshot Evidence Matrix

| Screenshot | Visible failure | Code mapping / route | Responsive implication |
|---|---|---|---|
| 1 | Empty cart drawer occupies most viewport; close/action hierarchy is sparse. | Cart drawer components; shared overlay/portal pattern. | Preserve drawer semantics, focus return, safe-area padding, and a reachable catalog CTA at 320–430px. |
| 2 | Storefront hero has very large type and copy; CTA is partly below browser chrome. | `src/components/home/*`, `src/components/layout/header.tsx`, `/`. | Use fluid type/spacing, avoid viewport-height assumptions, keep CTA and menu reachable. |
| 3 | Admin nav is a clipped horizontal rail; active item is not discoverable without sideways scrolling. | `src/components/admin/sidebar.tsx`, `src/app/admin/layout.tsx`, `/admin/settings`. | Replace rail with drawer/sheet or compact menu; expose every permitted route and current location. |
| 4 | Same nav/table clipping on Users; role column and row actions disappear off-screen. | `/admin/users`, `DataTable` or local table. | Use mobile cards or priority columns; never hide role/actions. |
| 5 | Documentation filters are stacked acceptably but lower content is cut by viewport; labels/controls consume width. | `/admin/documents`, `DocumentUploadField`. | Full-width controls, sticky/clear filter action, table strategy, upload progress/error state. |
| 6 | Design form preview/upload control and text fields are cramped; long text overflows. | `/admin/design`, `DesignImageUploadField`. | Keep upload prerequisite separate; responsive field grouping, textarea sizing, keyboard/focus and status announcements. |
| 7 | Categories table is wider than viewport; headers and empty state are clipped with scrollbar. | `/admin/categories`, `DataTable`. | Prefer cards for low-column CRUD or a priority-column table with action access. |
| 8 | Movement history table clips date/product/type/quantity and empty text. | `/admin/inventory/movements`, `DataTable`. | Keep horizontal scroll only where audit columns require it, add scroll cue and stable first-column context; test keyboard scrolling. |
| 9 | Inventory table clips product/available/status; registration form follows below. | `/admin/inventory`, `DataTable`/local table. | Mobile product cards with stock status and ± controls; make movement form selectable by product rather than UUID-only if feasible. |
| 10 | Product filters are usable but table is clipped; create action is oversized. | `/admin/products`, product create/edit pages. | Responsive filter layout; cards retain edit/delete/status/image actions and do not rely on hidden columns. |
| 11 | Quotes filter/table is clipped; only first columns visible. | `/admin/quotes`, `DataTable`. | Compact filter row; cards or priority columns must preserve status mutation and detail actions. |
| 12 | Leads status pills wrap over several lines; table is clipped. | `/admin/leads`, `DataTable`. | Horizontal/scrollable status filter with clear active state; lead cards retain contact, status mutation and detail link. |
| 13 | Orders filter/table is clipped; new-order action is reachable but table actions are not. | `/admin/orders`, `NewOrderModal`, `DataTable`. | Full-screen mobile modal/sheet with adequate inputs; cards retain status update and reference/customer/items/total. |
| 14 | Dashboard cards are single-column and very tall; admin rail is clipped. | `/admin`, `StatCard`, admin layout. | Responsive grid at tablet; compact cards at phone; charts need width-aware containers and accessible summaries. |
| 15 | Login is visually usable but large vertical gaps and browser chrome reduce task density. | `/login`, shared auth form/layout. | Maintain touch targets and focus visibility; avoid fixed-height centering that breaks with keyboard. |
| 16 | Account/login-style public page is centered and readable, but responsive behavior is not proven across widths. | `/cuenta/*`, account layout. | Verify 320/360/390/430 and tablet portrait/landscape; preserve error/loading states and keyboard navigation. |

### Affected Areas

- `src/app/admin/layout.tsx`, `src/components/admin/sidebar.tsx` — global navigation, drawer/sheet, focus and route discovery.
- `src/components/admin/data-table.tsx` — common table overflow, priority columns/cards, pagination, empty/loading/error contracts; 15+ callers.
- `src/components/admin/confirm-dialog.tsx`, `src/components/admin/new-order-modal.tsx`, `src/components/admin/new-user-modal.tsx` — touch-sized modal actions, focus trap/return, mobile viewport behavior.
- `src/components/admin/stat-card.tsx` and dashboard/chart components — responsive grid and width-aware visualizations.
- `src/app/admin/{page,products,inventory,categories,documents,design,users,orders,quotes,leads,settings}/**` — page-specific filters, forms, tables and actions.
- `src/components/layout/header.tsx`, `header-mobile-menu.tsx`, cart drawer, `src/components/ui/container.tsx` — public navigation, safe-area spacing, fluid container behavior.
- `src/app/productos/**`, `src/app/contacto/page.tsx`, `src/app/cuenta/**`, home components — storefront cards, forms, overlays and typography.
- `tests/components/admin/*`, `tests/components/layout/*`, `tests/app/admin/*`, Playwright public-route/catalog suites — existing test seams; add viewport projects and keyboard/action coverage during implementation.

### Responsive Architecture Options

1. **Shared responsive shell plus per-screen data presentation** — Introduce one admin shell/drawer and shared responsive primitives (`PageHeader`, `FilterBar`, `ResponsiveTable`, `MobileRecordCard`, `ActionMenu`, modal/sheet contract), then migrate screens incrementally.
   - Pros: fixes the global failure once; preserves functionality; consistent focus/touch/loading behavior; supports cards, priority tables, and true scroll tables intentionally.
   - Cons: requires careful API design and migration sequencing; broad blast radius around `DataTable`.
   - Effort: Medium/High.

2. **CSS-only shrink/wrap of existing screens** — Add breakpoints and `overflow-x-auto` to current markup.
   - Pros: quick and low code churn.
   - Cons: reproduces screenshot failures, hides actions/information, leaves keyboard/modal problems, and does not meet the manager-operability objective.
   - Effort: Low initially, High operational debt.

3. **Rewrite each route independently** — Rebuild every screen with bespoke mobile markup.
   - Pros: local control and easy screenshot targeting.
   - Cons: duplicates interaction/accessibility logic, creates inconsistent patterns, and exceeds review budget quickly.
   - Effort: High.

### Recommendation

Choose option 1. Establish responsive foundations first, then migrate autonomous route families. Use cards for CRUD/list screens where row actions and identity matter (users, categories, products, leads, orders/quotes); use intentionally scrollable audit tables for movements/documents when all columns are meaningful, with a visible scroll affordance and sticky identity column; use priority-column tables only when the secondary data remains available through an action/detail surface. The implementation MUST retain every action and field, use minimum 44px touch targets, visible focus, Escape/focus-return behavior, and test 320/360/390/430 plus 768/820/1024 orientations.

### Prerequisite and Delivery Slicing

Do not start responsive code until real image upload/WebP validation and sharp-runtime Docker simplification are finished and verified. Force-chained slices should stay below 400 changed lines each:

1. **Responsive contract and viewport test harness** — tokens, breakpoint policy, Playwright viewport matrix, focus/touch assertions; no route redesign.
2. **Admin shell/navigation** — drawer/sheet, header, route discovery, focus lock/return, tablet layout.
3. **Shared data/action primitives** — responsive table/card contracts, pagination, action menu, modal/sheet accessibility; migrate no more than one representative screen.
4. **Admin catalog family** — products, categories, design/settings forms; keep upload work excluded and consume its finished contract.
5. **Admin operations family** — inventory and movement history, including stock actions and audit-table strategy.
6. **Admin commerce family** — orders, quotes, leads, status filters, details, new-order modal.
7. **Admin content/access family** — users and documents, upload UI integration only after prerequisite, empty/error/loading states.
8. **Storefront/account family** — public header/cart, home/catalog/product/contact/account/login at all target widths.
9. **Cross-route verification and polish** — accessibility, keyboard, orientation, charts, regression screenshots, performance; no behavior changes hidden as polish.

Each slice needs a clear start/finish, focused tests, rollback by reverting one PR, and a changed-line check before opening the next child PR.

### Risks

- The admin shell and `DataTable` have broad blast radius; a global change can regress many RBAC-specific routes.
- Card conversion can accidentally omit columns/actions; define a row-to-card information contract and test every action.
- Existing overlays have a history of portal/positioning bugs; preserve portal rendering and add focus/scroll-lock tests.
- Fixed widths, long Spanish labels, browser chrome, virtual keyboards, and safe areas will expose failures not visible at one screenshot width.
- Charts and image previews may overflow or require client-only measurement; do not couple this change to the pending upload/runtime work.
- Server-rendered pages and server actions must retain progressive loading, validation, error, and unauthorized states while markup changes.

### Ready for Proposal

Yes. The prerequisite must be recorded as a hard dependency in the proposal/design and completed first. The next phase should turn this exploration into scoped requirements and a responsive component contract; no application code should be changed during exploration.
