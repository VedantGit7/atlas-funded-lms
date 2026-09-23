# F04: enforce shared rate limits

The user approved F04 from the comprehensive audit. Preserve F01–F03 and the existing local operator access.

## Design and scope

Run a client-IP ingress limit before authentication, body parsing, or database work for attributed requests in the shared tenant/platform wrappers and custom protected download/session routes. Public routes retain their IP limits, including a shared unknown-IP bucket. After resolving the protected actor, apply permission-operation and actor budgets; tenant requests also share a tenant-wide budget. Keys use server-resolved identities, canonical bucket names, and permission identifiers, never resource IDs or caller-supplied tenant IDs. Existing metadata aliases map to the same policy so aliases cannot multiply quotas. Unknown protected buckets fail closed.

Production/staging deployments require a valid Redis TCP/TLS URL. `NODE_ENV=production` also requires Redis even when `APP_ENV` is absent or misleading. Both Next.js Node runtimes validate configuration in their startup instrumentation. Validate again before resolving a cached store, preventing a cached development store from bypassing production checks.

Use an explicit fail-closed outage policy: configured Redis failures return 503 with `Retry-After: 5`, without executing the handler or switching to process-local counters. Development/tests may use an in-memory primary store only when no Redis is configured. Invalid configuration is a startup/request error, not a transient outage. Emit throttled structured outage logs without connection strings or raw exception messages.

Return 429 with an accurate positive `Retry-After` header when a budget is exhausted, including retries of cached operations. Validate Redis replies so malformed counters cannot disable comparisons. Document trusted-proxy configuration, limits, outage monitoring, and deployment prerequisites. Health/internal service endpoints with separate authentication contracts are outside these user-route wrappers; ingress infrastructure protection remains a deployment responsibility.

## Execution

- [x] Reproduce missing-config fallback, invalid Redis counters, missing 429 headers, and protected-route bypass with failing tests.
- [x] Add shared enforcement, supported metadata normalization, safe error headers, and strict store/configuration handling.
- [x] Wire startup, common wrappers, and manual protected routes while preserving current authorization and replay ordering.
- [x] Verify shared counters, 100 concurrent increments and window expiry against an isolated local Redis container using two connections and random expiring key prefixes.
- [x] Run targeted and offline tests, TypeScript, lint, repository guards, independent review, and a local browser check. Record rollout requirements and source hashes.

## Outcome and verification — 19 September 2026

**Implemented in the local working tree; not deployed.** Protected route declarations now enforce Redis-backed tenant/actor/operation quotas before handler execution and replay. Exceeded quotas return 429 with `Retry-After`; configured Redis outages return retryable 503 without a memory fallback. Both application startup hooks reject missing production Redis configuration. Existing F01–F03 authorization behavior and the user's local platform access were preserved.

| Check                             | Recorded result                                                                                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial reproduction              | 21 failures exposed missing enforcement/config/header checks; 1 passed                                                                                            |
| Broad offline regression suite    | 316 files, 2,335 passed, 1 skipped; unit/security/lint-rule/event tests                                                                                           |
| Expanded API/authorization/CI run | Initially 457 passed, 16 failed, 2 skipped; failures traced below                                                                                                 |
| Final focused regression          | 24 files, 210 passed, including all changed route fixtures, API unit tests, session-assurance tests and 3 real Redis tests                                        |
| Sensitive-route audit CI check    | 1 passed on retry with package-manager cache access                                                                                                               |
| TypeScript project build          | Passed (`tsc -b`; this is a type check, not a Next.js production bundle)                                                                                          |
| Lint / formatting                 | Changed source and test files checked                                                                                                                             |
| Repository guards                 | Route metadata, Prisma boundary, audit/outbox compliance, frontend API closure and package exports checked                                                        |
| Browser                           | Existing AAL2 local operator session opened the platform console; catalog and tenant list returned data after a temporary operational reason; reason then cleared |

The expanded suite exposed 15 stale fixture failures across six tenant mutation suites: their database mocks returned no idempotency claim, which F03 correctly rejects with 409. Fixtures now return a claim ID only for the claim insertion; real authorization, idempotency and handler/error assertions remain active. All six suites passed in the final focused run. A separate audit CI test failed because its package-manager subprocess could not read the sandboxed Corepack cache; the same test passed with approved cache access. A package-exports guard exposed a prior F01 test's internal import; that test now imports its local implementation directly. No production security checks were weakened to make tests pass.

Independent review found missing diagnostic retry headers and validation before ingress in custom download routes; both were fixed and behaviorally tested. Review also identified that internal server-rendered calls have no original IP. Protected unknown-IP calls therefore use authenticated quotas without a global shared ingress bucket. **This includes external unattributed callers**; invalid credentials do not reach actor quotas. Production must enforce edge limits for those calls and restrict direct origin access. This deployment condition remains open; the local change does not establish trusted internal transport or install edge policies.

The real Redis test used official `redis:7-alpine` image digest `sha256:520775a41a63e77e06c73e35d2fd9cc15921a609516818796b4ecbb813078bc7`, bound only to loopback. Tests neither flushed Redis nor used application database URLs. The disposable container was stopped after verification; the existing PostgreSQL container was not modified.

## Deployment requirements and limits

Follow [the rate-limiting runbook](../runbooks/rate-limiting.md) for quota values, proxy identity, provider compatibility, alerts and recovery. Both apps and replicas in an environment must share Redis. Configure and test the outage alert and edge/origin rules before production rollout. Startup validates URL syntax, not actual Redis reachability; test connectivity and credentials in staging. Tune the initial quotas with representative workloads.

No Vercel deployment, Cloudflare configuration, Supabase change, live provider alert, production load test, full production bundle build, or full database/browser suite was performed for F04. The local browser check used development memory counters; separate integration tests prove Redis sharing. Health and internal service routes keep their separate authentication contracts and need infrastructure-level protection.

Evidence is in [audits/2026-09-19](audits/2026-09-19), including `f04-verification.json`, source hashes, failing reproduction, broad and final test logs, type/lint/guard outputs and browser verification notes. Final targeted results supersede the initial fixture failures; test totals across runs overlap and must not be added as unique coverage.
