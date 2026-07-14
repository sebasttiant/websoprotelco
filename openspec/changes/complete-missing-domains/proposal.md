# Proposal: Complete Missing Domains

## Intent

Complete the remaining 5 domain modules (inventory, leads, settings, documents, design) to enable full admin functionality. Each domain follows Screaming Architecture with repository, service, actions, and schemas layers.

## Scope

### In Scope
- `src/domains/inventory/` — stock movements, inventory tracking, low-stock alerts
- `src/domains/leads/` — lead capture from contact form, lead management
- `src/domains/settings/` — site configuration, general settings
- `src/domains/documents/` — document management (PDFs, technical sheets)
- `src/domains/design/` — banner management, hero customization
- Migration files for new tables
- Tests for each domain (TDD)
- Admin pages for each domain

### Out of Scope
- UX/UI improvements (separate proposal)
- Image optimization with sharp (separate proposal)
- Import validators for legacy data

## Capabilities

### New Capabilities
- `inventory`: Stock movements, inventory tracking, low-stock alerts
- `leads`: Lead capture, lead management, status tracking
- `settings`: Site configuration management
- `documents`: Document upload and management
- `design`: Banner and hero customization

### Modified Capabilities
- `admin`: Add routes for new domain management pages

## Approach

Each domain follows the same pattern established by catalog, quote-order, and users:
1. Repository layer (database queries)
2. Service layer (business logic)
3. Actions layer (server actions for mutations)
4. Schemas layer (Zod 4 validation)
5. Tests (TDD: tests first, then implementation)

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/domains/` | New | 5 new domain modules |
| `db/migrations/` | New | Migration files for new tables |
| `src/app/admin/` | Modified | New admin pages for each domain |
| `tests/server/domains/` | New | Tests for each domain |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Schema inconsistency | Low | Follow established patterns from catalog/users |
| Breaking existing tests | Low | TDD approach, gates after each change |
| Scope creep | Med | Strict adherence to proposal scope |

## Rollback Plan

Each domain is isolated and can be reverted independently. Migrations are reversible.

## Dependencies

- Existing domains (catalog, quote-order, users) as reference patterns
- PostgreSQL schema for new tables
- Admin auth/RBAC for protected routes

## Success Criteria

- [ ] All 5 domains have repository, service, actions, schemas layers
- [ ] Each domain has passing tests (TDD)
- [ ] Admin pages exist for each domain
- [ ] Gates pass: lint, typecheck, tests, build
- [ ] No breaking changes to existing functionality
