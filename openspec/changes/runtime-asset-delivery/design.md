# Design: Runtime Asset Delivery

## Technical Approach

Use pinned Node `24.22.0` `FileHandle.createReadStream({ autoClose: true })` plus `Readable.toWeb()`. A server-only roots registry aligns readers, writers/deletes, probes, tests, and scripts. Thin handlers preserve URLs. Old containers mount the named volumes at `/app/public/uploads|documents`; the atomic candidate mounts those same identities at `/app/data/uploads|documents`.

## Architecture Decisions

| Option | Tradeoff | Decision and rationale |
|---|---|---|
| Explicit two-owner lifecycle | Requires cleanup at each setup stage. | `FileHandle` owns before successful stream creation; `ReadStream` owns immediately after. Conversion/`Response` failure destroys the stream; end/error/cancel auto-close. No `readableWebStream` auto-close claim. |
| Normative path policy | Intentionally excludes arbitrary trees. | Segment regex is `^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$`; uploads allow depth 1 or `banners|hero` + leaf, documents require `manual|datasheet|certificate|warranty|other` + leaf. Types are `.jpg=image/jpeg`, `.png=image/png`, `.webp=image/webp`, and `.pdf=application/pdf`. |
| Stage-aware error map | Requires root revalidation after a miss. | Reject detectable root/ancestor/leaf symlinks. After leaf `ENOENT`, revalidate the trusted root: unavailable/misconfigured is `503`; otherwise the asset is `404`. |
| One atomic PR | Exceeds 400 lines. | Approved `size:exception`; mixed topology is unsafe. If current diff OR forecast reaches 700, stop before further apply/commit; maximum 699; full Judgment Day required. |
| Operator-evidence gate | Requires a real maintenance window. | Required env inputs fail before mutation and are not Coolify automation. Candidate verification runs on data mounts; success is recorded last. |

## Data Flow

```text
URL -> route -> grammar/policy -> trusted root check -> one open/fstat
    -> createReadStream(autoClose) -> Readable.toWeb -> Response
Upload API -> root registry -> same preserved volume
operator evidence -> named-volume inventory/backup -> candidate data mounts
  -> mount/health/known-URL gates -> record success
rollback -> stop candidate -> previous image + old mounts -> known URLs -> restore traffic
```

## Interfaces / Contracts

Keep handle ownership until `createReadStream` returns, then transfer to the Node stream. Later setup failure destroys it; normal end, error, and cancellation close through `autoClose`.

Uploads emit allowlisted image `Content-Type` plus `X-Content-Type-Options: nosniff`. Documents emit `application/pdf`, `nosniff`, and `Content-Disposition: attachment`.

Deploy CLI contract:

```sh
MAINTENANCE_WINDOW_CONFIRMED=true \
KNOWN_UPLOAD_URL=/uploads/<policy-valid-path> \
KNOWN_DOCUMENT_URL=/documents/<policy-valid-path> \
./deploy.sh
```

Only literal `true` is accepted. URLs must be same-origin absolute paths without query/fragment and match their route policy. Missing/false/malformed input aborts before backup or any mutation. Inventory/backup mounts `uploads-data` and `documents-data` read-only by volume identity at script-owned inspection paths, never by assuming either application mount destination.

## File Changes and Atomic Forecast

Changed-line estimates are additions plus deletions. Baseline `HEAD` contains **49 matching reference lines** to old public asset paths; `deploy.sh`/`deploy-lib.sh`/`rollback.sh` are 831/181/492 lines, so scripts retain explicit transition headroom. Total: **552–699**. Reforecast after each task; reaching 700 in current diff or forecast stops apply/commit.

| File | Action | Forecast |
|---|---|---:|
| `src/server/storage/roots.ts` | Create central trusted roots | 32–38 |
| `src/server/storage/runtime-assets.ts` | Create policy, open, map, stream, probe | 120–135 |
| `src/server/storage/local.ts`, `index.ts` | Align writers/deletes/health; no document-domain edit | 22–30 |
| `src/app/uploads/[...path]/route.ts`, `src/app/documents/[...path]/route.ts`, `src/app/api/health/route.ts` | Create/wire thin handlers | 36–44 |
| `Dockerfile`, `compose.yaml` | Remount same volumes at `/app/data/*` | 16–20 |
| `deploy.sh` | Preconditions, named-volume inventory, candidate gates | 38–55 |
| `deploy-lib.sh` | Reusable input/volume assertions | 12–20 |
| `rollback.sh` | Stop candidate, old mounts/image, verify before traffic | 22–35 |
| `tests/server/storage/runtime-assets.test.ts` | Ownership, containment, exact 404/503, probe | 110–125 |
| `tests/server/storage/runtime-asset-routes.test.ts`, `provider.test.ts` | Headers, roots, writer/reader alignment | 48–60 |
| `tests/deploy/runtime-assets-contract.sh` | Transition/input/rollback contract | 38–57 |
| `tests/deploy/deploy-verify-fail.sh` | Failed-candidate/success-record contract | 12–18 |
| `tests/deploy/compose-contract.sh` | Exact old/candidate mount identities | 10–12 |
| `tests/deploy/run.sh` | Register operational contracts | 8–10 |
| `package.json`, `.github/workflows/ci.yml` | Run focused contract checks | 6–12 |
| `docs/operations/runtime-asset-cutover.md` | Manual window, deploy, evidence, rollback | 22–28 |

## Testing Strategy

| Layer | Approach |
|---|---|
| Unit | Real temp files; exact mapping; setup/end/error/cancel descriptor accounting. |
| Integration | Immediate image/PDF reads, required headers, unchanged URLs, root isolation, writer/delete alignment. |
| Deploy | Manual-window prerequisite, volume identity/destination, UID 1001, candidate health/known URLs, success-record protection, rollback. |

## Migration / Rollout

No data migration. Under isolated traffic, inspect/backup volumes by identity, verify the candidate data mounts before changing `last-deployed-sha`, and rollback by stopping it, starting the previous image with old mounts, verifying known URLs, then restoring traffic. Never globally replace paths or delete volumes.

## Open Questions

None.
