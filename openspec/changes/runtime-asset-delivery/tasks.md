# Tasks: Runtime Asset Delivery

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | One atomic PR: 552–699 including tests; maximum 699 |
| 400-line budget risk | High; maintainer-approved `size:exception` |
| Chained PRs recommended | No; forced slices create unsafe intermediate topology |
| Suggested split | None; atomic topology under approved exception |
| Delivery strategy | exception-ok |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

## Atomic PR File Forecast

| File | Lines |
|---|---:|
| `src/server/storage/roots.ts` | 32–38 |
| `src/server/storage/runtime-assets.ts` | 120–135 |
| `src/server/storage/local.ts` | 12–16 |
| `src/server/storage/index.ts` | 10–14 |
| `src/app/uploads/[...path]/route.ts` | 14–17 |
| `src/app/documents/[...path]/route.ts` | 14–17 |
| `src/app/api/health/route.ts` | 8–10 |
| `Dockerfile` | 8–10 |
| `compose.yaml` | 8–10 |
| `deploy.sh` | 38–55 |
| `deploy-lib.sh` | 12–20 |
| `rollback.sh` | 22–35 |
| `tests/server/storage/runtime-assets.test.ts` | 110–125 |
| `tests/server/storage/runtime-asset-routes.test.ts` | 40–50 |
| `tests/server/storage/provider.test.ts` | 8–10 |
| `tests/deploy/runtime-assets-contract.sh` | 38–57 |
| `tests/deploy/deploy-verify-fail.sh` | 12–18 |
| `tests/deploy/compose-contract.sh` | 10–12 |
| `tests/deploy/run.sh` | 8–10 |
| `package.json` | 2–4 |
| `.github/workflows/ci.yml` | 4–8 |
| `docs/operations/runtime-asset-cutover.md` | 22–28 |
| **Total** | **552–699** |

Baseline basis: `HEAD` has 49 matching old-path reference lines; operational baselines are `deploy.sh` 831, `deploy-lib.sh` 181, and `rollback.sh` 492 lines. `src/domains/documents/service.ts` is excluded: storage adapters already own filesystem resolution and no concrete domain ownership change exists.

## Phase 1: Reader and Atomic Wiring

- [ ] 1.1 Create `src/server/storage/{roots,runtime-assets}.ts`: `^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$`, specified depth/categories/type map, all-level detectable-symlink rejection, and one-open ownership. After leaf `ENOENT`, root unavailable/misconfigured is `503`; otherwise `404`.
- [ ] 1.2 Align `local.ts`, `index.ts`, both catch-all routes, and health to central roots; do not edit `src/domains/documents/service.ts` absent a newly proven ownership need.
- [ ] 1.3 Remount unchanged `uploads-data` and `documents-data` in `Dockerfile`/`compose.yaml` at `/app/data/*` in the same work unit.

## Phase 2: Tests and Operational Gate

- [ ] 2.1 Test every normative path/type/symlink case, root revalidation, ownership transition, headers, and writer/reader alignment with real temp files.
- [ ] 2.2 Require valid `MAINTENANCE_WINDOW_CONFIRMED=true`, `KNOWN_UPLOAD_URL`, and `KNOWN_DOCUMENT_URL` before mutation; test missing/false/malformed rejection. Inputs are operator evidence, not Coolify automation.
- [ ] 2.3 Inventory/backup named volumes independently of container paths; verify candidate on `/app/data/*`. Rollback stops candidate, starts previous image with old mounts, verifies known URLs, then restores traffic; never global-replace paths or delete volumes.

## Phase 3: Hard Gates

- [ ] 3.1 Run focused tests, deploy contracts, lint, typecheck, build, and runner-image verification; retain outputs as PR evidence.
- [ ] 3.2 Reforecast after every task and count additions+deletions before any further apply and commit. If current diff OR forecast reaches 700, STOP; maximum allowed is 699.
- [ ] 3.3 Record the `size:exception` rationale and run full Judgment Day with a matching receipt before commit and again before merge if the reviewed content changes.
