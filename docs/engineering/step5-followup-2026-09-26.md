# Step 5 follow-up — 26 September 2026

**Step 5 is still open.** The previous two-hour development run failed its latency, error and durability gates. This follow-up addresses the observed bottlenecks. It does not replace the historical evidence or certify hosted capacity. The user has explicitly paused paid Render provisioning.

## Implemented corrections

- Removed nine redundant reads per complete learner journey using projections restricted to the exact authorized resource, transaction, context, tenant and actor. Fresh authorization, published-content checks and progress/enrollment locking remain. No cross-request permission cache was introduced. [Request-path verification](audits/2026-09-26/performance/request-path-followup.md).
- Batched usage events by tenant with bounded admission, queue deadlines and two active writes. Each caller is acknowledged only after commit. Event IDs survive retries, including uncertain commit responses. The usage connection pool remains two; increasing database limits was not used to conceal contention. Flush now includes delayed retries and failure reporting, and delayed retries cannot reopen a closed pool. [Database verification](audits/2026-09-26/performance/usage-batching-verification.md).
- Added optional fixed-size request-stage timing summaries. SQL query output in development now requires an explicit opt-in; warnings/errors remain available, and deployed environments cannot opt into SQL output. Local measurement explicitly disables query logs and enables stage/pool summaries.
- Added an optional phase drain of at most two minutes. New journeys stop at the original load deadline; admitted journeys may finish within the additional bound. The report separately records elapsed drain, cancellations, incomplete journeys and responses past the hard deadline. Any such incomplete work or overrun rejects acceptance, even if earlier journeys succeeded. The two-hour load window is never shortened by drainage.
- Reduced the largest initial learner bundle from 290.574 KiB at the start of this follow-up to **225.396 KiB gzip**, about **44% below the original 403.8 KiB**. All 71 routes were measured after a successful final production build; `/community` is the largest, and shared framework code is 129.207 KiB. The 150 KiB target remains unmet. Validation still uses the original schemas, loading failures fail closed, and operational query providers remain on the routes that consume them.

## Verification

- Request/projection/security/timing checks: 72 tests passed; API typecheck and targeted lint passed.
- Usage batching and shutdown: 32 unit/structure tests and six real PostgreSQL tests passed. The dedicated integration fixture was cleaned within its scoped cleanup boundary and stopped. Independent review reproduced the original shutdown race and confirmed the fix.
- Load harness, local launcher and usage reconciliation: 32 checks passed. Regression tests cover final responses arriving past the hard deadline, a stuck request after an earlier successful journey, and refresh finishing after the load window.
- SQL logging: three focused tests passed. Independent review found no logging-boundary defect.
- Frontend: 72 focused tests plus 18 existing authentication tests passed, along with targeted lint and the final production build/typecheck. Recovery-link rendering and cold-validation duplicate submission have explicit regressions. The bundle guard passed and its ceiling was lowered to the exact measured 225.3955078125 KiB.

These counts describe their respective suites and are not a full-repository test claim. Independent review found and corrected the retry/shutdown gap and final-response deadline overrun before measurement. Frontend review also identified cold-validation duplicate submission and password-reset form identity issues; both were fixed and regression-tested before the final production build. The secret guard passed on the new evidence.

## Short local diagnostic: acceptance failed

The two-learner canary passed with zero HTTP errors: sustained request p95 was 331 ms and burst p95 was 282 ms. All 50 expected metered requests matched the database journal exactly.

The subsequent larger development-mode diagnostic used the same 20-second think time and unchanged 1,000 ms request / 3,000 ms journey p95 limits. It was intentionally shorter than the acceptance schedule:

| Phase                | Learners / load window | Learners completed | Requests / errors | Request p95 | Journey p95 | Drain after load window |
| -------------------- | ---------------------- | ------------------ | ----------------- | ----------- | ----------- | ----------------------- |
| Warmup               | 100 / 60 s             | 100                | 1,100 / 0         | 6.418 s     | 27.585 s    | 15.630 s                |
| Sustained diagnostic | 100 / 120 s            | 100                | 1,625 / 0         | 6.885 s     | 28.422 s    | 4.400 s                 |
| Burst diagnostic     | 200 / 60 s             | 200                | 1,206 / 6         | 12.925 s    | 62.431 s    | 7.698 s                 |

