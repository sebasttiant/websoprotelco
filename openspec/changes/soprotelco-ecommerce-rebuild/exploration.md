## Exploration: soprotelco-ecommerce-rebuild

### Current State
The target repository `/home/sebastian/Documentos/DEV/SOPROTELCO/web/websoprotelco` is not an application yet. It contains `README.md`, `.gitignore`, `.atl/`, and `openspec/` bootstrap artifacts only; no `package.json`, application source, test runner, Dockerfile, or CI workflow exists in the target repo.

The legacy source at `/home/sebastian/Documentos/DEV/SOPROTELCO/web/web_completo/web` is a Next.js App Router ecommerce/catalog app with admin pages, Supabase auth/database/storage, RabbitMQ queue publishing, and Resend email sending. Its visual identity is concentrated in `src/app/globals.css`, page/component Tailwind classes, and `public/assets/img/sp-logo-white.png`. The current theme uses a dark/blue/cyan fiber-optic style with primary colors `#0F4C81`, `#1B6EAC`, `#06D3F9`, ink `#0A1728`, muted `#5E6C80`, and background `#F4F7FC`.

Legacy public routes include `/`, `/productos`, `/productos/[category]`, `/producto/[id]`, `/contacto`, `/cuenta`, `/privacidad`, and `/terminos`. Admin routes include `/admin`, `/admin/login`, `/admin/pedidos`, `/admin/leads`, `/admin/cotizaciones`, `/admin/productos`, `/admin/inventario`, `/admin/inventario/historial`, `/admin/categorias`, `/admin/diseno`, `/admin/documentos`, `/admin/usuarios`, `/admin/ajustes`, and `/admin/banners`.

The app is closer to quote/request ecommerce than direct payment ecommerce. Cart state is client-side localStorage; checkout creates an order request and optionally opens WhatsApp. There is no online payment provider detected. Admin manages products, categories, stock, stock movement history, leads, quotes, users, settings, banners/design, and technical documents.

Supabase is deeply coupled and must be replaced deliberately, not search-and-replaced. Dependencies include `@supabase/ssr`, `@supabase/supabase-js`, and deprecated `@supabase/auth-helpers-nextjs`; database access is spread across client components, server routes, middleware, and workers. Supabase storage backs product images, datasheets, and banners. Supabase Auth and RLS assumptions appear in `setup_auth.sql`, `fix_security_and_tables.sql`, and `src/middleware.ts`.

Legacy Docker exists but is app-only plus nginx; it does not define PostgreSQL or RabbitMQ services. CI/CD is absent in both legacy and target repositories. Tests are absent: no test files, no test scripts, and `openspec/config.yaml` currently records strict TDD as false until a runner is introduced.

Security-sensitive findings: `.env`, `.env.local`, and hard-coded queue credentials exist in legacy source. Values were not copied into this artifact. Rebuild should treat exposed credentials as compromised and rotate them before real deployment.

### Affected Areas
- `openspec/config.yaml` — already records hybrid SDD mode, Docker-first delivery, PostgreSQL target, Supabase replacement, forced chained PR strategy, and missing test runner.
- `legacy package.json` — current runtime/dependency baseline: Next.js 16.1.6, React 19.2.3, Tailwind 4, TypeScript 5, npm, Supabase packages, RabbitMQ, Resend; target has no package yet.
- `legacy src/app/**` — public storefront, account area, admin pages, and route handlers to rebuild or selectively migrate.
- `legacy src/components/**` — brand/header/footer/hero/product/cart/admin UI components and the current visual language.
- `legacy src/app/globals.css` — main theme tokens and global styling to preserve as a design-system input.
- `legacy public/assets/img/sp-logo-white.png` — only detected non-default brand image asset under `public/`.
- `legacy src/lib/supabase.ts` — browser Supabase client used by many components; replacement needs a server-first data/auth boundary.
- `legacy src/middleware.ts` — Supabase session checks and admin RBAC; contains a hard-coded email bypass that must not be carried forward.
- `legacy src/app/api/orders/route.ts` and `src/app/api/leads/route.ts` — order/lead creation, order item persistence, and RabbitMQ publishing.
- `legacy src/app/api/admin/usuarios/**` — Supabase Auth admin operations; replacement needs first-party auth/user administration semantics.
- `legacy src/app/api/admin/quotes/send/route.ts` and `src/worker/notifications.ts` — quote/order notification flow through RabbitMQ, Supabase Edge Function, and Resend.
- `legacy *.sql` — partial/conflicting schema history for categories/products/orders/items/quotes/resources/users/settings/banners/stock movements/leads; useful for domain discovery but not clean enough to become the target schema directly.
- `legacy Dockerfile`, `docker-compose.yml`, `nginx/conf.d/default.conf`, `.dockerignore`, `deploy.sh` — deployment evidence; Docker hardening exists partially, but legacy deploy script is host/PM2/scp based and should be replaced.
- `target .github/` and `legacy .github/` — no CI workflows found.

