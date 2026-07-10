# Design: Complete Missing Domains

## Architecture

Each domain follows the established Screaming Architecture pattern:

```
src/domains/{domain}/
├── repository.ts    # Database queries (uses pool.query)
├── service.ts       # Business logic (pure functions, no DB)
├── actions.ts       # Server actions (mutations, uses "use server")
├── schemas.ts       # Zod 4 validation schemas
└── index.ts         # Public exports
```

## Domain Implementation Order

Based on dependencies and complexity:

1. **settings** (simplest, no dependencies)
2. **leads** (depends on contact form integration)
3. **inventory** (depends on products domain)
4. **documents** (depends on storage adapter)
5. **design** (depends on storage adapter)

## Migration Strategy

Each domain gets its own migration file:
- `0006_settings.sql`
- `0007_leads.sql`
- `0008_inventory.sql`
- `0009_documents.sql`
- `0010_design.sql`

Migrations are additive only (no drops/alters of existing tables).

## File Size Budget

Each domain should stay under 400 lines total:
- repository.ts: ~50-80 lines
- service.ts: ~80-120 lines
- actions.ts: ~60-100 lines
- schemas.ts: ~40-60 lines
- index.ts: ~20 lines
- tests: ~100-150 lines

If a domain exceeds 400 lines, split into:
- PR N: Core domain (repository + service + schemas)
- PR N+1: Actions + admin page

## Testing Strategy

TDD approach for each domain:
1. Write schema tests first (validation rules)
2. Write service tests (business logic with mocked repository)
3. Write action tests (integration with mocked service)
4. Implement code to pass tests

## Authorization

All admin domains use existing RBAC:
- `requirePermission("{domain}:read")` for reads
- `requirePermission("{domain}:write")` for writes

Permission matrix update needed in `src/server/auth/rbac.ts`.

## Dependencies

```
settings → (no dependencies)
leads → (no dependencies)
inventory → products (foreign key)
documents → products (optional FK), storage adapter
design → storage adapter
```

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing domains | Isolated migrations, no alters |
| Exceeding 400 lines | Split into chained PRs |
| Test failures | TDD, gates after each change |
| Coordination conflicts | Sub-agents work on isolated domains |