Burst failures were three HTTP 401 and three HTTP 503 responses. There were no cancelled requests, incomplete journeys or hard-deadline overruns. This is not a 15-minute sustained / five-minute burst / two-hour endurance pass. The prior longer test is not a controlled before/after comparison with this short diagnostic.

**Usage persistence remains a correctness blocker.** The diagnostic generated 3,020 expected metered requests but only 3,018 durable journal records. Two terminal admission failures match the deficit. Final cumulative counters across canary and diagnostic show 3,068 acknowledgements, 1,251 committed batches, zero failed batch attempts, two rejected admissions and zero retained/active events. The usage pool reported no acquisition or query errors. This narrows the observed loss to admission before database insertion; current logs cannot definitively distinguish admission deadline from capacity rejection. Do not increase timeouts or remove queue bounds just to conceal the loss. Explicit overload handling and durable admission need further work.

Stage summaries show substantial transaction time outside business callbacks, plus authentication cost. That includes pool checkout, transaction setup and commit and must not be labelled entirely database wait. SQL query logging stayed disabled. No automatic memory-restart message was observed in this short run. Sampled API resident memory reached about 2.58 GiB; this is neither a V8 heap measurement nor a production-memory assessment.

The first preflight attempt failed before login because Node did not resolve the fixture hostname. The corrected runner uses the existing process-only DNS helper without editing the system hosts file. Both attempts remain in ignored local evidence. During the corrected run, all 158 captured source/test/configuration hashes remained unchanged. Subsequent frontend-only review repairs passed the final frontend build; the failed HTTP diagnostic is not represented as a complete final-candidate acceptance test. Task-owned servers and four fixture containers were stopped; the existing `atlas-postgres` development database on port 15432 remains running. [Cleanup verification](audits/2026-09-26/performance/followup/cleanup.json) found no test listeners or test process IDs remaining.

Sanitized [diagnostic summary](audits/2026-09-26/performance/followup/summary.json), [full workload results](audits/2026-09-26/performance/followup/diagnostic.json), [usage reconciliation](audits/2026-09-26/performance/followup/diagnostic-usage-reconciliation.json), [stage and acknowledgement metrics](audits/2026-09-26/performance/followup/metrics.json), pool telemetry, resource samples and source fingerprints are retained together. Raw logs and fixture credentials are not published.

## Hosting and remaining acceptance

### Admission diagnostics follow-up

After the failed diagnostic, admission errors gained an explicit bounded reason (`capacity`, `deadline`, or `closed`; legacy callers default to `unknown`). The existing metrics now report separate rejection counters, and terminal failure logs include the reason without printing raw error messages. Tests cover capacity rejection, timer expiry, expiry detected by a delayed dispatcher, single-counting, and shutdown reporting. The new assertions failed before implementation; afterward 33 focused metering tests, the database/API TypeScript build and targeted lint passed.

This is an observability correction, not a persistence fix. It does not change admission limits, retry behavior, business responses, SQL or durable acknowledgement. No new load run was performed after this change, and the two historical admission failures cannot be retrospectively assigned a definite subtype. The earlier measurements and their source fingerprints remain historical evidence.

[Render selection and the verified configuration inventory](../../deploy/staging/render-selection.md) record the proposed US$120/month base configuration. The user confirmed the workspace and then chose **Keep paid provisioning paused**. No billable resources were created.

Vercel dashboard access works with secret values masked. Only eight branch-preview variables are present; no shared variables are linked. The staging Supabase project is healthy but has zero public tables, no Atlas runtime/group roles and no Prisma migration history. It is not an initialized Atlas deployment.

Hosted completion still needs initialized staging data/roles, actual API/worker services, storage/email/monitoring configuration, protected web deployment and verified network routing. Once available, run the production canary, then 100 learners for 15 minutes, 200 for five minutes and 100 for a full two hours, with unchanged latency/error gates and usage reconciliation. Verify browser transfers and interactions against the deployed build too.

The prior failed run remains in [the original performance report](performance-targets-2026-09-26.md). Short local diagnostics can demonstrate whether a fix helps; they do not fulfill the missing hosted endurance requirement.
