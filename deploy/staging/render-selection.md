# Render staging selection — 26 September 2026

The user delegated host selection and confirmed Render workspace `My Workspace` (`tea-daruobl9fdbs73b5hqkg`). **Paid provisioning is paused.** On 28 September the user briefly resumed preparation, then explicitly rejected the USD 120/month cost as too expensive. No Render resources were created. The dashboard is accessible; a fresh connector inventory found no services or Key Value instances. This document records the rejected proposal, not a deployed environment or capacity result. Do not provision this proposal without new approval.

## Proposed resources

Current budget: **USD 0, local testing only**, explicitly selected by the user on 28 September. The rows below are retained for historical traceability, not an active purchase plan.

| Name                     | Service                                             | Region    | Instances / plan          | Monthly compute rate |
| ------------------------ | --------------------------------------------------- | --------- | ------------------------- | -------------------- |
| atlas-staging-api        | Web service, existing API container target          | Singapore | 1 × `2c-4g`, 2 CPU / 4 GB | USD 85               |
| atlas-staging-worker     | Background worker, existing worker container target | Singapore | 1 × `1c-2g`, 1 CPU / 2 GB | USD 25               |
| atlas-staging-rate-limit | Private Key Value                                   | Singapore | `256mb`, 250 connections  | USD 10               |

Proposed base compute is **USD 120/month** while running. No workspace upgrade, autoscaling, extra database or persistent disk is selected. All three prices were rechecked on the rendered [Render pricing page](https://render.com/pricing) on 28 September; plan identifiers match the [compute plan documentation](https://render.com/docs/compute-plans). Compute is prorated by running time; taxes and usage charges are additional. This was a starting measurement configuration, not proof it serves 100/200 learners. The user rejected this cost; obtain approval for a lower-cost, concrete configuration before provisioning anything.

The API has additional memory headroom over the 2 GiB Compose reference; the worker starts with one CPU and must pass its own queue/PDF checks. Keep application pools at 20 tenant / 10 platform / 2 usage connections per API instance. Budget the worker's additional connections against the actual staging database limit before startup. Use the existing staging Supabase project `acfkhlnrlnlignkqpxhc`; verify its application schema and dedicated runtime logins rather than creating another database automatically. Its Mumbai location introduces a cross-region database hop to Singapore that must be included in measurements.

## Release and ingress configuration

- Build API and worker from one reviewed commit with `deploy/managed-node/Dockerfile` targets `api` and `worker`. API build settings enter through its existing BuildKit secret. Keep image registry private and deploy immutable SHA-256 image digests; save both digests alongside the source SHA.
- Render's web-service connector does not support this prebuilt-image deployment or creation of background workers. Use the dashboard's prebuilt image workflow or a validated Blueprint after images and registry credentials exist. Do not accidentally build the final API target for the worker.
- API listens on `0.0.0.0:3001`; worker runs the image's worker command and exposes no public service. Configure at least 45 seconds shutdown grace. Preserve the worker's 30-second draining deadline and health/heartbeat checks.
- Use `APP_ENV=staging`, `NODE_ENV=production`, `ATLAS_SERVICE_RUNTIME=managed-node`, and the same full `RELEASE_SHA` on all services. Disable automatic deployment during controlled capacity measurement.
- API domain: `api-staging.fundedbeyond.com`; web tenant: `staging.fundedbeyond.com`; console: `platform-staging.fundedbeyond.com`. These remain proposed until DNS/TLS and exact routes are verified. Production root and www are unchanged.
- Key Value uses private networking, no public IP allowlist, and `noeviction`; verify internal authentication and successful fail-closed Redis readiness before accepting traffic.
- Retain signed web-to-API forwarding. Verify the actual Vercel edge header overwrite behavior and direct-origin denial before selecting trusted IP settings. Do not infer hop counts from provider names.

## Verified configuration inventory

Vercel dashboard inspection kept every value masked. The Atlas project has eight variables scoped to Preview / `release/atlas-staging-20260923`: `APP_ENV`, `RELEASE_SHA`, `APP_URL`, `PLATFORM_HOST`, `API_INTERNAL_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `STORAGE_PROVIDER`, `R2_BUCKET_NAME`. Its Shared tab says no shared variables are linked. Presence does not establish value correctness. The Vercel connector still returned an authorization error; dashboard access works.

Read-only Supabase verification of `acfkhlnrlnlignkqpxhc` on 28 September again found zero public tables and zero Atlas roles, with `max_connections=60`. The earlier check found no Prisma migration history or tenants table. The healthy project is not yet an initialized Atlas application database. API, worker and web cannot each consume their default 32 connections: 96 exceeds the server limit before Auth, administration or overlapping deployments. Verify a complete cross-process connection budget before selecting runtime pools; do not increase limits or upgrade the database automatically.

The local environment file's key inventory has no R2, SMTP, Sentry or worker-heartbeat settings. The Render existing-image form requires a published image and private-registry credential; neither has been configured there. The Git provider is also not linked. These are deployment prerequisites in addition to the hosting budget.

Still required: staging application schema and TLS runtime database logins; Auth public/service settings and callback allowlist; private R2 bucket credentials; SMTP and controlled recipients; Sentry and worker heartbeat; distinct proxy/cron/worker/privacy/billing secrets; verified client-IP settings; image registry credentials; protected Vercel deployment configuration. Keep all credential values out of this document and public evidence.

## Acceptance sequence

1. Validate all three service configurations using `check:deployment`; verify actual provider reachability, restricted DB roles and storage privacy.
2. Deploy and record exact matching releases, run browser/auth/isolation smoke checks, then a short load canary.
3. Run warmup 100/120 s, sustained 100/900 s, burst 200/300 s and endurance 100/7200 s with 20-second think time. Allow at most 60 seconds for each phase's admitted journeys to finish, explicitly recorded in addition to the load window. Any errors, incomplete work, actor losses or SLO failures fail acceptance.
4. Correlate route-stage timings, pool metrics, resources and worker health. Reconcile acknowledged usage against durable journal and rollup deltas. Record frontend initial JavaScript and browser transfers separately.
5. Retain the previous failed development run unchanged. Close Step 5 only after the new evidence satisfies every target.
