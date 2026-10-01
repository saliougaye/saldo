# syntax=docker/dockerfile:1
# Built from the repository root: the standalone output needs the workspace packages.
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2 prune web --docker

FROM base AS builder
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm --filter web build
# The standalone output only traces what the routes import, and pnpm's nested layout makes a plain
# `require('pg')` unresolvable from the image root, so the migrator ships as a self-contained
# bundle instead.
RUN pnpm --filter web build:migrate

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -S saldo && adduser -S saldo -G saldo
COPY --from=builder --chown=saldo:saldo /app/apps/web/.next/standalone ./
COPY --from=builder --chown=saldo:saldo /app/apps/web/.next/static ./apps/web/.next/static
# Standalone does not copy `public/`: the PWA icons (and the mascot) are served from it.
COPY --from=builder --chown=saldo:saldo /app/apps/web/public ./apps/web/public
# Migrations run from the entrypoint, so the SQL and drizzle's journal must ship too.
COPY --from=builder --chown=saldo:saldo /app/apps/web/drizzle ./apps/web/drizzle
COPY --from=builder --chown=saldo:saldo /app/apps/web/migrate.cjs ./apps/web/migrate.cjs
COPY --chown=saldo:saldo apps/web/docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && mkdir -p /data/attachments && chown saldo:saldo /data/attachments
USER saldo
ENV PORT=3000 HOSTNAME=0.0.0.0
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
