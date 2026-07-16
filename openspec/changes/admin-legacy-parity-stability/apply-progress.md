# Apply Progress: Admin Legacy Parity Stability

## Slice 0 / Checkpoint Preservation

Status: complete for tasks 0.1-0.3; 0.4 not used; 0.5 deferred because the integration/tracker PR to `main` remains intentionally unopened until the integration branch carries content.

## Completed Tasks

- [x] 0.1 Checkpoint gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `git diff --check feat/admin-legacy-parity-stability...HEAD` passed on `chore/p1-p5-checkpoint`.
- [x] 0.2 Branch preflight: created and pushed `feat/admin-legacy-parity-stability` at `origin/main` base without stashing or losing tracked/untracked files; created `chore/p1-p5-checkpoint` from it.
- [x] 0.3 Split checkpoint: split the current P1-P5 checkpoint into logical commits with tests kept beside behavior.
- [x] 0.R1 Design link safety remediation: design links now use an internal-path/http(s) allowlist before persistence, are sanitized before reaching Next `<Link href>` from persisted values, expose validation failures accessibly, and use a text input compatible with internal paths.
- [x] 0.R2 Catalog legacy image edit remediation: omitted product/category image fields are omitted at the action boundary and retain DB images; unchanged unsafe legacy values are preserved only when they match authoritative DB state; explicit blank values remove the image; forged/new unsafe image values fail validation and do not mutate; edit errors render accessibly.

## Issue / Branch / PR Artifacts

- Issue: https://github.com/sebasttiant/websoprotelco/issues/2 (`status:approved`)
- Integration branch: https://github.com/sebasttiant/websoprotelco/tree/feat/admin-legacy-parity-stability
- Child branch: https://github.com/sebasttiant/websoprotelco/tree/chore/p1-p5-checkpoint
- Child PR: https://github.com/sebasttiant/websoprotelco/pull/3 (base `feat/admin-legacy-parity-stability`, label `type:chore`)
- Tracker PR to `main`: deferred.

## Commits

- `0f8f5bd` `docs(sdd): capture admin parity stability proposal`
- `4983862` `docs(sdd): add admin parity stability specs`
- `b8d780a` `docs(sdd): define admin parity stability slices`
- `88c4cf3` `fix(admin): harden admin route boundaries`
- `46e620e` `feat(admin): centralize Spanish status labels`
- `996302f` `feat(admin): add accessible destructive confirmations`
- `a810729` `fix(admin): localize upload validation errors`
- `d0be8fd` `fix(catalog): reject unsafe admin image paths`
- `5ca1cb7` `feat(admin): group Spanish admin navigation`
- `4cb7815` `feat(admin): localize admin list workflows`
- `87e06d2` `docs(sdd): record slice zero apply progress`
- `8aef176` `docs(sdd): update slice zero progress receipt`
- `ec79967` `ci: align workflow runtime versions`
- `380dd3a` `docs(sdd): record ci runtime alignment`
- `1291d7b` `ci: skip e2e when database secret is absent`
- `60355bb` `fix(design): restrict design links to safe destinations`
- `719a1e9` `fix(catalog): preserve legacy images on unrelated updates`

## Verification

- `pnpm lint` — passed.
- `pnpm typecheck` — passed.
- `pnpm test` — passed, 64 files / 518 tests.
- `pnpm build` — passed.
- `git diff --check feat/admin-legacy-parity-stability...HEAD` — passed.
- `git status --short --branch` — clean after progress artifact push.
- GitHub Actions first failed before commands ran because workflow pnpm/node versions lagged `package.json`; fixed in `ec79967` by aligning CI to pnpm 11.13.0 and Node 24.18.0.
- GitHub Actions then reached the E2E step and failed because `DATABASE_URL` is not configured in CI; fixed in `1291d7b` by keeping E2E conditional until a database secret exists, matching the SDD plan that E2E remains advisory/later-slice work.
- Focused remediation: `pnpm vitest run tests/server/domains/catalog/actions.test.ts tests/server/domains/design/actions.test.ts tests/app/admin/catalog-edit-error-contracts.test.tsx tests/app/admin/design-error-contracts.test.tsx tests/server/domains/design/schemas.test.ts tests/components/home/hero.test.tsx` — passed, 62 tests.
- Remediation full gates: `pnpm lint` — passed; `pnpm typecheck` — passed; `pnpm test` — passed, 65 files / 542 tests; `pnpm build` — passed; `git diff --check` — passed.
- Final remediation diffstat across the two code commits `60355bb..719a1e9`: 341 insertions / 32 deletions; 373 changed lines, under the 400-line review budget. Per commit: `60355bb` 134/14 (148 lines), `719a1e9` 207/18 (225 lines).
- The cross-domain error-contract test file was split into `tests/app/admin/catalog-edit-error-contracts.test.tsx` and `tests/app/admin/design-error-contracts.test.tsx` so each commit carries its own tests and reverting one domain does not remove the other's coverage. Assertions were preserved unchanged.
- Independent re-verification before the split confirmed the `image_url = CASE WHEN ... ELSE image_url END` update against a real PostgreSQL 16 instance, covering the omitted, blank, and replacement cases. The committed suite mocks `@/server/db/pool`, so this SQL has no automated coverage; the omitted/blank behaviour must be re-checked manually against the server database on first deploy.

## Review Budget

Commit-level units were kept below 400 changed lines where technically practical. The aggregate PR exceeds 400 changed lines because Slice 0 preserves the already-complete P1-P5 checkpoint plus SDD artifacts as one base child PR; splitting it into separate child PRs would damage the checkpoint base. Later slices remain governed by the 400-line per-slice gate.

The PR #3 remediation work unit is autonomous and under budget: design link safety plus catalog legacy image edit safety only, excluding observability, CI database provisioning, dependency upgrades, upload deduplication, Orders, migrations, inventory redesign, dashboard, and later slices.

## Remaining Work

- [ ] 0.5 Tracker PR to `main` remains deferred until the integration branch has content.
- [ ] Slices 1-12 remain pending. Do not start Orders, migrations, inventory redesign, dashboard/E2E, or later slices until Slice 0 review/merge path is clear.
