# Atlas deployment topology and rollout (F11)

This runbook specifies the deployment boundary for the current repository. The live inventory and unresolved prerequisites are in the [F11 remediation report](../engineering/f11-deployment-remediation.md). Required variables and validation rules are in the [F05 configuration contract](deployment-configuration.md).

F22 now requires managed Node services for both API and worker. See the [managed Node runtime contract and deployable container artifacts](managed-node-runtime.md). Configure `ATLAS_SERVICE_RUNTIME=managed-node`; known serverless API/worker environments fail startup. Hosting remains unprovisioned until the documented acceptance evidence is captured.

## Service ownership

| Service                | Deployable / entry point                                            | Hosting and dependencies                                                                                                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web                    | `frontend/apps/web`, workspace `@atlas/web`; Next.js build/start    | Existing Vercel project `atlas-funded-lms`; Root Directory `frontend/apps/web`, include outside-root files enabled. Browser-facing HTML and same-origin `/api/v1` proxy. Current web server code also consumes backend packages and requires the F05 shared infrastructure settings.        |
| API                    | `backend/apps/api`, workspace `@atlas/api-app`; Next.js build/start | Separate service with a stable explicit origin. Host not yet verified. Current start script listens on 3001; configure the host's service port accordingly. Requires a managed Node/container runtime and ATLAS_SERVICE_RUNTIME=managed-node; serverless API hosting is unsupported by F22. |
| Outbox worker          | Repository-root `pnpm worker:outbox:prod`                           | Long-running process with restart policy, graceful termination and outbound provider access. Host not yet verified. It is not a Vercel request handler or a replacement for cron scheduling. Requires runtime `tsx` and workspace dependencies.                                             |
| Application PostgreSQL | `backend/prisma` migrations and SQL grants                          | Deployed target unverified. Separate tenant and platform runtime logins, both restricted; privileged migration login available only to migration jobs. Apply repository SQL/RLS/grant checks as well as Prisma migrations.                                                                  |
| Supabase Auth          | Project `rolumnldqjelwfvtmmqf`, Mumbai                              | Identified and healthy; configure matching public/server keys and allowed callback origins. No public LMS tables were returned; do not infer that application migrations already exist here.                                                                                                |
| Redis                  | Shared rate-limit store                                             | Target unverified. Separate staging/production instance or properly isolated database/namespace; TLS and network policy required. No deployed memory fallback.                                                                                                                              |
| R2                     | Durable asset/report/certificate storage                            | Target/bucket unverified. Separate staging/production buckets and scoped credentials. Confirm CORS, signed expiry and restart persistence with a disposable test object.                                                                                                                    |
| Email and monitoring   | SMTP, Sentry, external worker heartbeat                             | Targets unverified. Use controlled test recipients and staging monitoring labels. Provider success and alert delivery must be tested.                                                                                                                                                       |
| Edge and DNS           | Cloudflare-facing academy hostname; Vercel domain assignment        | Academy currently redirects to an external landing URL. Determine the owning Cloudflare redirect/DNS rule before changing it. No verified zone configuration was available.                                                                                                                 |

## Request and trust boundaries

Browser → canonical tenant or platform web host → web proxy/server fetch → configured API origin → session/membership/tenant authorization → database and providers.

