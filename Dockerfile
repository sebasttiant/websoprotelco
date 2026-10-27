FROM node:24.22.1-trixie-slim AS base

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS deps
RUN corepack enable pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
RUN corepack enable pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Migrations run as a deploy step, not inside the web runtime. They need the TypeScript
# sources, tsx, and the full dependency tree — zod in particular, which Next bundles into
# its server chunks and therefore never ships in the standalone runner's node_modules.
FROM builder AS migrator
# builder copied node_modules as root; pnpm 12 verifyDepsBeforeRun tries to rewrite
# sharp and fails with EACCES under USER node. Own the tree, skip the rewrite.
RUN chown -R node:node /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV CI=1
USER node
CMD ["pnpm", "db:migrate"]

# Seed creates the default admin and staff accounts. It refuses to run when
# NODE_ENV=production, so the deploy script must not set that variable on this target.
FROM builder AS seed
RUN chown -R node:node /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV CI=1
USER node
CMD ["pnpm", "seed:users"]

# sharp is a native module: a JS wrapper, a platform .node binding, and a separate libvips
# shared library. Under pnpm those are wired together with symlinks, and Next's standalone
# tracing copies the files but not that linkage — so libvips fails to dlopen at runtime ("cannot
# open libvips-cpp.so"), a failure no build-time check sees, only an actual image upload.
#
# This stage installs sharp with npm into a clean, FLAT node_modules where the binding and its
# libvips sit as plain siblings, then the runner copies that over the broken traced copy.
# Running npm directly against the pnpm-structured standalone node_modules crashes npm's
# resolver, which is why this is isolated here. Pinned to the package.json version.
FROM base AS sharp-runtime
WORKDIR /sharp
RUN npm init -y >/dev/null 2>&1 \
  && npm_config_update_notifier=false npm install --os=linux --cpu=x64 sharp@0.35.5

FROM base AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=8686

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# The traced `node_modules/sharp` is a pnpm symlink into `.pnpm`, so copying onto it would only
# overwrite the still-broken target. Remove the symlink and the traced pnpm sharp/@img trees
# first, then drop in the clean wrapper.
#
# sharp's own runtime deps (detect-libc, semver, the @img native packages) are NESTED under
# sharp's own node_modules rather than placed at the top level, so node resolves them locally to
# sharp and nothing the rest of the app depends on — semver in particular — is overwritten.
RUN rm -rf /app/node_modules/sharp /app/node_modules/@img \
      /app/node_modules/.pnpm/sharp@* /app/node_modules/.pnpm/@img+*
COPY --from=sharp-runtime --chown=nextjs:nodejs /sharp/node_modules/sharp /app/node_modules/sharp
COPY --from=sharp-runtime --chown=nextjs:nodejs /sharp/node_modules/detect-libc /app/node_modules/sharp/node_modules/detect-libc
COPY --from=sharp-runtime --chown=nextjs:nodejs /sharp/node_modules/semver /app/node_modules/sharp/node_modules/semver
COPY --from=sharp-runtime --chown=nextjs:nodejs /sharp/node_modules/@img /app/node_modules/sharp/node_modules/@img

# Turbopack (Next 16's default builder) does not emit `import("sharp")` for a package listed in
# serverExternalPackages. It emits a build-derived hashed alias — `sharp-<hash>` — and resolves it
# through a symlink it writes into `.next/node_modules/` that points at the pnpm store. The `rm`
# above deletes that symlink's target, so the alias dangles and EVERY storage operation fails at
# runtime with ERR_MODULE_NOT_FOUND (the whole `storage/local` module fails to import, not just
# image optimization). Repoint the alias at the clean copy installed above.
#
# The hash is derived at build time, so it is matched by glob rather than hardcoded. If a future
# Turbopack version stops emitting the alias the loop is a no-op, and the deploy-time
# `/api/health?check=storage` probe remains the gate that catches a broken storage runtime.
RUN set -eu; \
  for alias in /app/.next/node_modules/sharp-*; do \
    [ -L "$alias" ] || [ -e "$alias" ] || continue; \
    rm -rf "$alias"; \
    ln -s /app/node_modules/sharp "$alias"; \
    chown -h nextjs:nodejs "$alias"; \
  done

# Both directories must exist in the image and be owned by the runtime user BEFORE a named
# volume is mounted over them. Docker copies the image's content and ownership into a new
# empty volume; if the path does not exist in the image, Docker creates the mountpoint owned
# by root instead and the app (uid 1001) cannot write to it. documents/ is not in the repo,
# so without this line adding documents-data to compose.yaml would silently break uploads.
RUN mkdir -p /app/data/uploads /app/data/documents \
  && chown nextjs:nodejs /app/data/uploads /app/data/documents

USER nextjs
EXPOSE 8686

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8686/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
