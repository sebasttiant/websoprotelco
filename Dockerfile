FROM node:24.18.0-trixie-slim AS base

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
USER node
CMD ["pnpm", "db:migrate"]

# Seed creates the default admin and staff accounts. It refuses to run when
# NODE_ENV=production, so the deploy script must not set that variable on this target.
FROM builder AS seed
USER node
CMD ["pnpm", "seed:users"]

FROM base AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=8686

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Both directories must exist in the image and be owned by the runtime user BEFORE a named
# volume is mounted over them. Docker copies the image's content and ownership into a new
# empty volume; if the path does not exist in the image, Docker creates the mountpoint owned
# by root instead and the app (uid 1001) cannot write to it. documents/ is not in the repo,
# so without this line adding documents-data to compose.yaml would silently break uploads.
RUN mkdir -p /app/public/uploads /app/public/documents \
  && chown nextjs:nodejs /app/public/uploads /app/public/documents

USER nextjs
EXPOSE 8686

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8686/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