The web proxy discards browser-supplied tenant context and stamps the original browser host and client IP. Client IP is resolved only from explicitly configured, edge-overwritten/appended metadata; the default is zero trusted hops. Only requests to the API receive `x-atlas-proxy-key`, sourced from server-only `API_PROXY_SECRET`. The API removes this credential and raw forwarding-IP headers at ingress and retains forwarded host/IP/source context only after authentication. Never expose this secret as `NEXT_PUBLIC_*`, return it in a response, or log request headers wholesale. Direct API access cannot establish client-IP attribution with arbitrary forwarded headers. Web edge overwrite policy and origin restrictions remain required; see [F04 trust and admission behavior](rate-limiting.md#ip-trust-and-the-internal-request-boundary).

Use an independent random proxy secret of at least 32 characters for each environment, shared only by that environment's web and API. It must differ from cron and worker secrets. Coordinate rotation of both services; a temporary mismatch fails tenant forwarding and should be handled as a maintenance rollout. Local unsigned forwarding is allowed only outside deployed runtimes when no proxy secret is configured.

`PLATFORM_HOST` is the browser-facing platform hostname, without protocol/path. `API_INTERNAL_URL` is the API origin, not the web origin. Supply it at **build time and runtime**: Next.js rewrites are produced during the build. A runtime-only edit cannot repair a build that embedded the loopback fallback. Rebuild after changing it. Require HTTPS unless the F05 contract explicitly permits loopback or private `.internal` transport; validate private network reachability separately.

All direct internal fetches carrying the proxy credential reject redirects. Configure a canonical API origin that answers directly. Do not fix redirected calls by enabling redirect following.

## Environment separation and preview protection

Use `APP_ENV=staging` for previews and `production` for production; use the corresponding explicit release SHA. Keep staging database, roles, Redis state, R2 objects, provider keys, callback allowlists and monitoring labels separate. Feature flags do not provide data isolation. Keep migration credentials out of Vercel web and API runtime settings.

Vercel Standard Protection is enabled on the current project. Retain it. If automated health/browser checks require access, use a scoped automation bypass supplied through the CI secret store. `release:health` reads `VERCEL_AUTOMATION_BYPASS_SECRET`, sends it as a header and refuses redirects. The current project lists no configured bypass secret. Never place a bypass token in a checked-in URL or disable protection to make a test pass. Test allowed OAuth callback and webhook behavior with the chosen preview protection setup.

## Build and deploy order

1. Resolve the API/worker hosting and scheduler choices. Provision isolated staging resources; run F05 preflight for each service using injected settings. Align/test Node versions: observed Vercel is 24.x and CI pins 22.13.1.
2. Install from the frozen lockfile. Client generation uses `backend/prisma.generate.config.ts` and needs no database secret. This does not authorize database access or make a complete application build credential-free.
3. Apply reviewed migrations/grants using the restricted migration job after backup/restore readiness is established. Do not run migrations from `postinstall` or an untrusted preview build.
4. Build API (`pnpm --filter @atlas/api-app build`) and web (`pnpm --filter @atlas/web build`) with their actual staging configuration. At Vercel's configured web root the existing `pnpm build` command selects the web package. Retain outside-root files for workspace imports, as required by [Vercel monorepo configuration](https://vercel.com/docs/monorepos/monorepo-faq).
5. Start the API and long-running worker with their scoped credentials. Start web against that API with the same proxy secret. Record process/deployment IDs and immutable source SHA for all services. Worker health port defaults to 8081; keep it private.
6. Run the acceptance checks below. Register schedules and validate execution. Only then assign canonical domains, update the owning Cloudflare rule, verify TLS/tenant mapping and promote the reviewed candidate.

## Scheduled jobs

The repository configuration at `frontend/apps/web/vercel.json` defines:

| Endpoint                               | UTC schedule | Purpose                  |
| -------------------------------------- | ------------ | ------------------------ |
| `/api/v1/internal/fx/refresh`          | `0 6 * * *`  | Daily FX refresh         |
| `/api/v1/internal/certificates/expire` | `0 2 * * *`  | Daily certificate expiry |

Scheduled reports are **not** a cron. The long-running outbox worker checks each active tenant for due report schedules once a minute (`report-schedule-tick` in `backend/apps/api/src/worker/outbox-sweep.ts`) and generates the runs through its `reports` processor. Several worker instances may run at once: due schedules are claimed with `for update skip locked`, so a schedule is never enqueued twice. Successful ticks appear in the worker log as `scheduledReportRunsEnqueued`. `/api/v1/internal/reports/tick` remains available for a manual, CRON_SECRET-authenticated run; do not register it with a scheduler as well.

Verify endpoint spellings against the checked-in configuration before registering any external scheduler. Both require `Authorization: Bearer <CRON_SECRET>`; missing configuration fails closed. Vercel adds this header when `CRON_SECRET` is configured, as described in [Vercel's cron management documentation](https://vercel.com/docs/cron-jobs/manage-cron-jobs). The web rewrite preserves it and authenticates forwarded context to the API. Configure the same cron secret in the API that actually handles the request.

Hobby allows only once-daily schedules, which both remaining jobs fit. If a job ever needs a higher frequency, run it from the worker as the report tick does, or use an eligible plan or an external scheduler, rather than reducing its frequency to fit a plan. If an external scheduler is chosen, explicitly transfer ownership of the affected schedules and remove their Vercel registrations in the same reviewed rollout to avoid duplicates. Store its bearer secret in the scheduler secret manager. Staging schedules must use staging resources and approved test recipients.

Record at least one successful execution per job with timestamp, environment, release, request ID and intended effect. Authentication unit tests and an enabled cron toggle do not prove scheduling works. Account for retries and overlapping invocations using the existing application delivery/idempotency controls.

## Acceptance evidence

- Run `pnpm release:health --base-url <candidate-https-origin> --expected-release <deployed-sha>`. Expected SHA is mandatory, also available as `RELEASE_HEALTH_EXPECTED_RELEASE`; inherited callers such as restore validation need this variable too. Verify both probes identify the expected release and unique matching request IDs. This route is not a full dependency-readiness check.
- On an allowed staging tenant domain: anonymous page/login load, sign-in, protected API request, refresh, sign-out and denied anonymous request. Confirm tenant A cannot access tenant B by replacing IDs or headers.
- On the canonical platform host: a platform operator can read and mutate an approved test fixture, a tenant admin is denied, and foreign Origin mutations are rejected. Test through the actual edge/web/API chain.
- OAuth callback relays access/refresh cookies, removes temporary OAuth cookies and resolves the correct tenant. Verify cookie flags and domain/path through the browser.
- Upload/download a disposable staging asset and verify it from a fresh service instance, then remove only that fixture.
- Worker `/healthz` reports a recent sweep; `/readyz` transitions during graceful shutdown. Observe a test outbox event processed and an external heartbeat. `/readyz` alone does not establish worker progress.
- Capture actual cron executions, provider delivery and monitoring events. Attach evidence to the same release SHA, using the F09 evidence contract. Complete F10 review/check enforcement before release.

## Rollback

Retain the last known-good web/API/worker artifacts and coordinated environment versions. Roll back compatible service versions together when the forwarding secret or routing contract changes. Stop promotion if health, tenant isolation or worker processing fails. Restore the previous domain/redirect rule if a verified cutover fails. Do not undo database migrations or delete persistent storage automatically; use the reviewed migration recovery procedure and preserve the outbox for replay. There is currently no verified production LMS deployment to designate as a rollback target.
