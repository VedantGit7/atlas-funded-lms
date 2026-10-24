# Managed Node API and worker runtime (F22)

The existing Vercel web service forwards API traffic to a separate managed Node API. A continuously running managed Node worker owns SCORM extraction, certificate PDFs, reports, privacy exports and durable usage aggregation. API and worker startup require `ATLAS_SERVICE_RUNTIME=managed-node`; detected Vercel Functions, Lambda, Netlify Functions, Azure Functions, Google function and Next edge environments are rejected. This declaration is an operator contract, not automatic verification of an unknown hosting platform.

No API/worker host has been selected or provisioned. The repository includes provider-neutral Docker targets and a Compose service definition in `deploy/managed-node`. A selected host must support persistent processes, outbound PostgreSQL/R2/Redis/SMTP/monitoring connections, private health probes, ephemeral writable `/tmp`, graceful termination and automatic restart. Scale-to-zero/request-only workers are unsupported.

## Build and launch

For local development, `pnpm dev` starts the web, API and outbox worker together and stops the group when a member exits. If starting web/API separately, also run `pnpm worker:outbox`; package readiness and usage rollups depend on it. Do not run a second worker on the same health port. These local commands load development settings and are not production startup commands.

Run from the repository root with Docker BuildKit. Installations use Node 24 and the frozen pnpm lockfile; browser installation matches the locked Playwright dependency. Use an immutable source SHA in the image tags. Apply the separately reviewed migrations/grants before runtime startup; no image build runs migrations.

Dependency layers contain only workspace manifests, the frozen lockfile, installation policy and Prisma generation inputs. Application source is copied afterward. Chromium is installed in its own stage from the locked `playwright-core` alone, so source and other dependency edits reuse the browser layer. BuildKit also caches the pnpm store and APT downloads; schema or dependency changes correctly invalidate the affected layers.

```sh
docker build -f deploy/managed-node/Dockerfile --target worker -t atlas-worker:SOURCE_SHA .
docker build -f deploy/managed-node/Dockerfile --target api --secret id=api_build_env,src=/secure/api-build.env -t atlas-api:SOURCE_SHA .
docker build -f deploy/managed-node/Dockerfile --target web --secret id=web_build_env,src=/secure/web-build.env -t atlas-web:SOURCE_SHA .
```

CI builds all three targets and fails on fixable HIGH/CRITICAL vulnerabilities; the runtime images apply Debian security updates and carry no package managers (see `container-scanning.md`). The API build secret is a dotenv-format file with the target environment's non-secret settings (see "Publishing" below). It isn't the full runtime configuration: credentials are never fixed into a build. Do not check it into the repository. The web build secret has the same format. Next fixes `API_INTERNAL_URL` (the `/api/v1` rewrite) and every `NEXT_PUBLIC_*` value into the web build, so the web image is built once per environment and a production image can't serve staging. The web image runs the standalone server at `frontend/apps/web/server.js` on port 3000, with its `.next/static` and `public` files copied beside it (`standalone-build-output.md`). Unlike the API and worker, the web service doesn't require `ATLAS_SERVICE_RUNTIME`. Next embeds intentionally public build settings; never use public variable names for secrets. Runtime settings come from the host secret manager. The Docker build context excludes env files, local storage, generated clients, private key/backup files and development outputs. An explicit schema-only Prisma generation step runs after installation; the image does not rely on lifecycle scripts to create the client. The worker image ships a bundle of the worker (`deploy/managed-node/build-worker.mjs`), not the source tree: no source, no other workspace dependencies and no dev tools, only `playwright-core` beside it for Chromium. Its build then checks, as the unprivileged runtime user with networking disabled, that the complete processor graph, generated client and usage drain import, and runs the paths a bundle can break lazily: SVG sanitizing, a report workbook and a certificate PDF through Chromium.

Export `ATLAS_API_IMAGE`, `ATLAS_WORKER_IMAGE`, `ATLAS_API_ENV_FILE`, and `ATLAS_WORKER_ENV_FILE`, then review `docker compose -f deploy/managed-node/compose.yaml config --quiet` before `up -d`. The API binds only loopback port 3001 in this reference deployment; connect it to an authenticated TLS ingress or private managed-service origin. Do not expose worker port 8081 publicly. The Coolify deployment runs all three services from `deploy/coolify/compose.yaml` instead (`coolify-deployment.md`); this file stays the generic reference.

The API and web images set `KEEP_ALIVE_TIMEOUT=100000`: idle connections stay open 100 s.

- **The proxy must close first.** The ingress's upstream idle timeout must be shorter than this, so it always closes an idle connection first. If the server closes first, a request the ingress sends on that connection at the same moment fails as a 502 that neither side logs.
- **Why 100 s:** Traefik, the Coolify proxy, keeps idle upstream connections 90 s by default (`serversTransport.forwardingTimeouts.idleConnTimeout`). The earlier 65 s value was shorter than that.
- **Node's 60 s `headersTimeout` doesn't cut it short.** A connection left idle for 75 s and then reused still works; this was measured against the web image.
- **If you change the proxy:** if one keeps idle upstream connections longer than 100 s, raise this above it.

