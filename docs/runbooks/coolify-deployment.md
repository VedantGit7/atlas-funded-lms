# Coolify deployment

`deploy/coolify/compose.yaml` runs the web, API and worker services as one Coolify **Docker Compose** resource, one per environment (staging, production). The decision behind it is `docs/engineering/hosting-decision-2026-10-23.md`, and the work order is `docs/engineering/launch-plan-2026-10-23.md`. `tests/unit/api/coolify-compose.test.ts` checks the file against the deployment contract.

## How the file works

- **Images, not builds.** Every service pulls an image published by the "Publish images" workflow (`managed-node-runtime.md`, "Publishing"):
  - `APP_ENV` picks the per-environment API and web images;
  - `RELEASE_SHA` picks the commit;
  - the same `RELEASE_SHA` reaches each container, so the health response reports the deployed commit.
- **Settings are listed per service.**
  - **Only listed settings get through:** Coolify passes a setting to a container only when that service lists it as `${NAME}`, and each listed setting appears as an editable variable in Coolify.
  - **Least privilege:** each service lists what its startup validation requires plus what it uses. The worker gets no `API_PROXY_SECRET`, only the API gets `SCORM_CONTENT_SIGNING_KEYS`, and no migration or owner login reaches any container.
  - **No empty values:** every reference is either required (`${NAME:?}`, so Coolify refuses to deploy without it) or has a default (`${NAME:-value}`). Coolify passes an unset `${NAME}` as an empty string, and some settings' parsers reject an empty string.
  - **Fixed values are literal:** `STORAGE_PROVIDER=r2`, `NOTIFICATION_EMAIL_PROVIDER=smtp`, `CSP_ENFORCE=1`, the Cloudflare client-IP header, and `API_INTERNAL_URL`.
- **Private API address.** The web reaches the API at `http://api.atlas.internal:3001`, through a compose link alias on Coolify's own network.
  - **Why a `.internal` name:** the deployment contract allows plain HTTP only to a `.internal` name, which can never resolve publicly. A single-label name like `api` that fails to resolve inside Docker could be retried against public DNS, and the web would send `API_PROXY_SECRET` there.
  - **Why no extra network:** the file declares no networks and publishes no ports. Coolify's documentation warns that a second network makes Traefik route unreliably (requests hang or return 504).
  - **Baked into the web build:** the web image is built with the same `API_INTERNAL_URL`.
- **Hardening** matches `deploy/managed-node/compose.yaml`:
  - a read-only root filesystem with a 256 MiB `/tmp`;
  - `init`;
  - a 45 s graceful stop;
  - 2 CPUs and 2 GiB of memory per service;
  - `restart: unless-stopped`.

## Health checks

| Service | Probe                                                 | Why this path                                                                                                                                        |
| ------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| web     | `GET http://127.0.0.1:3000/brand/avatar-gradient.svg` | A public file that still passes through the web middleware. No API call. `/fonts/...` skips the middleware and returns 200 even when startup failed. |
| api     | `GET http://127.0.0.1:3001/api/v1/health`             | No database call. Reports the release and environment.                                                                                               |
| worker  | `GET http://127.0.0.1:8081/healthz`                   | Reports a recent outbox sweep (`managed-node-runtime.md`).                                                                                           |

**A misconfigured web or API container does not exit.** Next.js logs the failed startup hook (for example "REDIS_URL ... is required in production and staging"), keeps running, and answers every request with 500. Only the health check catches it.

**Unhealthy containers are not restarted yet.** Docker doesn't restart a container that only fails its health check, and Coolify's documentation doesn't say that it does. Adding the restart is launch-plan task 1.4.

## Setting up an environment

1. **Create the resource.** In Coolify, create a **Docker Compose** resource from this Git repository, with the compose file `deploy/coolify/compose.yaml`. No build happens: every service has an `image`.
2. **Registry access.** If the GHCR packages are private, add a `ghcr.io` credential that Coolify's server can pull with: a classic personal access token with only `read:packages`. Public packages need nothing.
3. **Fill in the variables Coolify lists.** Values that differ by environment:
   - `APP_ENV`: `staging` or `production`;
   - `APP_URL`;
   - `PLATFORM_HOST`;
   - `RELEASE_SHA`;
   - the database URLs;
   - the R2 bucket and its keys;
   - the SMTP agent;
   - every secret, generated independently per environment (`deployment-configuration.md`).

   `CERTIFICATE_OPEN_BADGE`, `SENTRY_TRACES_SAMPLE_RATE` and `SMTP_PORT` have defaults (`false`, `0.05`, `587`).

4. **Database TLS is mandatory.** The contract requires `sslmode=require` (or stricter) in `DATABASE_URL` and `PLATFORM_DATABASE_URL`, so turn on SSL for Coolify's PostgreSQL. Each URL uses its own restricted runtime login, never an owner role.
5. **Domains go on `web` only, container port 3000.** For example, staging gets `https://staging-academy.fundedbeyond.com:3000` and `https://staging-platform.fundedbeyond.com:3000`; the `:3000` tells Coolify's proxy the container port.
6. **Deploy, then check all three health checks** report healthy, and run `pnpm release:health` against the environment with the expected SHA (`release-health.md`).

## Deploying, rolling back and changing settings

- **Deploy a commit:** wait for "Publish images" to finish for it. Then set `RELEASE_SHA` to that commit's full 40-character SHA and redeploy. The API and web images exist only for environments whose build secrets are set.
- **Roll back:** set `RELEASE_SHA` back to the previous commit and redeploy. Database migrations are not undone (`rollback.md`).
- **Settings baked into the build** (every `NEXT_PUBLIC_*` value, and `API_INTERNAL_URL` for the web) live in the GitHub environment's build secrets. Changing one there needs a new publish; changing it in Coolify alone has no effect.
- **Add a new runtime setting:**
  1. add `NAME: ${NAME:?}`, or `${NAME:-default}`, to each service that reads it;
  2. run `pnpm exec vitest run tests/unit/api/coolify-compose.test.ts`;
  3. fill in the value in Coolify.
- **Open Badges** are off by default (`CERTIFICATE_OPEN_BADGE=false`). Turning them on also needs `CERTIFICATE_ISSUER_PRIVATE_KEY` (Ed25519), `CERTIFICATE_ISSUER_DID` and `CERTIFICATE_PUBLIC_BASE_URL` added to the API and worker.
