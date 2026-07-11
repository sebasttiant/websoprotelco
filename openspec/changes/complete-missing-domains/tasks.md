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

- [x] 1.1 Create migration `0006_settings.sql` with seed data
- [x] 1.2 Write schema tests for settings validation
- [x] 1.3 Implement `src/domains/settings/schemas.ts`
- [x] 1.4 Write repository tests (covered indirectly via service tests asserting on SQL, matching the users domain convention — no repository.test.ts exists in any domain)
- [x] 1.5 Implement `src/domains/settings/repository.ts`
- [x] 1.6 Write service tests
- [x] 1.7 Implement `src/domains/settings/service.ts`
- [x] 1.8 Write action tests
- [x] 1.9 Implement `src/domains/settings/actions.ts`
- [x] 1.10 Create `src/domains/settings/index.ts`
- [x] 1.11 Create admin page `src/app/admin/settings/page.tsx`
- [x] 1.12 Run gates: lint, typecheck, test, build (all 4 green — see apply report)
- [ ] 1.13 Commit as work unit (left for the orchestrator to review and commit)

## Phase 2: Leads Domain (PR 2)

- [x] 2.1 Create migration `0007_leads.sql`
- [x] 2.2 Write schema tests for leads validation
- [x] 2.3 Implement `src/domains/leads/schemas.ts`
- [x] 2.4 Write repository tests (covered indirectly via service tests asserting on SQL, matching the settings/users domain convention — no repository.test.ts exists in any domain)
- [x] 2.5 Implement `src/domains/leads/repository.ts`
- [x] 2.6 Write service tests
- [x] 2.7 Implement `src/domains/leads/service.ts`
- [x] 2.8 Write action tests
- [x] 2.9 Implement `src/domains/leads/actions.ts`
- [x] 2.10 Create `src/domains/leads/index.ts`
- [x] 2.11 Update contact form to use leads domain
- [x] 2.12 Create admin page `src/app/admin/leads/page.tsx` (plus `src/app/admin/leads/[id]/page.tsx` detail page for notes/assignment, and the nav link in `src/app/admin/layout.tsx`)
- [x] 2.13 Run gates: lint, typecheck, test, build (all 4 green — see apply report)
- [ ] 2.14 Commit as work unit (left for the orchestrator to review and commit)

## Phase 3: Inventory Domain (PR 3)

- [x] 3.1 Create migration `0008_inventory.sql`
- [x] 3.2 Write schema tests for stock movements
- [x] 3.3 Implement `src/domains/inventory/schemas.ts`
- [x] 3.4 Write repository tests (covered indirectly via service tests asserting on SQL, matching the settings/leads/users domain convention — no repository.test.ts exists in any domain)
- [x] 3.5 Implement `src/domains/inventory/repository.ts`
- [x] 3.6 Write service tests
- [x] 3.7 Implement `src/domains/inventory/service.ts`
- [x] 3.8 Write action tests
- [x] 3.9 Implement `src/domains/inventory/actions.ts`
- [x] 3.10 Create `src/domains/inventory/index.ts`
- [x] 3.11 Create admin page `src/app/admin/inventory/page.tsx` (plus the nav link in `src/app/admin/layout.tsx` and `inventory:read`/`inventory:write` permissions in `src/server/auth/rbac.ts`)
- [x] 3.12 Run gates: lint, typecheck, test, build (all 4 green — see apply report)
- [ ] 3.13 Commit as work unit (left for the orchestrator to review and commit)

## Phase 4: Documents Domain (PR 4)

- [x] 4.1 Create migration `0009_documents.sql`
- [x] 4.2 Write schema tests for documents
- [x] 4.3 Implement `src/domains/documents/schemas.ts`
- [x] 4.4 Write repository tests (covered indirectly via service tests asserting on SQL, matching the settings/leads/inventory domain convention — no repository.test.ts exists in any domain)
- [x] 4.5 Implement `src/domains/documents/repository.ts`
- [x] 4.6 Write service tests
- [x] 4.7 Implement `src/domains/documents/service.ts`
- [x] 4.8 Write action tests
- [x] 4.9 Implement `src/domains/documents/actions.ts`
- [x] 4.10 Create `src/domains/documents/index.ts`
- [x] 4.11 Create admin page `src/app/admin/documents/page.tsx` (plus `src/app/api/documents/upload/route.ts`, `src/components/admin/document-upload-field.tsx`, storage adapter extensions in `src/server/storage/*`, `documents:read`/`documents:write` permissions in `src/server/auth/rbac.ts`, and the nav link in `src/app/admin/layout.tsx`)
- [x] 4.12 Run gates: lint, typecheck, test, build (all 4 green — see apply report)
- [x] 4.13 Commit as two work units (core + actions/admin/API)

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