The worker image starts Node directly on the bundle (`node worker.mjs`), preserving SIGTERM delivery. Both services run as an unprivileged user. The reference limits are 2 CPUs/2 GiB per service, 256 MiB `/tmp` and 256 MiB worker shared memory; validate measured workload headroom before changing replica counts. Compose restarts exited processes, but an unhealthy Docker health check by itself does **not** restart a container, and neither does Coolify.

**`/app/healthcheck.mjs` restarts it** (`deploy/managed-node/healthcheck.mjs`). It ships in all three images and is the health check in both compose files.

- **How it decides:** it counts consecutive failed probes in `/tmp`, which starts empty after every restart. After 3 in a row, once the container has run for `--grace` seconds (its `start_period`), it sends SIGTERM to PID 1, and the restart policy starts the container again.
- **No extra access:** it needs no Docker socket.
- **A misconfigured container** therefore restarts repeatedly instead of quietly answering 500; with the compose timings, about every 90 s.

Readiness against `/readyz` remains the managed host's concern.

### Publishing

`.github/workflows/images.yml` ("Publish images") publishes the deployable images to the GitHub Container Registry.

- **Trigger:** it runs when CI succeeds for a push to this repository's `main`, or manually on `main`. A pull request never publishes, including one from a fork whose branch is named `main`.
- **Gate:** it builds each image, applies the same Trivy gate as `container-scan`, and only then pushes.
- **Tags:** immutable and end with the commit SHA, the same value as `RELEASE_SHA`:

| Image  | Tag                                                | Built                                             |
| ------ | -------------------------------------------------- | ------------------------------------------------- |
| Worker | `ghcr.io/vedantgit7/atlas-worker:<sha>`            | Once per commit. The bundle fixes no settings in. |
| API    | `ghcr.io/vedantgit7/atlas-api:<environment>-<sha>` | Once per environment                              |
| Web    | `ghcr.io/vedantgit7/atlas-web:<environment>-<sha>` | Once per environment                              |

**Why the API is built per environment:** Next fixes every `NEXT_PUBLIC_*` value into the **API** build too, not only the web's. The shared auth and observability packages read `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SENTRY_DSN`. A built API contains those values as literal text, so an API image built for staging keeps staging's values in production. The same holds for the web build, which also fixes `API_INTERNAL_URL`.

**Build settings:**

- Each GitHub environment (`staging`, `production`) holds two dotenv-format secrets, `API_BUILD_ENV` and `WEB_BUILD_ENV`.
- The workflow passes them to the builds as the `api_build_env` and `web_build_env` BuildKit secrets.
- An environment without them is skipped with a notice, not failed.
- They contain the environment's **non-secret** settings only:
  - `APP_ENV`, `PLATFORM_HOST`, `APP_URL` and `API_INTERNAL_URL`;
  - every `NEXT_PUBLIC_*` value;
  - and, optionally, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` for source-map upload.
- **Leave credentials out:** database URLs, SMTP, R2, `API_PROXY_SECRET`, `CRON_SECRET` and the like. A build never fixes them in (CI compiles both apps with empty settings), so they belong only in the runtime settings.
- **Rebuild after changing a fixed value.** A changed `NEXT_PUBLIC_*` value or `API_INTERNAL_URL` needs a rebuild; setting it at runtime alone changes nothing.

**Pulling:**

- Packages published by the workflow are linked to the repository. Check each package's visibility after its first publish, and keep it private.
- A host pulls with a personal access token (classic) that has only `read:packages`.

## Work and recovery contract

- Sweeps execute processors serially. General processor batches default to 25 and are capped at 100; SCORM, certificate, report and privacy-export processors claim at most one job per tenant per pass. They use the existing database delivery leases and retry policy. Concurrency scales with the explicitly configured worker replica count.
- Usage drains process at most the configured batch limit for each tenant per sweep, including inactive/deleted tenants. Committed usage survives process termination. A full batch triggers another sweep without the idle wait; failures remain durable for subsequent attempts.
- Production PDF and report creation paths publish durable events and leave execution to the worker. Request completion and `after()` callbacks are not durability boundaries. Development retains the optional callback convenience and returns its Promise to Next.
- Privacy exports page 100 records and spool to private ephemeral disk, capped at 100,000 rows, 64 MiB and 120 seconds of generation. Artifacts remain in object storage. The F15 protection intentionally holds ambiguous `RUNNING` uploads for reconciliation after a lost process; never blindly replay a remote side effect whose outcome is unknown. SCORM limits and upload evidence are recorded with the F22 remediation report.
- SIGTERM stops starting new processor/maintenance units, allows the current unit to finish, then exits. The worker's default shutdown deadline is 30 seconds; host grace must exceed it (Compose: 45 seconds). Forced termination leaves durable claims/outcomes for the next instance. Provider side effects without deduplication can require reconciliation; restart safety does not promise exactly-once external delivery.

## Required host acceptance evidence

Run deployment preflight for API/worker, verify `/healthz` advances and `/readyz` becomes unavailable during shutdown, and record release SHA/process IDs. Create disposable queued usage and an idempotent outbox job, terminate the process between claim and completion, restart, and verify committed usage is counted once and the expired claim is safely recovered. Also test an uncertain remote export/upload outcome reaches reconciliation rather than unsafe duplication. Perform the greater-than-4.5-MiB direct object-store upload test from the actual web origin and read the processed result from a fresh instance. Local unit/database tests and rendered Compose configuration do not establish successful host deployment, live provider CORS, browser installation or production restart behavior.
