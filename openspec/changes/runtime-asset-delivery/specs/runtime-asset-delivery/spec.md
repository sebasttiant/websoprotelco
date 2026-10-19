# Runtime Asset Delivery Specification

## Purpose

Serve persisted assets outside `public` at unchanged URLs without data migration.

## Requirements

### Requirement: Enforce bounded path and stream policy

Every decoded segment MUST match `^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$`. Uploads MUST allow only `<file>` or `(banners|hero)/<file>` and map `.jpg=image/jpeg`, `.png=image/png`, `.webp=image/webp`. Documents MUST allow only `(manual|datasheet|certificate|warranty|other)/<file>` and map `.pdf=application/pdf`. Other depths, categories, extensions, or case MUST be rejected.

The reader MUST enforce containment, reject detectable symlinks at root/ancestors/leaf, open the leaf once with `O_RDONLY | O_NOFOLLOW`, require regular-file `fstat`, and stream via `createReadStream({ autoClose: true })` plus `Readable.toWeb()`. `FileHandle` owns before stream creation; `ReadStream` owns afterward. Pre-transfer failure MUST close the handle; later setup failure MUST destroy the stream; end/error/cancel MUST auto-close.

#### Scenario: Policy and ownership
- GIVEN an unsafe path/target or any setup/body termination outcome
- WHEN the reader handles it
- THEN no disallowed bytes or descriptor leak occurs.

### Requirement: Map root and asset outcomes exactly

Invalid policy, descendant `ENOTDIR`/`ELOOP`, symlink, or non-regular target MUST return `404`. After leaf `ENOENT`, the trusted root MUST be revalidated: unavailable/missing/misconfigured root MUST return sanitized `503`; a valid root with an absent asset MUST return `404`. `EACCES`, `EPERM`, `EIO`, `EMFILE`, and other operational faults MUST return sanitized `503`.

#### Scenario: Leaf miss versus root fault
- GIVEN an absent leaf and an unavailable root
- WHEN each is requested
- THEN the leaf returns `404` and the root fault returns `503`.

### Requirement: Emit delivery headers

Uploads MUST return the mapped image type and `X-Content-Type-Options: nosniff`. Documents MUST return `application/pdf`, `nosniff`, and `Content-Disposition: attachment`.

#### Scenario: Required headers
- GIVEN one valid image and PDF
- WHEN fetched at unchanged URLs
- THEN each returns its required type/headers and only the PDF is attachment.

### Requirement: Cut over the same volumes atomically

The system MUST preserve URLs, database values, named-volume identities, and bytes. The old container MUST use those volumes at `/app/public/uploads|documents`; the candidate MUST use them at `/app/data/uploads|documents`. Readers, writers/deletes, probes, tests, handlers, and remounts MUST switch together; mixed roots MUST NOT deploy.

#### Scenario: Candidate topology
- GIVEN populated named volumes on old mounts
- WHEN the candidate starts
- THEN the same identities/bytes appear on data mounts and all I/O uses them.

### Requirement: Gate manual deployment

`deploy.sh` MUST require `MAINTENANCE_WINDOW_CONFIRMED=true`, `KNOWN_UPLOAD_URL=/uploads/...`, and `KNOWN_DOCUMENT_URL=/documents/...`. URLs MUST be policy-valid same-origin absolute paths without query/fragment. Missing, false, or malformed inputs MUST abort before backup, stop, build, remount, or mutation. Inputs are operator evidence, not Coolify automation.

Inventory/backup MUST inspect named volumes by identity, independently of old/candidate paths. Candidate checks MUST run on `/app/data/*` and prove destination, UID/GID 1001 access, storage health, and known URLs before recording success.

#### Scenario: Invalid input or failed candidate
- GIVEN invalid evidence or a failed candidate check
- WHEN deployment runs
- THEN it aborts before mutation or success recording, respectively.

### Requirement: Bound delivery and rollback

Delivery MUST remain one atomic, maintainer-approved `size:exception` PR forecast at 552–699 changed lines. If current diff OR forecast reaches 700, work MUST STOP before further apply or commit; maximum is 699. Full Judgment Day MUST pass before commit and merge.

Rollback MUST keep traffic isolated, stop the candidate, start the previous image with the same volumes at `/app/public/uploads|documents`, verify identity, health, and both known URLs, then restore traffic. It MUST NOT globally replace paths or delete/reset/rename/recreate volumes.

#### Scenario: Safe rollback
- GIVEN a candidate failure under isolated traffic
- WHEN rollback completes in the required order
- THEN known URLs pass and bytes remain intact before traffic returns.

## Explicit Non-Requirements

The capability MUST NOT add Range/ETag, native bindings, proxy/TLS changes, migration/import, cleanup, responsive/notification work, `sharp` changes, or weaker tests.
