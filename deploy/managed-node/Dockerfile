# syntax=docker/dockerfile:1.7
# Build from the repository root. No deployment or database migration runs here.
FROM node:24.21.0-trixie-slim AS source
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

# Every shipped image starts here. The upstream Node image trails Debian security
# releases, so install the fixes already published rather than ship them unpatched.
FROM node:24.21.0-trixie-slim AS runtime-base
RUN --mount=type=cache,id=atlas-apt-cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,id=atlas-apt-lists,target=/var/lib/apt/lists,sharing=locked \
    apt-get update && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

FROM runtime-base AS dependencies
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV HUSKY=0
RUN corepack enable && corepack prepare pnpm@11.28.2 --activate
COPY --from=manifests /manifests/ ./
# The metadata cache stays out of the image layers, like the store.
RUN --mount=type=cache,id=atlas-pnpm-store-v11,target=/pnpm/store \
    --mount=type=cache,id=atlas-pnpm-metadata-v11,target=/root/.cache/pnpm \
    pnpm install --frozen-lockfile --store-dir=/pnpm/store
# pnpm lifecycle policy must not decide whether the runtime client exists.
# This schema-only generation needs no database connection or environment file.
RUN pnpm exec prisma generate --config backend/prisma.generate.config.ts

FROM dependencies AS api-build
COPY --from=source /source/ ./
# dotenv-format build settings are supplied as a BuildKit secret, never COPYed.
RUN --mount=type=secret,id=api_build_env,required=true \
    pnpm exec dotenv -e /run/secrets/api_build_env -- pnpm --filter @atlas/api-app build

# The worker ships as a bundle (build-worker.mjs), not as the monorepo run
# through tsx: no source, no other workspace's dependencies, no dev tools.
FROM dependencies AS worker-build
COPY --from=source /source/ ./
RUN node deploy/managed-node/build-worker.mjs /worker

# playwright-core is the one package the bundle loads at runtime: it starts
# Chromium from files beside its own code. The locked version, from installed
# dependencies rather than source, so source edits keep the browser layer.
FROM dependencies AS worker-playwright
RUN mkdir -p /out/node_modules \
    && cp -RL "$(node -p "require('path').dirname(require.resolve('playwright-core/package.json', { paths: ['backend/apps/api'] }))")" \
       /out/node_modules/playwright-core

FROM runtime-base AS worker-browser
WORKDIR /app
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY --from=worker-playwright /out/node_modules ./node_modules
# The browser matching that playwright-core, with its system libraries, for certificate PDFs.
RUN --mount=type=cache,id=atlas-apt-cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,id=atlas-apt-lists,target=/var/lib/apt/lists,sharing=locked \
    node node_modules/playwright-core/cli.js install --with-deps chromium \
    && chmod -R a+rX /ms-playwright

FROM worker-browser AS worker
COPY --from=worker-build /worker/ ./
ENV NODE_ENV=production
ENV ATLAS_SERVICE_RUNTIME=managed-node
# Runtime starts node directly; package managers and root's build caches are build-time only.
RUN rm -rf /root/.cache /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-* \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
       /usr/local/bin/pnpm /usr/local/bin/pnpx /usr/local/bin/yarn /usr/local/bin/yarnpkg
USER node
# As the runtime user, offline: the whole processor graph imports, and the paths
# a bundle or a missing library breaks lazily run (SVG sanitizing, report
# workbooks, a certificate PDF through Chromium).
RUN --network=none APP_ENV=test NODE_ENV=test node check-worker-imports.mjs \
    && APP_ENV=test NODE_ENV=test node check-worker-runtime.mjs
EXPOSE 8081
STOPSIGNAL SIGTERM
CMD ["node", "worker.mjs"]

FROM runtime-base AS api
WORKDIR /app
ENV NODE_ENV=production
ENV ATLAS_SERVICE_RUNTIME=managed-node
ENV HOSTNAME=0.0.0.0
ENV PORT=3001
# Idle connections stay open longer than the 60 s idle timeout most proxies and
# load balancers use, so the proxy always closes first. With Node's 5 s default
# the server can close a connection just as the proxy reuses it: a 502 that
# neither side logs (managed-node-runtime.md).
ENV KEEP_ALIVE_TIMEOUT=65000
# Runtime starts node directly; package managers are build-time only.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-* \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
       /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY --from=api-build --chown=node:node /app/backend/apps/api/.next/standalone ./
COPY --from=api-build --chown=node:node /app/backend/apps/api/.next/static ./backend/apps/api/.next/static
USER node
EXPOSE 3001
STOPSIGNAL SIGTERM
CMD ["node", "backend/apps/api/server.js"]
