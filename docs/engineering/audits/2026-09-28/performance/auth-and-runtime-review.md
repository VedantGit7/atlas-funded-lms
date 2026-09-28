# Authentication and runtime review — 28 September 2026

This review identifies an authentication inefficiency and development-runtime overhead. It does **not** establish production capacity or close Step 5. Application authorization, tenant RLS, pool limits and acceptance thresholds were not relaxed.

## Authentication correction

The installed `@supabase/auth-js` 2.108.2 implementation verifies expiry in `GoTrueClient.ts:6312` and, for symmetric tokens or unavailable signing keys, calls `getUser(token)` in `getClaims` at line 6332. Atlas already called `getUser` immediately beforehand. A regression using the installed SDK reproduced two outbound user requests for one verification operation.

The correction preserves both SDK operations:

- `backend/packages/auth/src/session.ts:46` creates a fresh verification client, calls live `getUser` at line 47, invokes `getClaims` at line 58 and compares the verified subject with the returned user at line 60. AAL comes from those same verified claims; enrollment and user metadata do not promote assurance.
- `backend/packages/auth/src/supabase-server.ts:28` creates the client for one verification operation. `session-verification-fetch.ts:14` restricts response reuse to GET requests at the exact configured user endpoint. All headers, including authorization, must match. Only a successful response is cloned, and that clone can be consumed once. The live fetch explicitly uses `cache: "no-store"` at line 25. Nothing is retained across incoming requests.
- `session.ts:78` distinguishes retryable transport/provider errors and HTTP 429/5xx from invalid credentials. Verification outages fail closed with HTTP 503 and a non-exposed message. They do not trigger refresh into a different identity. Invalid tokens remain HTTP 401. Thrown errors while verifying a newly refreshed token receive the same classification.

The initial regression run failed on both duplicate requests and 401 responses to provider outages. The final three focused suites passed **41 tests**, including one live request per symmetric verification, next-request revocation, expired tokens, mismatched subjects, valid/invalid asymmetric signatures, exact header/endpoint/method boundaries, consumable response clones and non-retention of failures. Targeted lint and the auth TypeScript build passed. An earlier broader run passed **138 tests** across auth, security and tenant-host checks; that count predates the final added refreshed-token transport regression and is not a full-repository test claim.

The existing refresh-token operation's separate error mapping was not redesigned. These checks prove the scoped verification correction, not the cause of every historical authentication failure.

## CPU profile and Next.js development tracing

The local API profile covered **318.158 seconds** in development mode. Its self-time summary attributed 23.707 seconds (7.45%) to `init`, 18.135 seconds (5.70%) to `collectStackTracePrivate`, and 11.042 seconds (3.47%) to garbage collection. Idle samples accounted for 38.10% of the full interval. These are sampled process timings, not request-stage timings or database execution measurements.

The profile's `init` call frame points to the installed Next.js 16.3.5 `app-page-turbo.runtime.dev.js`, zero-based line **87**, column **181763**. Reading that exact position identifies React's `async_hooks.createHook({ init: ... })` implementation. The readable equivalent in `react-server-dom-turbopack-server.node.development.js:6304–6479` installs and enables the hook during module initialization. It tracks asynchronous operations and captures stacks; no per-request debug-channel condition gates its installation.

`experimental.reactDebugChannel` is therefore not a switch for this cost. The installed `config-shared.d.ts:990–993` describes a transport choice: send React debug information over WebSocket instead of in the RSC payload. `router-server.js:639` gates the channel callback, and `app-render.js:475` gates debug-stream creation. Neither disables the profiled hook. No unsupported runtime flags, dependency patches or debug-channel configuration changes were made. A local production build/start is the appropriate comparison for removing development-runtime overhead; it would still not substitute for hosted acceptance.

## Failure attribution and instrumentation checks

Keep these findings separate:

- **Historical inference:** the 26 September API log records `rate_limit.store_unavailable` for Redis immediately before three `/me` HTTP 503 responses. The failure log is throttled, so this strongly supports a rate-limit-store origin but does not individually correlate every response. Historical 401 causes remain unproven.
- **Current confirmed failure:** the coordinating fixture investigation observed GoTrue reporting PostgreSQL SQLSTATE **53300** (`too_many_clients`). This establishes an authentication-service database connection-exhaustion failure in the current diagnostic. It does not retrospectively prove the cause of the older 401 responses. Fixture pool correction and subsequent workload results are separate evidence.

Pool instrumentation also received a read-only check. A tiny in-memory reproduction confirmed that separately loaded copies of its module can wrap one pool twice because the installation registry is module-local. However, the current process (PID 15080) and historical follow-up (PID 22936) each showed one regular 60-second metrics series per active pool, with stable inferred instrumentation start times. Duplicate instrumentation is not supported as the measured bottleneck.

Raw profiles and service logs remain in ignored local evidence. Sanitized workload and fixture evidence must be assessed alongside this report before drawing any capacity conclusion.
