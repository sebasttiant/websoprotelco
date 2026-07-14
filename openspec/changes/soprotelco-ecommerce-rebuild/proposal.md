# Proposal: SOPROTELCO Ecommerce Rebuild

## Intent

Rebuild SOPROTELCO as a reliable, secure ecommerce/admin app. Preserve legacy graphics, images, colors, and visual identity; remove Supabase; use latest stable PostgreSQL; upgrade Node.js, Next.js, React, Tailwind, TypeScript/tooling, and web libraries.

## Scope

### In Scope
- Docker-first Next.js App Router rebuild with local/CI/deploy parity.
- Quote/order-request commerce: catalog, cart, request checkout, leads/contact, and WhatsApp/email handoff.
- Admin for products, categories, inventory, leads, quote/order requests, users/roles, settings, banners/design, documents.
- PostgreSQL persistence, first-party auth/RBAC, secure storage/uploads, and import plan.
- Add test runner/TDD strategy before features; CI/CD gates lint, typecheck, tests, build, and containers.
- Forced chained PRs under 400 changed lines.

### Out of Scope
- Online payments unless requested later.
- Copying legacy secrets, Supabase credentials, hard-coded bypasses, or host-only deploy scripts.
- Wholesale legacy copy that preserves Supabase coupling.

## Capabilities

### New Capabilities
- `visual-identity-preservation`: Assets, palette, layout feel, brand styling.
- `storefront-catalog`: Catalog, product detail, cart, contact, legal/account routes.
- `quote-order-commerce`: Request-based checkout; no online payments by default.
- `admin-operations`: Catalog, inventory, leads, quotes/orders, documents, users, settings, banners/design.
- `auth-rbac`: First-party sessions and role-based admin authorization.
- `postgres-persistence`: Schema, migrations, repositories, import checks.
- `delivery-platform`: Docker, CI/CD, deploy safety, version modernization.
- `testing-quality`: Test runner, TDD, coverage, verification gates.

### Modified Capabilities
- None — `openspec/specs/` has no existing specs.

## Approach

Clean rebuild with selective visual/domain migration. Extract legacy assets/theme tokens, then rebuild server-first boundaries around PostgreSQL, auth/RBAC, validation, storage, and tests. Deliver as chained PR slices.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/**`, `src/**` | New | Storefront/admin/domain. |
| `public/**`, `styles/**` | New | Assets/theme. |
| `db/**` | New | Schema/migrations/imports. |
| `Dockerfile`, `compose.yaml`, `.github/workflows/**` | New | Docker/CI/CD. |
| `tests/**` | New | TDD foundation. |
| Supabase usage | Removed | Auth/database/storage/RLS. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Supabase leakage | High | Clean boundaries; no wholesale copy. |
| Visual drift | Med | Token/asset extraction; visual review. |
| Schema inconsistency | High | Canonical PostgreSQL design. |
| Oversized PRs | High | Forced chained PRs. |

## Rollback Plan

Keep each PR revertible. Before cutover, keep the legacy site available; rollback via latest slice revert or previous container/database backup.

## Dependencies

- Rotated credentials; no legacy secrets copied.
- Latest stable runtime/database/framework versions selected during implementation.

## Success Criteria

- [ ] Docker app with PostgreSQL passes CI/CD.
- [ ] Supabase is absent from runtime.
- [ ] Tests exist before features and gate PRs.
- [ ] Storefront/admin support quote/order-request commerce.
- [ ] Legacy visual identity is preserved safely.
