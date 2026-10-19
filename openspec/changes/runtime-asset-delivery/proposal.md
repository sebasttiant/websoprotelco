# Proposal: Runtime Asset Delivery

## Intent

Serve post-start assets in standalone Next.js while preserving URLs, volume identities, and bytes.

## Scope

### In Scope
- Remount the same named volumes from old-container `/app/public/uploads|documents` to candidate `/app/data/uploads|documents`, aligning writers/readers atomically.
- Add a one-open Node reader.
- Enforce normative path/type, symlink, exact 404/503, header, deploy-input, transition, and rollback contracts.
- Deliver one focused atomic PR under an approved maintainer `size:exception`, forecast at 552–699 changed lines including tests.

### Out of Scope
- Proxy/TLS, Range/ETag, migration/import, cleanup, responsive work, or `sharp` changes.
- Application maintenance code, invented Coolify commands, or a zero-downtime claim for direct `:8686`.
- Any change under `openspec/changes/responsive-web-admin/`.

## Capabilities

### New Capabilities
- `runtime-asset-delivery`: Serve persisted images and documents outside `public` through unchanged public URLs.

### Modified Capabilities
None.

## Approach

Land reader, roots, handlers, writers, remounts, health, deploy, and rollback evidence atomically. Accept `^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$`, only root-specific depths/categories and extension/type maps, and no detectable root/ancestor/leaf symlinks. After leaf `ENOENT`, revalidate the root: unavailable/misconfigured is `503`; otherwise `404`.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/server/storage/**` | Modified | Roots, reader, writers, probe |
| `src/app/{uploads,documents}/**` | New | Asset handlers |
| `Dockerfile`, `compose.yaml` | Modified | Same-volume `/app/data/*` cutover |
| `deploy.sh`, `deploy-lib.sh`, `rollback.sh`, `tests/**`, operations docs | Modified/New | Explicit operator inputs, volume-identity inventory, candidate gates, rollback proof |

## Risks

| Risk | Mitigation |
|---|---|
| Wrong error semantics or descriptor leak | Stage-aware mapping and setup/end/error/cancel tests |
| Mount/ownership mismatch | Host identity proof plus UID/GID 1001 probe |
| Unsafe mutation or false evidence | Require valid `MAINTENANCE_WINDOW_CONFIRMED=true`, `KNOWN_UPLOAD_URL`, and `KNOWN_DOCUMENT_URL` before mutation; these are operator evidence, not Coolify automation |

## Rollback Plan

Keep traffic isolated. Stop the candidate; start the previous image with the same named volumes mounted at `/app/public/uploads` and `/app/public/documents`; verify mount identity, health, and both known URLs; only then restore traffic. Inventory/backup addresses named volumes independently of either container path. Never globally replace paths or delete/reset/rename/recreate volumes.

## Dependencies

- Verified named-volume backup/byte inventory plus valid operator evidence: `MAINTENANCE_WINDOW_CONFIRMED=true`, `KNOWN_UPLOAD_URL=/uploads/...`, and `KNOWN_DOCUMENT_URL=/documents/...`.

## Success Criteria

- [ ] Historical and post-boot assets work at unchanged URLs across restart.
- [ ] Uploads return the appropriate image type plus `X-Content-Type-Options: nosniff`; documents return `application/pdf`, `nosniff`, and `Content-Disposition: attachment`.
- [ ] Exact 404/503 and stream ownership contracts pass focused tests.
- [ ] `deploy.sh` verifies the candidate container before recording success, with mount/health/rollback evidence in the same PR.
- [ ] If the current diff OR forecast reaches 700 changed lines, work stops before further apply or commit; maximum allowed is 699. Full Judgment Day passes before commit and merge.