### Approaches
1. **Clean rebuild with selective visual/domain migration** — Create a new Docker-first Next.js app in the target repo, preserve brand assets/theme and rebuild domain flows over PostgreSQL, explicit auth, typed repositories, and tests.
   - Pros: safest way to remove Supabase cleanly; avoids carrying inconsistent schemas, client-side DB writes, hard-coded admin bypasses, and legacy deployment drift; supports TDD from the first implementation slice.
   - Cons: requires more upfront design/spec work; data migration/import needs a separate plan; visual parity must be verified intentionally.
   - Effort: High

2. **Incremental migration of legacy code into target** — Copy the legacy app, then replace Supabase pieces with PostgreSQL/auth/storage adapters over several chained PRs.
   - Pros: faster visual parity; preserves current routes/components with less initial UI rebuilding.
   - Cons: high risk of dragging Supabase coupling, unsafe route patterns, missing tests, inconsistent schemas, old environment assumptions, and leaked secret patterns into the new repo.
   - Effort: High

3. **Backend-first extraction, UI later** — Design PostgreSQL schema, auth, storage, and APIs first; then wire the existing storefront/admin UI to the new backend.
   - Pros: reduces data/auth risk early; creates stable contracts for TDD; isolates the hardest Supabase replacement decisions.
   - Cons: visual/user-facing progress appears slower; requires temporary fixtures/mocks for UI work.
   - Effort: Medium-High

### Recommendation
Use **Approach 1: clean rebuild with selective visual/domain migration**, delivered through forced chained PRs under the 400 changed-line review budget. The target repo is currently empty enough that carrying legacy code wholesale would import more risk than value. Preserve the visual identity by extracting theme tokens, layout feel, copy intent, and assets from legacy files, but rebuild application boundaries around server-first Next.js, PostgreSQL, secure auth/RBAC, explicit storage, and tests.

Recommended proposal boundaries:
- Bootstrap modern Next.js/React/TypeScript/Tailwind project with Docker Compose services for app, PostgreSQL, and optional worker/queue.
- Add TDD foundation before application implementation: unit/component tests, integration tests against PostgreSQL, and later Playwright smoke flows.
- Model ecommerce as quote/order-request commerce first, unless the user explicitly requires online payments.
- Replace Supabase Auth with a first-party auth stack suitable for Next.js and PostgreSQL, with role-based admin authorization and no hard-coded bypasses.
- Replace Supabase Storage with local/S3-compatible object storage strategy; keep public assets and uploaded documents/images behind explicit policies.
- Keep RabbitMQ only if asynchronous notifications remain justified; otherwise consider a simpler transactional outbox/background job approach for the first release.

### Risks
- Legacy `.env` files and hard-coded queue credentials indicate credential exposure; deployment credentials should be rotated and not copied.
- Supabase coupling spans auth, storage, client-side queries, server-side service-role queries, edge functions, RLS, and generated URL assumptions.
- SQL schema files are inconsistent across Spanish and English table names (`productos/pedidos` vs `products/orders`), UUID vs text product IDs, and multiple migration patches.
- Current app performs many admin/data writes from client components through Supabase; rebuild should move privileged writes to server actions/route handlers with validation and authorization.
- No test runner exists yet, so implementation should not start until a test strategy is accepted and bootstrapped.
- Visual identity preservation depends on careful extraction from CSS/components because most styling is inline Tailwind plus global CSS rather than a formal design system.
- CI/CD and Docker deployment must be created from scratch in the target repo; legacy `deploy.sh` uses root SSH/scp/PM2 and should not define the new delivery model.
- The rebuild will exceed 400 changed lines; forced chained PRs are necessary.

### Ready for Proposal
Yes — proposal can proceed. The orchestrator should tell the user that the safest path is a clean, Docker-first rebuild that preserves visual identity and domain behavior while replacing Supabase with PostgreSQL, first-party auth/storage boundaries, CI/CD, and a TDD foundation before feature implementation.
