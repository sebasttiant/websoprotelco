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

## Deploy Backup/Rollback Follow-up: Manual Documents Migration Simplification

Status: WIP simplified from the interrupted automatic documents migration state machine. No SDD task checkbox was advanced because this is an operational hardening follow-up to the deploy safety work, not a planned Orders slice.

### Completed in this WIP

- Removed automatic documents migration state/resume/fallback concepts from `deploy.sh`/`deploy-lib.sh`, including pending/completed state helpers and historical archive auto-selection.
- Removed the now-unnecessary `deploy-state.sh` operator state mutator.
- Kept `documents-data` persistence and Dockerfile mountpoint ownership model.
- Kept verified `.partial` -> final PostgreSQL, uploads, and documents backups.
- Kept six-column rollback manifest and rollback fail-closed checks for missing/incomplete database/uploads/documents snapshot columns.
- Kept retention protection for the current rollback snapshot and rollback restore of database/uploads/documents from the same manifest entry.
- Added fail-closed deploy preflight before build/recreate: if legacy `/app/public/documents` still lives only in the current `web` container writable layer, deploy aborts and points to the manual runbook.
- Added `docs/operations/legacy-documents-migration.md` for the one-time manual migration with writes stopped, archive validation, exact restore, count/SHA/byte evidence, health check, and abort/recovery steps.
- Replaced state-machine tests with behavior tests for fail-closed decisions, six-column manifest parsing, retention protection, complete rollback snapshot selection, and absence of historical documents archive auto-selection.

### Verification in this WIP

- `bash -n deploy.sh rollback.sh deploy-lib.sh tests/deploy/run.sh` — passed.
- `bash tests/deploy/run.sh` — passed, 34/34 assertions.
- `git diff --check` — passed.
- `shellcheck deploy.sh rollback.sh deploy-lib.sh tests/deploy/run.sh` — not run: `shellcheck` is not installed in this environment.
- Docker byte-for-byte/VPS validation — not run locally; no deploy, VPS mutation, or Docker daemon validation was performed in this WIP.

### Review Boundary

Current work unit is the deploy safety simplification only: no Orders, migrations, inventory, dashboard, app runtime, PR mutation, commit, push, merge, or deploy. Fresh independent reliability/resilience review is recommended before committing or running on the VPS.

### Corrective Pass After Gate Review

Status: completed one bounded corrective pass for the evidence-backed gate findings while preserving the no-state-machine design.

- Made complete snapshots mandatory for existing deployments: `deploy.sh` aborts before migrations/recreate if database, uploads, or documents snapshot is missing. First-ever deploy with no prior web/database state may proceed without a rollback manifest entry; deploy no longer writes a manifest row that rollback would refuse.
- Added a final post-deploy success gate before `LAST_DEPLOYED_SHA_FILE`: failed schema checks, skipped schema DB connectivity, or critical endpoint failures now exit non-zero and do not mark the commit successfully deployed.
- Rewrote the manual legacy documents runbook to keep write isolation concrete: block ingress, stop `web`, capture with `docker cp` from the stopped legacy container, restore through a one-shot container before web serves traffic, compare source/destination manifests, then start web and ingress.
- Strengthened migration evidence in the runbook: source and destination manifests record regular files by path + SHA-256 and symlinks by path + target; archive SHA/byte evidence is retained.
- Added `tests/deploy/deploy-abort.sh`, a deploy-level fake command harness proving legacy writable-layer documents abort before `docker compose build`, `up`, or `run` can execute.

### Corrective Verification

- `bash -n deploy.sh rollback.sh deploy-lib.sh tests/deploy/run.sh tests/deploy/deploy-abort.sh` — passed.
- `docker run --rm -v "$PWD:/mnt" -w /mnt koalaman/shellcheck:stable deploy.sh rollback.sh deploy-lib.sh tests/deploy/run.sh tests/deploy/deploy-abort.sh` — passed.
- `bash tests/deploy/run.sh && bash tests/deploy/deploy-abort.sh` — passed, 34/34 helper assertions and 2/2 deploy-abort assertions.
- `git diff --check` — passed.
- App/unit tests were not run because this corrective pass touched only deploy shell scripts, operational docs, SDD progress, and deploy shell tests; no TypeScript/runtime application code changed.

