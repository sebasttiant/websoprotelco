# Tasks: Complete Missing Domains

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~2000 across 5 domains |
| 400-line budget risk | High (each domain ~400 lines) |
| Chained PRs recommended | Yes |
| Suggested split | 5 PRs (one per domain) |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

## Phase 1: Settings Domain (PR 1)

- [ ] 1.1 Create migration `0006_settings.sql` with seed data
- [ ] 1.2 Write schema tests for settings validation
- [ ] 1.3 Implement `src/domains/settings/schemas.ts`
- [ ] 1.4 Write repository tests
- [ ] 1.5 Implement `src/domains/settings/repository.ts`
- [ ] 1.6 Write service tests
- [ ] 1.7 Implement `src/domains/settings/service.ts`
- [ ] 1.8 Write action tests
- [ ] 1.9 Implement `src/domains/settings/actions.ts`
- [ ] 1.10 Create `src/domains/settings/index.ts`
- [ ] 1.11 Create admin page `src/app/admin/settings/page.tsx`
- [ ] 1.12 Run gates: lint, typecheck, test, build
- [ ] 1.13 Commit as work unit

## Phase 2: Leads Domain (PR 2)

- [ ] 2.1 Create migration `0007_leads.sql`
- [ ] 2.2 Write schema tests for leads validation
- [ ] 2.3 Implement `src/domains/leads/schemas.ts`
- [ ] 2.4 Write repository tests
- [ ] 2.5 Implement `src/domains/leads/repository.ts`
- [ ] 2.6 Write service tests
- [ ] 2.7 Implement `src/domains/leads/service.ts`
- [ ] 2.8 Write action tests
- [ ] 2.9 Implement `src/domains/leads/actions.ts`
- [ ] 2.10 Create `src/domains/leads/index.ts`
- [ ] 2.11 Update contact form to use leads domain
- [ ] 2.12 Create admin page `src/app/admin/leads/page.tsx`
- [ ] 2.13 Run gates: lint, typecheck, test, build
- [ ] 2.14 Commit as work unit

## Phase 3: Inventory Domain (PR 3)

- [ ] 3.1 Create migration `0008_inventory.sql`
- [ ] 3.2 Write schema tests for stock movements
- [ ] 3.3 Implement `src/domains/inventory/schemas.ts`
- [ ] 3.4 Write repository tests
- [ ] 3.5 Implement `src/domains/inventory/repository.ts`
- [ ] 3.6 Write service tests
- [ ] 3.7 Implement `src/domains/inventory/service.ts`
- [ ] 3.8 Write action tests
- [ ] 3.9 Implement `src/domains/inventory/actions.ts`
- [ ] 3.10 Create `src/domains/inventory/index.ts`
- [ ] 3.11 Create admin page `src/app/admin/inventory/page.tsx`
- [ ] 3.12 Run gates: lint, typecheck, test, build
- [ ] 3.13 Commit as work unit

## Phase 4: Documents Domain (PR 4)

- [ ] 4.1 Create migration `0009_documents.sql`
- [ ] 4.2 Write schema tests for documents
- [ ] 4.3 Implement `src/domains/documents/schemas.ts`
- [ ] 4.4 Write repository tests
- [ ] 4.5 Implement `src/domains/documents/repository.ts`
- [ ] 4.6 Write service tests
- [ ] 4.7 Implement `src/domains/documents/service.ts`
- [ ] 4.8 Write action tests
- [ ] 4.9 Implement `src/domains/documents/actions.ts`
- [ ] 4.10 Create `src/domains/documents/index.ts`
- [ ] 4.11 Create admin page `src/app/admin/documents/page.tsx`
- [ ] 4.12 Run gates: lint, typecheck, test, build
- [ ] 4.13 Commit as work unit

## Phase 5: Design Domain (PR 5)

- [ ] 5.1 Create migration `0010_design.sql`
- [ ] 5.2 Write schema tests for banners
- [ ] 5.3 Implement `src/domains/design/schemas.ts`
- [ ] 5.4 Write repository tests
- [ ] 5.5 Implement `src/domains/design/repository.ts`
- [ ] 5.6 Write service tests
- [ ] 5.7 Implement `src/domains/design/service.ts`
- [ ] 5.8 Write action tests
- [ ] 5.9 Implement `src/domains/design/actions.ts`
- [ ] 5.10 Create `src/domains/design/index.ts`
- [ ] 5.11 Create admin page `src/app/admin/design/page.tsx`
- [ ] 5.12 Run gates: lint, typecheck, test, build
- [ ] 5.13 Commit as work unit

## Critical Rules

1. TDD: Write tests BEFORE implementation
2. Gates: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` after each task
3. Max 400 lines per PR
4. Do NOT modify existing domains (catalog, quote-order, users)
5. Use sub-agents for implementation
6. Save progress in Engram after each phase
