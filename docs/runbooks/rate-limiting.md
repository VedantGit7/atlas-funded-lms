# Rate limiting (F04)

## Enforced policy

All budgets use a 60-second fixed window from the first hit. Counters are shared by both applications and all replicas through Redis. Every attempted operation counts, including authorization denials after identity resolution, replay attempts, and requests rejected by another budget. Limits are initial defaults; tune against representative learner, SCORM, report, and export loads before rollout.

| Tier                                  | Read / minute | Write / minute | Identity                                            |
| ------------------------------------- | ------------: | -------------: | --------------------------------------------------- |
| Protected ingress, attributed IP only |         1,200 |            300 | Plane + trusted IP                                  |
| Protected operation                   |           240 |             60 | Plane + tenant (if applicable) + actor + permission |
| Actor aggregate                       |           960 |            240 | Plane + tenant (if applicable) + actor              |
| Tenant aggregate                      |         4,800 |          1,200 | Tenant, across its members                          |

Public buckets use trusted IP: `publicRead` 120; `publicAuth` 20; `publicInvitationAccept` 10; `publicDiagnostic` 10 per minute. In deployed runtimes public requests without attributable IP fail closed with `503 SERVICE_UNAVAILABLE` and `Retry-After: 5`, without consuming a global unknown bucket. Local development retains the shared `unknown` bucket. Credential verification retains its additional per-process 60/minute guard, now with a proper retry header; its shared public budget remains the primary application control.

Protected aliases (`tenantRead`, `tenantMutation`, `platformRead`, `platformMutation`, `platformWrite`, `authenticatedTenantRead`, `authenticatedTenantWrite`) normalize to read/write policy. Unknown declarations fail closed. Operation identity comes from trusted route metadata. Keys hash identity tuples, contain no raw IP/account identifiers, and expire automatically. Changing resource IDs, request keys, route aliases, or host aliases does not reset an actor's operation quota. Platform quotas are independent of tenant quotas.

The shared tenant and platform wrappers enforce quotas before handler execution or idempotency replay. The seven custom session/download routes use the same protected policy. Public wrapper and diagnostic merge error responses preserve retry headers. Health checks and separately authenticated internal worker/report routes are outside these user-route wrappers and need infrastructure protection.

## IP trust and the internal request boundary

Client attribution happens at the **web ingress**. `TRUSTED_PROXY_HOPS` defaults to **0**: no implicit trust in `x-forwarded-for`. Set it explicitly to the verified number of trusted proxies appending addresses on the path to web; selection counts from the right. Alternatively configure `TRUSTED_CLIENT_IP_HEADER` only when an enforced edge overwrites that single-value header. Atlas internal headers cannot be selected as edge headers. Invalid addresses, malformed lists, or missing trusted hops resolve to unknown; equivalent IPv6 spellings normalize to the same key. Do not expose a web origin that lets callers bypass the configured edge.

The web proxy overwrites `x-atlas-client-ip` before page rendering or API rewriting and discards supplied forwarding credentials/source markers. Server rendering, server actions, OAuth, invitation preview and both refresh paths propagate that stamped identity. Web-to-API calls carry the server-only `API_PROXY_SECRET` and a source value identifying a browser rewrite or server fetch. API ingress removes raw `x-forwarded-for` and the configured edge header, removes supplied internal markers, verifies the credential, and only then retains normalized client IP and trusted source. Direct API callers cannot establish attribution or claim server transport with unsigned headers. These protections depend on every route going through the checked-in web/API proxies.

Protected requests without a trustworthy IP do **not** share one global ingress bucket. Deployed external calls, including authenticated browser rewrites, fail closed with retryable 503 before user authentication. Only credential-authenticated **server fetches** may omit IP; they still authenticate and pass actor/operation/tenant quotas. This exception avoids coupling unrelated tenants through one global counter. Public calls, including server auth/refresh fetches, never receive this deployed exception. Existing local development without a proxy secret remains supported; it does not create an authenticated server marker.

**Production prerequisite:** configure and verify web edge attribution before serving public/auth traffic. Deployed web preflight/startup rejects missing or zero trusted hops unless a valid edge header is selected; this requirement does not apply to API or worker. A configured edge that fails to supply attribution still causes retryable 503 for public and browser API traffic. Restrict both origins, enforce edge authentication/flood controls, protect the proxy secret and use encrypted or explicitly permitted private transport. Server-fetch exceptions still require edge protection on the initiating page/action request. No Cloudflare/Vercel WAF policy or live proxy chain was changed or verified by local tests. Deploy matching web/API versions together, or deploy the new web first with verified edge settings, then API. Old web callers omit attribution/source and receive 503 from the new API; missing source is never treated as server transport.