### Final Bounded Correction for VPS Deploy Readiness

Status: completed the three final review blockers without reintroducing automatic documents migration state, historical archive selection, or empty-volume inference.

- Replaced Bash-only `read -d` manifest logic in the runbook with POSIX `sh` manifest generation. The manifest path handles spaces/non-ASCII, records regular files as path + SHA-256, records symlinks as path + target, and fails loudly for unsupported tab/newline names or command failures. Destination evidence runs under the runtime `/bin/sh`; bash is not assumed in the runtime image.
- Tightened `deploy.sh` endpoint verification: `/api/health?check=db`, `/login`, and `/productos` now require explicit `2xx` statuses. `401`, `403`, `404`, node/fetch failures, and unparsable statuses fail closed and prevent `LAST_DEPLOYED_SHA_FILE` from being updated.
- Added deploy-level regression coverage in `tests/deploy/deploy-verify-fail.sh` proving failed endpoint verification exits non-zero and leaves an existing `backups/last-deployed-sha` unchanged.
- Added `tests/deploy/runtime-manifest.sh` to probe the manifest-generation logic against `node:24.18.0-trixie-slim` runtime shell behavior with spaces, non-ASCII paths, and symlinks.

### Final Correction Verification

- `bash -n deploy.sh rollback.sh deploy-lib.sh tests/deploy/run.sh tests/deploy/deploy-abort.sh tests/deploy/deploy-verify-fail.sh tests/deploy/runtime-manifest.sh` — passed.
- `docker run --rm -v "$PWD:/mnt" -w /mnt koalaman/shellcheck:stable deploy.sh rollback.sh deploy-lib.sh tests/deploy/run.sh tests/deploy/deploy-abort.sh tests/deploy/deploy-verify-fail.sh tests/deploy/runtime-manifest.sh` — passed.
- `bash tests/deploy/run.sh && bash tests/deploy/deploy-abort.sh && bash tests/deploy/deploy-verify-fail.sh && bash tests/deploy/runtime-manifest.sh` — passed, 34/34 helper assertions, 2/2 deploy-abort assertions, 2/2 deploy-verification-failure assertions, and 3/3 runtime manifest assertions.
- `pnpm test` — passed, 66 files / 542 tests.
- `git diff --check` — passed.

### Final Surgical Rollback Resilience Correction

Status: completed the focused rollback blocker without redesigning deploy/rollback behavior.

- Fixed `rollback.sh` database recreation so the target database name is passed as a positional argument to the container shell. PostgreSQL variables intended for the container (`POSTGRES_USER`, `POSTGRES_DB` where used by container commands) are no longer expanded by the host in the recreate command. `.env` is not sourced.
- Audited nearby rollback recovery command strings; the remaining printed recovery commands intentionally escape `\$POSTGRES_USER`/`\$POSTGRES_DB` for the operator to run in the container shell, and the restore command already keeps container variables inside single-quoted `sh -lc` content.
- Added `tests/deploy/rollback-unset-db.sh`, a rollback script-level external-contract regression with host `POSTGRES_DB` unset. It reaches the recreate/restore boundary through a fake Docker harness and asserts destructive ordering remains `stop web -> safety dump -> recreate database -> restore database`.

### Rollback Resilience Verification

- `bash -n deploy.sh rollback.sh deploy-lib.sh tests/deploy/run.sh tests/deploy/deploy-abort.sh tests/deploy/deploy-verify-fail.sh tests/deploy/runtime-manifest.sh tests/deploy/rollback-unset-db.sh` — passed.
- `docker run --rm -v "$PWD:/mnt" -w /mnt koalaman/shellcheck:stable deploy.sh rollback.sh deploy-lib.sh tests/deploy/run.sh tests/deploy/deploy-abort.sh tests/deploy/deploy-verify-fail.sh tests/deploy/runtime-manifest.sh tests/deploy/rollback-unset-db.sh` — passed.
- `bash tests/deploy/run.sh && bash tests/deploy/deploy-abort.sh && bash tests/deploy/deploy-verify-fail.sh && bash tests/deploy/runtime-manifest.sh && bash tests/deploy/rollback-unset-db.sh` — passed, including 2/2 rollback-unset-db assertions.
- `pnpm test` — passed, 66 files / 542 tests.
- `git diff --check` — passed.
