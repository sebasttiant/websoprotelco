## Exploration: runtime-asset-delivery

### Current State
The baseline at `4835e9f` uses `src/server/storage/local.ts` to write product images to `public/uploads` and documents/design images to `public/documents`/`public/uploads/{banners,hero}`. Database rows and form fields persist public URLs such as `/uploads/...` and `/documents/...`; catalog/design previews use `next/image`, while document links use the stored URL. Docker currently mounts named volumes at `/app/public/uploads` and `/app/public/documents` and creates those directories in the image for UID 1001. Next standalone indexes `public` at boot, so newly written files are not visible until restart.

The current branch also contains a rejected, uncommitted runtime implementation. It is failure evidence only: it grew to roughly 1,940 lines and introduced over-broad HTTP semantics and operational/test surface. It must not be adopted, staged, or used as the design baseline. `openspec/changes/responsive-web-admin/` is unrelated and remains untouched.

### Affected Areas
- `src/server/storage/local.ts` — move the two runtime roots outside `public` while preserving URL construction, generated filenames, category/target segments, and existing database values; retain sharp product optimization.
- `src/server/storage/index.ts` — keep the existing local adapter/provider contract and add only the smallest root/configuration seam needed by writers and route handlers.
- `src/app/uploads/[...path]/route.ts` — new thin Node-runtime catch-all handler for generated image/design URLs.
- `src/app/documents/[...path]/route.ts` — new thin Node-runtime catch-all handler for document URLs.
- `next.config.ts` — retain security headers for the unchanged public URL prefixes and ensure dynamic handlers are not shadowed by static assumptions.
- `Dockerfile` — create `/app/data/uploads` and `/app/data/documents` with runtime-user ownership; do not copy runtime data into the image.
- `compose.yaml` — remount existing named volumes at `/app/data/uploads` and `/app/data/documents`, preserving volume names and contents; add no infrastructure server.
- `src/app/api/health/route.ts`, `deploy.sh`, `deploy-lib.sh` — verify the configured roots/permissions at deploy time without turning health into a general file-serving concern.
- `src/app/api/upload/route.ts`, `src/app/api/documents/upload/route.ts`, `src/app/api/design/upload/route.ts` — behavior should remain unchanged except for the adapter’s filesystem destination.
- `src/components/admin/image-upload-field.tsx`, `src/components/admin/design-image-upload-field.tsx`, document UI and consumers — public URLs remain unchanged, so no data migration or responsive work is needed; verify `next/image` can fetch the handler-backed paths.
- `tests/server/storage/**`, route tests, deploy contract tests, and a standalone/restart verification — cover containment, extension policy, status mapping, stream closure, volume remount, upload-then-fetch, and persisted pre-existing files.

### Approaches
1. **Outside-public storage + native App Router Route Handlers (preferred)** — mount `/app/data/uploads` and `/app/data/documents`; resolve only generated safe segments beneath the selected root; open once and return `FileHandle.readableWebStream()` through a `Response`.
   - Pros: fixes boot indexing without changing public URLs or database values; native Next.js/Node runtime; smallest reversible application change; existing volumes can be remounted in place; no second server or proxy.
   - Cons: application owns a small security-sensitive file-read boundary; must explicitly close handles on stream completion/cancellation/error and return 404/503 consistently.
   - Effort: Medium.

2. **Dual static/dynamic approach** — keep files in `public` and add handlers/fallback behavior for misses (or keep static paths plus a second runtime location).
   - Pros: may preserve some static behavior and reduce initial path changes.
   - Cons: two storage semantics, ambiguous precedence, continued dependence on Next’s boot index, harder volume/restart reasoning, and more branches to test; does not provide a clean single source of truth.
   - Effort: High.

3. **Infrastructure static server (nginx/Caddy/etc.)** — place a separate server in front of runtime directories while the app writes them.
   - Pros: mature static-file serving and potentially richer caching controls.
   - Cons: adds infrastructure/configuration/TLS/proxy coupling explicitly out of scope; requires path and deployment coordination; does not use the requested native Next.js solution.
   - Effort: High.

### Recommendation
Choose approach 1. Keep the storage adapter as the single writer, move only the runtime roots to `/app/data`, and add two very thin `runtime = "nodejs"`, `dynamic = "force-dynamic"` catch-all handlers. Next.js Route Handlers are not cached by default, dynamic catch-all params are awaited, and Node stream APIs provide the required Web stream response boundary. The shared resolver should enforce: one root per route, generated filename/segment grammar, per-root extension allowlists (`.webp/.jpg/.png` for uploads/design and `.pdf` for documents), URL decoding rejection for unsafe segments, resolved containment, no symlink traversal (including the root), one open operation, 404 for absent/disallowed files, 503 for operational errors, and deterministic handle cleanup on normal completion, cancellation, and failure. Do not add Range, ETag, platform fallbacks, orphan cleanup, import, notifications, or sharp changes.

The implementation should be split into chained work units under the 400 changed-line budget: (1) storage-root/config and Docker/Compose remount, (2) minimal shared resolver plus uploads handler and tests, (3) documents handler plus tests, (4) deploy/health and standalone restart verification. Keep each behavior’s tests with its code. Because current volumes already contain `/app/public/uploads` and `/app/public/documents`, changing only the mount targets to `/app/data/uploads` and `/app/data/documents` preserves named-volume contents and public/database paths; validate the existing volume contents before traffic and fail closed if required roots are missing or unreadable.

### Risks
- Existing deployments may have files in the container writable layer rather than the named volumes; remounting would hide them. Deployment must stop traffic, inspect/backup the old paths, copy only when necessary into the preserved named volumes, verify count/bytes/checksums, then start the new container. No database URL rewrite is required.
- A root symlink or a symlinked descendant can escape naïve lexical containment; use component-safe resolution/open behavior and reject symlinks before serving.
- Opening a file and transferring it to a stream can leak descriptors on cancellation or stream-construction errors; ownership and close lifecycle must be tested, including zero-byte files and repeated failures.
- Route handlers can accidentally become static or be shadowed by `public`; force Node/dynamic behavior and verify a file created after boot is immediately fetchable.
- Docker UID/volume ownership and health probes can differ between local and VPS environments; image mountpoint preparation and deploy-time write/read probes must be tested as the `nextjs` user.
- The 400-line budget and forced chained delivery are hard constraints; avoid speculative HTTP features and keep the shared helper narrow.

### Ready for Proposal
Yes. The proposal should commit to native Next.js Route Handlers, outside-public runtime roots, same named-volume identities, no data migration, and a four-slice chained delivery plan. It should explicitly define the remount/rollback runbook: keep the old volume names and URLs, restore the previous image/compose mount targets if rollback is needed, and never delete or reset existing volumes during rollback.