Provider webhooks (including Stripe, Razorpay and Zoom) also use public wrappers. They must target the configured web-origin `/api/v1/...` path through the verified edge and web/API forwarding chain; posting directly to the API origin now returns 503 before signature verification. Inventory callback URLs and test signed provider events in isolated staging before rollout. Do not add the proxy secret to external provider configuration. Separately authenticated internal/cron endpoints and health checks keep their existing admission contract.

## Startup and outage behavior

Both Next.js Node runtimes validate configuration during instrumentation registration. `NODE_ENV=production` or `APP_ENV=production|staging` requires `RATE_LIMIT_REDIS_URL` or `REDIS_URL`; the former takes precedence. Only Redis TCP/TLS URLs are accepted. Configuration is checked again before returning an existing store, including one cached during development. Invalid configuration stops startup and is not treated as an outage. Use separate Redis databases/instances for production, previews, staging, and tests; both apps within one environment must share theirs.

Use a TLS endpoint and provider-managed credentials in deployment secrets. The application uses Redis `EVAL`, `INCR`, `PEXPIRE`, and `PTTL`; give the limiter account the necessary scripting/key permissions restricted to `atlas:rl:*`, and verify the provider supports them. An HTTP-only REST endpoint is incompatible with the current ioredis adapter. Startup checks URL syntax, not Redis connectivity; check connectivity and authorization before releasing traffic.

An exhausted budget returns `429 RATE_LIMITED` with positive `Retry-After` seconds until the longest exhausted window expires. A configured store timeout, disconnect, or invalid response returns `503 SERVICE_UNAVAILABLE` with `Retry-After: 5`. The protected handler/replay is not executed. All configured-store failures use this policy, including development; memory is only the primary store for development/tests with no Redis configuration. There is no runtime downgrade to memory.

Redis commands have a 1-second timeout and connection establishment a 2-second timeout. Requests arriving before the initial connection is ready may receive a retryable 503. Fixed windows can allow a burst at the boundary; application limits supplement edge controls, request-size limits, and background job/concurrency controls. Redis loss or eviction can reset quota history: use sufficient memory, monitor evictions, and prefer a dedicated non-evicting limiter store. Multi-tier increments are parallel, each atomically incremented with TTL, rather than a single all-tier transaction; a failed attempt may consume only some counters, but never executes its handler.

## Operations and rollout

1. Configure the shared Redis secret in both apps and validate production startup with that configuration. Verify controlled missing-config startup fails. Keep environment separation and origin restrictions in place.
2. With synthetic identities, alternate requests across two instances and confirm the combined threshold produces 429. Test tenant and platform quotas separately; do not load-test real users' budgets.
3. In isolated staging, disconnect Redis and confirm a retryable 503 with no handler effects. Restore it and verify recovery. Never remove the Redis URL to work around an outage.
4. Route the structured `rate_limit.store_unavailable` event into the existing monitoring system. It is emitted at most once per 30 seconds per process, includes request ID/store/policy, and omits raw exceptions and connection URLs. Alert on any sustained event over one minute, correlate with route `SERVICE_UNAVAILABLE` failures, and monitor Redis latency, connections, memory and evictions. The alert rule itself must be configured during rollout; it was not installed locally.
5. Track 429 rates by route and actor plane; investigate a baseline increase before increasing limits. Load-test real lesson/exam/report workflows and adjust constants through review. Honor `Retry-After` in callers; do not automatically repeat writes with a new idempotency key.
6. On an outage, restore connectivity, credentials, capacity or the Redis service. Observe successful guarded requests before closing the incident. Do not flush all keys or switch replicas to independent counters. A rollback to pre-F04 code restores the audited weakness and needs an explicit security decision.

## Local verification

Unit and route tests cover budget isolation, aliases, malformed replies, startup failure, outages, headers, and custom-route ordering. `tests/integration/api/rate-limit.redis.test.ts` uses `F04_TEST_REDIS_URL`, rejects non-local targets, and checks shared counters, 100 concurrent increments, and expiry through two Redis connections. Every run uses a random prefix and expiring keys; it never flushes Redis. Leave database URLs unset for this isolated suite so unrelated database teardown is not enabled.

See [F04 remediation evidence](../engineering/f04-rate-limiting-remediation.md) for the recorded run and remaining deployment requirements.
