# syntax=docker/dockerfile:1.7
# Build from the repository root. No deployment or database migration runs here.
FROM node:24.21.0-bookworm-slim AS source
WORKDIR /source
COPY . .

# Materialize only dependency manifests and the schema needed by postinstall.
# COPY of this stable output keeps source-only edits out of dependency layers.
FROM source AS manifests
RUN mkdir -p /manifests/backend/prisma \
    && cp package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc /manifests/ \
    && cp backend/prisma.generate.config.ts /manifests/backend/ \
    && cp backend/prisma/schema.prisma /manifests/backend/prisma/ \
    && find backend frontend -name package.json -exec cp --parents '{}' /manifests/ \;

FROM node:24.21.0-bookworm-slim AS dependencies
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV HUSKY=0
RUN corepack enable && corepack prepare pnpm@11.6.0 --activate
COPY --from=manifests /manifests/ ./
RUN --mount=type=cache,id=atlas-pnpm-store-v11,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir=/pnpm/store
# pnpm lifecycle policy must not decide whether the runtime client exists.
# This schema-only generation needs no database connection or environment file.
RUN pnpm exec prisma generate --config backend/prisma.generate.config.ts

FROM dependencies AS api-build
COPY --from=source /source/ ./
# dotenv-format build settings are supplied as a BuildKit secret, never COPYed.
RUN --mount=type=secret,id=api_build_env,required=true \
    pnpm exec dotenv -e /run/secrets/api_build_env -- pnpm --filter @atlas/api-app build

FROM dependencies AS worker-dependencies
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
# Install the browser matching the locked Playwright dependency for certificate PDFs.
RUN --mount=type=cache,id=atlas-apt-cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,id=atlas-apt-lists,target=/var/lib/apt/lists,sharing=locked \
    pnpm --filter @atlas/api-app exec playwright-core install --with-deps chromium \
    && chmod -R a+rX /ms-playwright

FROM worker-dependencies AS worker
COPY --from=source /source/ ./
ENV NODE_ENV=production
ENV ATLAS_SERVICE_RUNTIME=managed-node
ENV TSX_TSCONFIG_PATH=/app/backend/apps/api/tsconfig.json
USER node
RUN --network=none APP_ENV=test NODE_ENV=test node --import tsx deploy/managed-node/check-worker-imports.ts
EXPOSE 8081
STOPSIGNAL SIGTERM
CMD ["node", "--import", "tsx", "backend/apps/api/src/worker/index.ts"]

FROM node:24.21.0-bookworm-slim AS api
WORKDIR /app
ENV NODE_ENV=production
ENV ATLAS_SERVICE_RUNTIME=managed-node
ENV HOSTNAME=0.0.0.0
ENV PORT=3001
COPY --from=api-build --chown=node:node /app/backend/apps/api/.next/standalone ./
COPY --from=api-build --chown=node:node /app/backend/apps/api/.next/static ./backend/apps/api/.next/static
USER node
EXPOSE 3001
STOPSIGNAL SIGTERM
CMD ["node", "backend/apps/api/server.js"]
