# Atlas protected staging deployment

This is the deployment checklist for the F01–F22 release candidate. It does not create infrastructure. The user owns `fundedbeyond.com`; server ownership, DNS control and provider credentials must be verified separately. Keep the root domain and `www` routing unchanged.

## Proposed addresses

| Address                             | Service                                             | Configure only after                                    |
| ----------------------------------- | --------------------------------------------------- | ------------------------------------------------------- |
| `staging.fundedbeyond.com`          | Primary disposable tenant on Vercel web             | Protected staging project and exact domain verification |
| `platform-staging.fundedbeyond.com` | Platform console on the same web deployment         | Verified operator grants and MFA                        |
| `api-staging.fundedbeyond.com`      | Managed Node API                                    | Host ingress, TLS and trusted-proxy configuration       |
| `staging-second.fundedbeyond.com`   | Second disposable tenant on the same web deployment | Second tenant/domain fixture for isolation checks       |

These names are a proposed configuration, not live endpoints. Do not point them at local development or a production database to bypass missing staging resources.

## Resource and account prerequisites

- Vercel access to team `vedantwedhane-8075s-projects`, with preview protection retained. The connected app currently returns 403 for this scope.
- An always-running managed Node/container host for API and worker. Use the two existing targets in `deploy/managed-node/Dockerfile`; both require the same candidate source. The Compose reference is `deploy/managed-node/compose.yaml`. Start with its 2 CPU/2 GiB limits per service, then measure actual capacity. The domain purchase does not provide these processes.
- A separate staging application PostgreSQL database. Provision repository SQL setup, migrations, RLS, triggers, indexes, grants and functions in the documented order. Runtime application and platform logins must be distinct and unable to bypass RLS. Keep the migration owner credential out of all runtime settings.
- An isolated staging Auth project and callback allowlist. The existing hosted Supabase project is healthy but is not automatically designated as disposable staging.
- Separate Redis state, a private staging R2 bucket and scoped object credentials, controlled SMTP recipients, Sentry environment, worker heartbeat and an external 15-minute scheduler. These must be provisioned before acceptance testing.
- Repository protection requires the private-repository plan/admin prerequisites and independent review described in F10. Neither a draft PR nor a successful CI run turns on merge protection.

## Configuration and build contract

Use Node from `.node-version` and the pinned pnpm version from `package.json`. Install with `pnpm install --frozen-lockfile`. All services use `APP_ENV=staging` and a full `RELEASE_SHA` matching the candidate; runtime containers use `NODE_ENV=production` and `ATLAS_SERVICE_RUNTIME=managed-node`.

Set `APP_URL=https://staging.fundedbeyond.com`, `PLATFORM_HOST=platform-staging.fundedbeyond.com` and `API_INTERNAL_URL=https://api-staging.fundedbeyond.com` only once those exact origins are configured. Supply the API origin and public Auth settings at web build time as well as runtime. Full required settings and safe validation are defined by `docs/runbooks/deployment-configuration.md` and `.env.example`; do not substitute the test fixtures' synthetic credentials.

Generate independent per-environment cron, worker, proxy and encryption/signing secrets in the chosen secret manager. Web and API share only their environment's `API_PROXY_SECRET`; never expose it through a public variable. Scope database, object, email and monitoring credentials to staging. An automation bypass, if needed, belongs only in CI secrets and request headers.

Inject each service's real settings before running:

```sh
pnpm check:deployment api
pnpm check:deployment worker
pnpm check:deployment web
```

The validators intentionally report `connectivityVerified: false`; passing them is not provider acceptance. A missing value must stop rollout.

Build immutable images from the committed candidate. Keep the build environment file outside the repository and supply it as a BuildKit secret:

```sh
docker build -f deploy/managed-node/Dockerfile --target api --secret id=api_build_env,src="$ATLAS_API_BUILD_ENV_FILE" -t "$ATLAS_API_IMAGE" .
docker build -f deploy/managed-node/Dockerfile --target worker -t "$ATLAS_WORKER_IMAGE" .
docker compose -f deploy/managed-node/compose.yaml config --quiet
```

The Compose inputs are `ATLAS_API_IMAGE`, `ATLAS_WORKER_IMAGE`, `ATLAS_API_ENV_FILE` and `ATLAS_WORKER_ENV_FILE`. Use image digests for rollout and secret-manager exported files with restricted permissions. Host ingress must be configured separately: the reference publishes API port 3001 only on loopback and does not expose the worker publicly.

## Rollout and acceptance

1. Obtain green exact-candidate CI and retain its aggregate/release evidence. Resolve workflow admission failures before treating job status as test results.
2. Establish isolated resources and validate restricted database roles, TLS, Auth callbacks, bucket privacy/CORS, Redis and provider reachability. Apply the reviewed schema before starting matching services.
3. Start the worker, API and protected web. Configure liveness restart and readiness separately; allow at least the documented 45-second shutdown grace. Verify the external scheduler actually invokes the authenticated endpoints.
4. Run `pnpm release:health --base-url "$STAGING_WEB_ORIGIN" --expected-release "$RELEASE_SHA"` and require matching release identities. Then run the deployed auth/MFA, revocation, tenant-denial, refund, delivery, certificate, export, large-upload and restart tests from the topology and closure reports using disposable fixtures only.
5. Test restore, rollback, alert receipt and the 100 sustained/200 burst capacity target before production approval. Retain the earlier artifacts and compatible environment versions; do not automatically reverse database migrations or delete persistent objects on rollback.

F13 CSP compatibility/enforcement, F14 complete privacy lifecycle, F17 capacity/bundle target, F19 password protection and reference-aware SCORM cleanup remain explicit release work. This checklist does not close them or authorize a production cutover.
