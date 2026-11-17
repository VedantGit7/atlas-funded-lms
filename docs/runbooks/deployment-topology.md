# Atlas deployment topology and rollout (F11)

This runbook describes how the LMS is deployed: what runs where, how requests cross the trust boundaries, and the order of a rollout. The operating steps (setting up an environment, deploying, rolling back, backups, the firewall, DNS) are in the [Coolify deployment runbook](coolify-deployment.md). Required variables and their validation are in the [F05 configuration contract](deployment-configuration.md), and the container images in the [managed Node runtime contract](managed-node-runtime.md).

The hosting was decided on 23 October 2026 (launch plan). Until November 2026 the web app was planned for Vercel and sign-in ran on Supabase Auth. Both are gone: everything below runs on one server managed by Coolify, and sign-in is Better Auth inside the API ([design](../engineering/better-auth-design.md)).

## What runs where

One Hostinger VPS (KVM 8, Mumbai: 8 vCPU, 31 GiB) runs every service. Coolify Cloud manages it over SSH. Each environment, `staging` and later `production`, is a separate Coolify environment with its own databases, secrets, buckets and hostnames.

| Service              | What it is                                                                                                                                                                                     | Where it runs                                                                                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Web                  | `frontend/apps/web` (Next.js standalone). Browser-facing pages and the same-origin `/api/v1` proxy to the API.                                                                                 | Container from `ghcr.io/vedantgit7/atlas-web:<environment>-<sha>`, three processes (`deploy/managed-node/server-cluster.mjs`), defined in `deploy/coolify/compose.yaml`.                               |
| API                  | `backend/apps/api` (Next.js standalone). Every `/api/v1` route, including sign-in (Better Auth).                                                                                               | Container from `ghcr.io/vedantgit7/atlas-api:<environment>-<sha>`, five processes. Reachable only on the Docker network, as `http://api.atlas.internal:3001`; never from the internet.                 |
| Outbox worker        | The long-running worker bundle: outbox delivery, SCORM extraction, certificate PDFs, reports, privacy exports, usage rollups and the scheduled per-tenant tasks below.                         | Container from `ghcr.io/vedantgit7/atlas-worker:<sha>`. Restarted by Coolify; its health port stays private.                                                                                           |
| PostgreSQL 16        | `backend/prisma` migrations, row-level security and grants. Separate restricted runtime logins for tenant, platform and Better Auth access; the owner login is used only by the migration job. | A Coolify database resource on the same server, 4 CPUs / 6 GB, settings from `deploy/coolify/postgresql-settings.sql`. TLS on, verified by every service. Backed up to R2 every 6 hours, 14 days kept. |
| Redis                | The shared rate-limit store. No in-memory fallback when deployed.                                                                                                                              | A Coolify Redis resource per environment.                                                                                                                                                              |
| Object storage       | Assets, reports, certificates, backups.                                                                                                                                                        | Cloudflare R2, separate buckets per environment (APAC location).                                                                                                                                       |
| Email and monitoring | Transactional email through ZeptoMail (SMTP); errors to Sentry; the worker's external heartbeat.                                                                                               | External services, with separate senders and environment labels per environment.                                                                                                                       |
| Sign-in              | Better Auth, inside the API: email and password, email links, Google, authenticator apps.                                                                                                      | Part of the API. Google OAuth uses one client per environment.                                                                                                                                         |
| Edge and DNS         | Cloudflare proxies every LMS hostname. A Cloudflare Origin CA certificate in Traefik (Coolify's proxy) covers the four LMS names.                                                              | Staging reaches the server through a Cloudflare Tunnel. At launch, `academy` and `platform` move to the tunnel too, and the web ports close ([TLS and DNS](coolify-deployment.md#tls-and-dns)).        |

## Request and trust boundaries

Browser → Cloudflare → tunnel → Traefik → web proxy/server fetch → API (`api.atlas.internal`) → session/membership/tenant authorization → database and providers.

The web proxy discards browser-supplied tenant context and stamps the original browser host and client IP. Client IP is resolved only from explicitly configured, edge-overwritten/appended metadata; the default is zero trusted hops. The Coolify deployment trusts `CF-Connecting-IP` (`TRUSTED_CLIENT_IP_HEADER`), which the tunnel passes through. Only requests to the API receive `x-atlas-proxy-key`, sourced from server-only `API_PROXY_SECRET`. The API removes this credential and raw forwarding-IP headers at ingress and retains forwarded host/IP/source context only after authentication. Never expose this secret as `NEXT_PUBLIC_*`, return it in a response, or log request headers wholesale. Direct API access cannot establish client-IP attribution with arbitrary forwarded headers. Every page the web renders must pass through its proxy, so the API can attribute it; the proxy skips only build assets and font files. See [F04 trust and admission behavior](rate-limiting.md#ip-trust-and-the-internal-request-boundary).

Use an independent random proxy secret of at least 32 characters for each environment, shared only by that environment's web and API. It must differ from cron and worker secrets. Coordinate rotation of both services; a temporary mismatch fails tenant forwarding and should be handled as a maintenance rollout. Local unsigned forwarding is allowed only outside deployed runtimes when no proxy secret is configured.

`PLATFORM_HOST` is the browser-facing platform hostname, without protocol/path. `API_INTERNAL_URL` is the API origin, not the web origin. It is fixed into the web build: Next.js produces the `/api/v1` rewrite during the build, so it lives in the GitHub environment's `WEB_BUILD_ENV`, and a runtime-only edit cannot change it ([Publishing](managed-node-runtime.md#publishing)). HTTPS is required unless the F05 contract explicitly permits loopback or private `.internal` transport, as `api.atlas.internal` is.

All direct internal fetches carrying the proxy credential reject redirects. Configure a canonical API origin that answers directly. Do not fix redirected calls by enabling redirect following.

## Environment separation

Use `APP_ENV=staging` for staging and `production` for production, each with its own release SHA. Keep the databases, logins, Redis, R2 buckets, provider keys, Google OAuth clients, callback allowlists and monitoring labels separate. Feature flags do not provide data isolation.

- **Runtime settings** for each environment live on the server as `/root/atlas/<env>/coolify.env` (mode 600) and are pasted into Coolify; they are never shown on screen ([Setting up an environment](coolify-deployment.md#setting-up-an-environment)).
- **Build settings** (the non-secret values Next.js fixes into a build) live in the GitHub environment's `API_BUILD_ENV` and `WEB_BUILD_ENV` secrets, so each environment gets its own API and web images.
- **Migration credentials** stay out of the web, API and worker settings; only the migration job has them.
- **Staging is public.** Its hostnames are reachable by anyone, like production, and use only test accounts and disposable data. Nothing sits in front of it; `release:health` needs no bypass. (It still accepts `VERCEL_AUTOMATION_BYPASS_SECRET`, from when web was planned for Vercel; leave it unset.)

## Build and deploy order

1. **Merge to `main`.** CI passes, then "Publish images" builds and scans the images and pushes them with the commit's SHA ([Publishing](managed-node-runtime.md#publishing)).
2. **Migrations first, when there are any.** Back up, then run the migration image against the environment ([Databases and migrations](coolify-deployment.md#databases-and-migrations)). No image or startup runs migrations by itself.
3. **Set `RELEASE_SHA`** in the environment's `coolify.env` to the full commit SHA, paste the file into Coolify's Developer view, save and redeploy. Coolify replaces the web, API and worker containers together.
4. **Check the release** with `release:health` on each host, and the containers' health, restarts and logs (below).

The first production deployment also needs the production environment created in Coolify, its DNS moved to the tunnel, and the acceptance checks below. That is launch plan task 5.6.

## Scheduled jobs

No job is registered with any external scheduler. The long-running outbox worker visits every active tenant on each sweep (about once a minute) and runs these per tenant, so a slow or failing tenant affects only itself (audit M5):

| Worker task            | What it does                                                                               | Log counter                   |
| ---------------------- | ------------------------------------------------------------------------------------------ | ----------------------------- |
| `report-schedule-tick` | Enqueues due scheduled reports; the `reports` processor runs them                          | `scheduledReportRunsEnqueued` |
| `certificate-expiry`   | Marks certificates past `expires_at` as expired, flips status bits                         | `certificatesExpired`         |
| `fx-rate-refresh`      | Refreshes a tenant's FX rates if not fetched today (UTC); one live fetch per sweep at most | `fxRatesRefreshed`            |

Several worker instances may run at once: due report schedules are claimed with `for update skip locked`, certificate expiry is idempotent, and an FX refresh is an upsert. Successful work appears in the worker log line `worker.sweep.completed`.

The three `CRON_SECRET` endpoints remain as operator tools for a manual run across all tenants: `/api/v1/internal/reports/tick`, `/api/v1/internal/certificates/expire` and `/api/v1/internal/fx/refresh`. Do not register them with a scheduler: the worker already runs the same work. They require `Authorization: Bearer <CRON_SECRET>`, compared in constant time; missing configuration fails closed with 503. Failures answer with a stable code and a request ID, and the detail is only in the server log (`cron.job_failed`). The former alias `/api/v1/reports/internal/tick` was removed.

Record at least one successful worker sweep per task in each environment with timestamp, environment, release and request ID.

## Acceptance evidence

Staging passed these on 7 November 2026 ([evidence](../engineering/staging-acceptance-2026-11.md)); production repeats them at launch.

- Run `pnpm release:health --base-url <candidate-https-origin> --expected-release <release>`, where the release is the deployed `RELEASE_VERSION`, or the first 12 characters of `RELEASE_SHA` (`release-health.md`). The expected release is mandatory, also available as `RELEASE_HEALTH_EXPECTED_RELEASE`; inherited callers such as restore validation need this variable too. Verify both probes identify the expected release and unique matching request IDs. This route is not a full dependency-readiness check.
- On an allowed staging tenant domain: anonymous page/login load, sign-in, protected API request, sign-out and denied anonymous request. After sign-out, the session must stop working at once on every request. Confirm tenant A cannot access tenant B by replacing IDs or headers.
- On the canonical platform host: a platform operator can read and mutate an approved test fixture after their authenticator code, a tenant admin is denied, and foreign Origin mutations are rejected. Test through the actual edge/web/API chain.
- Google sign-in returns to the right academy, sets the `__Secure-atlas_session` cookie with `HttpOnly`, `Secure` and `SameSite=Lax`, and asks an account with an authenticator for its code. Verify the cookie flags in the browser.
- Upload/download a disposable staging asset and verify it from a fresh service instance, then remove only that fixture.
- Worker `/healthz` reports a recent sweep; `/readyz` transitions during graceful shutdown. Observe a test outbox event processed and an external heartbeat. `/readyz` alone does not establish worker progress.
- Capture worker task executions, provider delivery and monitoring events. Attach evidence to the same release SHA, using the F09 evidence contract.

## Rollback

Set `RELEASE_SHA` back to the previous commit and redeploy: the web, API and worker go back together, so a change to the forwarding secret or routing contract rolls back consistently. Stop a rollout if health, tenant isolation or worker processing fails. If a DNS cutover fails, restore the address's previous record ([Rolling back an address](coolify-deployment.md#cloudflare-tunnel)). Database migrations are not undone, and persistent storage is never deleted automatically; use the reviewed migration recovery procedure (`rollback.md`) and preserve the outbox for replay. There is no production LMS deployment yet to roll back to.
