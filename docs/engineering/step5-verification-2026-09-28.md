# Step 5 verification — 28 September 2026

**Step 5 remains open.** This continuation corrected successful-request usage durability and an authentication fixture failure, then measured the unchanged latency targets again. The user selected **USD 0 — local testing only** after rejecting the USD 120/month Render proposal. No Render resources were created, no paid alternative was provisioned, and no production traffic or customer data was used.

## Local load results

The corrected development diagnostic used distinct authenticated learners, a 20-second think time, a 60-second warmup, 100 learners for 120 seconds and 200 learners for 60 seconds. The load generator allowed at most 60 additional seconds to finish admitted journeys. These are short diagnostic windows, not the required 15-minute sustained, five-minute burst or two-hour endurance tests. The application ran in Next.js development mode; this cannot establish hosted production capacity.

| Corrected phase      | Learners completing duration | Requests | Request errors | Successful request p95 | Successful journey p95 |
| -------------------- | ---------------------------: | -------: | -------------: | ---------------------: | ---------------------: |
| Warmup               |                          100 |    1,100 |              0 |               5,864 ms |              24,429 ms |
| Sustained diagnostic |                          100 |    1,645 |              0 |               5,864 ms |              22,824 ms |
| Burst diagnostic     |                          200 |    1,635 |              0 |               9,298 ms |              37,195 ms |

The two-learner canary passed, with sustained request p95 379 ms and journey p95 1,137 ms. All 100/200 diagnostic actors completed their target durations and request errors were eliminated, but the **1,000 ms request / 3,000 ms journey p95 targets still failed**. No threshold was relaxed. A two-hour test was not started after this shorter latency failure.

The corrected diagnostic reconciled **3,384 expected tenant-metered requests against exactly 3,384 durable journal records**, including setup. This is a different population from the 4,380 phase HTTP requests: not every route is tenant-metered, and setup sits outside those phase counts. No terminal usage-persistence failure or automatic memory-restart message appeared in the API log. The source hashes for all 44 tracked backend/performance files stayed unchanged throughout each diagnostic.

Across 246 read-only connection samples, Auth used at most five connections and the application database at most 21, including the observer. These are sampled maxima, not guaranteed instantaneous peaks. The corrected Auth log contained zero SQLSTATE 53300 / too-many-clients matches. The diagnostic's API/web processes and four owned fixture containers were stopped; the user's separate `atlas-postgres` container was preserved.

Sanitized evidence: [corrected workload and reconciliation](audits/2026-09-28/performance/bounded-auth/summary.json), [earlier profiled diagnostic](audits/2026-09-28/performance/profiled/summary.json), and [authentication/runtime investigation](audits/2026-09-28/performance/auth-and-runtime-review.md). The original profiled run remains failed evidence: it had request errors and lost actors. Changes between runs include the Auth fixture pool cap and removal of profiling, so do not attribute latency differences to one isolated change.

## Corrections and their limits

**Successful request usage is committed with the business transaction.** The route appends its usage event inside the tenant transaction, acknowledges it only after commit, and reuses the same event identity if an uncertain commit needs a fallback. Authorized idempotent replays are still counted, without charging the business entitlement again. The new route regressions cover rollback, replay, uncertain commit and access denial. Failed-request and email attribution remain bounded best effort; this change does not claim full durability for those cases. Successful duration ends before journal insertion, commit and output serialization. The durable journal, not the dedicated fallback pool, is the authoritative request count.

**Authentication retains live verification.** The installed Supabase SDK performed a duplicate user lookup for symmetric-token claims. Atlas now reuses one successful exact-request response only inside the current verification operation. It retains SDK signature, expiry, subject and assurance checks and performs a fresh provider request on the next incoming operation. Provider outages fail closed with a retryable response rather than being treated as an invalid password. No cross-request permission cache was added.

**The isolated Auth fixture no longer has an unlimited database pool.** During the first diagnostic GoTrue reported PostgreSQL SQLSTATE 53300, connection exhaustion. The local Compose configuration now caps its pool at 10 connections and five idle connections. Application pool sizes and the database server limit were not increased. The corrected run used the same disposable fixture database and retained all earlier evidence. The GoTrue configuration fields are documented in [Supabase configuration](https://github.com/supabase/supabase/blob/master/docker/CONFIG.md); [Auth configuration source](https://github.com/supabase/auth/blob/master/internal/conf/configuration.go) documents the zero/unlimited default.

The sampled CPU investigation identified React's development async tracing and stack capture as material costs. It does not quantify production request latency. No dependency patch, unsupported flag, security bypass, fake deployment credential or relaxed deployment validator was used to hide that overhead.

The earlier [26 September run](performance-targets-2026-09-26.md) completed the longer local schedule, including two hours, but failed capacity acceptance. Its failures remain part of the record. Today's shorter diagnostic verifies the scoped corrections; it does not supersede that failed endurance result with a pass.

## Verification

The final production frontend build measured **204.435 KiB gzip** for the largest learner-facing route, Hall of Fame, across **71 routes**. This is about **49% below the original 403.8 KiB** and below the previous 225.396 KiB ratchet. Shared root JavaScript is 129.190 KiB. The **150 KiB target remains unmet by 54.435 KiB**. The ratchet baseline was lowered to the actual measured maximum; the guard still reports H16 open. Measurements count unique shared and route-entry chunks, compressed individually; they are not an observed browser-transfer trace.

Changes move error-reporting code and closed certificate-sharing UI to demand loading, render static landing/dashboard sections on the server, replace selected simple animation-library uses with native animations, and use native images for already-unoptimized tenant logos. Loading failures, retry, keyboard focus, reduced motion, dark-logo selection and form behavior have focused regression coverage. Monitoring initialization and security checks remain active. [Final build, tests and bundle evidence](audits/2026-09-28/learner-bundle/README.md).

- Route/security regressions: **77 tests across 10 files passed**, with targeted lint and DB/API typechecking.
- Usage helper verification: **30 unit tests and nine isolated PostgreSQL integration tests passed**, including transaction rollback and replay. Its tracked fixture records were cleaned.
- Authentication verification: **41 focused tests passed**, plus targeted lint and auth typechecking. An earlier broader 138-test run predates the final added regression and is not a full-repository claim.
- Frontend verification: **76 tests across 27 files passed**, targeted lint passed and the production build completed. The unchanged bundle guard passed its stricter ratchet while retaining the unmet 150 KiB target.
- Load evidence uses source hashes of the dirty working tree. Git HEAD alone does not identify these uncommitted changes. Raw profiles, full service logs and synthetic credentials remain ignored local artifacts.

## Hosting decision and remaining acceptance

The current authorized budget is zero. Render dashboard access works and its prices still matched the rejected USD 85 API, USD 25 worker and USD 10 Key Value proposal. See the [dated hosting inventory](../../deploy/staging/render-selection.md). No billable service was created.

The isolated Supabase staging project still has no public application tables or Atlas roles and allows 60 database connections. The default API, worker and web pool limits could total 96 before Supabase services, administrative reserves or deployment overlap; a complete connection budget is required before deployment. Staging R2, SMTP, monitoring, heartbeat, runtime roles and private immutable image configuration are also incomplete. These requirements are not removed to obtain a benchmark.

To close Step 5, a suitable production-mode environment must pass the unchanged SLOs, exact usage reconciliation and browser verification at 100 learners for 15 minutes, 200 for five minutes and 100 for a full two hours. This could be an existing suitable host supplied later; it does not require accepting the rejected Render proposal. Until then, capacity and endurance remain explicitly unverified.
