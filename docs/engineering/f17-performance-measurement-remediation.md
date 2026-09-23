# F17 — Performance measurements and a smaller learner bundle

Date: 20 September 2026. Source: working tree based on `ca8c0f1e7e69780b4e2ddc2a1136907a2e47c350`, including the preceding F01–F16 remediations. Changes are local, not deployed.

## Status and capacity decision

The measurement tools, connection-budget checks, pool instrumentation and a measured learner-bundle optimization are implemented. **F17's production acceptance remains open.** Local smoke tests cannot establish production capacity, and the 150 kB learner JavaScript target is still unmet.

The initial planning target is **100 simultaneously active learners sustained, with a burst to 200**. The user delegated this choice. It is a conservative starting test target, not a supported-user promise or a projection from local requests per second.

The connected Vercel project is `prj_mLNnaCQpELmd5nwk6z4jWKSlrjhg`. Its latest 20 deployments returned during this work were all `ERROR`, including the audited branch and main. A healthy production-shaped staging deployment was not found. No load was sent to hosted services, no production data was seeded, and no deployment configuration was weakened to obtain a passing local result.

## Measured improvement

`performAtlasLogout` previously imported the Supabase browser SDK through the learner shell's initial dependency graph. The SDK now loads when logout is invoked, after Atlas's server session cookies have been cleared. Browser sign-out remains best effort, client caches are still cleared, and the existing redirect is preserved. No cross-request authentication or permission cache was added.

Two fresh isolated production builds measured the change:

| Measurement                       | Before this optimization | After |                Change |
| --------------------------------- | -----------------------: | ----: | --------------------: |
| Home route initial JS, gzip kB    |                    412.3 | 354.0 | −58.3 kB, about 14.1% |
| Assessment attempt route, gzip kB |                    403.6 | 345.2 |              −58.4 kB |
| Largest learner route, gzip kB    |                    412.3 | 404.2 |               −8.1 kB |
| Shared root, gzip kB              |                    129.6 | 129.6 |             Unchanged |
| Learner routes measured           |                      277 |   277 |         Same coverage |

The diagnostic result page is now the largest route. The stored ceiling decreased from the historical 422.1 kB to the exact measured **404.1962890625 kB**; the target remains **150 kB**. The historical-to-current difference is not all attributed to this change. The direct before/after optimization comparison is the table above.

These are compressed production manifest estimates, not observed browser transfer bytes. The browser lab records actual transfers separately. Both production builds completed; the first attempt needed network access for public Google Fonts before it could complete.

## Implemented measurements and safeguards

### Real authenticated HTTP

`scripts/perf/http-workload.mjs` runs login, enrollment, refresh, identity, course and lesson reads, progress writes, and persisted progress reads. Each concurrent learner uses a distinct account and cookie jar. It reports setup separately, then warmup, sustained and burst phases, with per-operation and journey counts, p50/p95/p99/max, status counts, error rates and achieved throughput.

This is a **closed-loop** workload with think time after each sequence. It does not establish fixed-arrival-rate capacity and will issue fewer requests when the system slows down. Login/enrollment are one-time setup measurements, not a repeated login storm. The runner's `passed` means the measured fixture operations succeeded; `capacityVerified` remains false.

Guards require an explicit target, fixture IDs, separate identities, valid durations, build provenance and bounded concurrency. Local mode accepts only the isolated tenant frontend on port 3100 and at most five learners. Staging requires HTTPS, disposable-fixture acknowledgement and an exact `PERF_APPROVED_STAGING_ORIGIN` match. Redirects and cross-origin credential forwarding are refused. Requests time out, decoded response bodies are bounded, and neither passwords, cookies nor response bodies enter result files.

Phase deadlines abort in-flight requests and prevent new steps from starting. Boundary cancellations and incomplete journeys are reported separately; they are not successful measurements. An empty completed-journey set fails the run. Warmup is excluded from sizing, unavailable measurements are null, and a rejected CLI run invalidates previous successful evidence before reading the private configuration.

The local fixture uses 30 seconds of a 600-second lesson because Atlas stores percentage progress. The initial one-second assertion correctly failed: not every second can be reconstructed exactly from that representation. The corrected measurement verifies the existing storage contract rather than silently accepting any HTTP 200.

### Database and worker evidence

`DATABASE_POOL_METRICS=1` enables cumulative, bounded histograms for checkout wait and query duration on tenant, platform and dedicated usage pools. Snapshots identify process/pool and capture time, with checkout/query counts, failures, current in-flight counts, connection totals and current waiters. No SQL, bind parameters, result rows, connection URLs or error objects are logged by this instrumentation.

Promise and callback operations, including Prisma's checked-out transaction clients, are covered. Query time excludes pool checkout but includes the client's query queue. Custom Query/stream objects pass through unmeasured. Histogram percentile values are bucket bounds, not exact percentiles. Snapshots emit every 60 seconds; a shorter run can legitimately have no snapshot.

Tenant and platform connection acquisition now have configurable finite timeouts, defaulting to 10 seconds. Existing maximum pool defaults remain 20 and 10. `.env.example` documents the real pg settings and removes misleading Prisma URL pool parameters from the example.

F22 adds an independent usage pool on `DATABASE_URL`, preventing usage persistence from waiting on the business transaction's own pool. `USAGE_DATABASE_POOL_MAX` defaults to 2 and caps at 8. Usage acquisition is limited to 500 ms and each transaction to 1.5 seconds; transaction expiry destroys the connection and awaits the active query's rejection. These connections count toward the same tenant database or pooler limit, including when the pool is created lazily. Optional snapshots use the `usage` pool label.

`scripts/perf/telemetry.mjs` extracts only allowlisted aggregate fields from local process logs and collects a read-only, tenant-scoped snapshot of materialized delivery-job backlog in the disposable database. It explicitly distinguishes zero runnable jobs from proven worker execution. It does not claim to measure unpublished/unmaterialized work or background throughput. Local cumulative pool observations are not phase-isolated deltas.

### Connection budget

`scripts/perf/connection-budget.mjs` validates:

`sum(maximum simultaneous instances × (tenant pool maximum + platform pool maximum + usage pool maximum)) + operational reserve <= database connection limit`

Web, API and worker counts and all three pool sizes (`tenantPoolMax`, `platformPoolMax`, `usagePoolMax`) must be explicit, including for zero-instance processes. Malformed, incomplete, overflowed and excessive budgets fail. Active processes cannot declare zero-sized pools: the runtime would replace zero with its defaults. A zero-instance process represents an absent process.

The checked-in example is arithmetic, not an approved deployment configuration: one web, API and worker process at 20+10+2 connections each, plus 10 reserved connections, uses 106 of an illustrative 120-connection limit, leaving 14 connections of headroom. This configuration would fail against a 100-connection limit. Two web and two API instances plus one worker require 160 application connections before reserves. Budget autoscaling maxima and deployment overlap, not just steady-state replica counts. When the two database URLs refer to separate physical servers or a transaction pooler, assess each server/pooler's actual limits separately; usage and tenant connections share `DATABASE_URL`.

### Mobile lab and bundle gate

The dedicated Playwright lab exercises catalog search, lesson completion and assessment answering with actual interactions. It uses the installed web-vitals implementation for LCP, INP and CLS, and Chromium network events for JavaScript bytes. Each route starts with a fresh browser context and disabled browser cache. The profile is Pixel 7, 4× CPU slowdown, 150 ms network latency and approximately 1.6 Mbps download throughput.

Missing routes, vitals, transfers or interactions fail coverage instead of becoming zero. Synthetic observations are separate from production field percentiles. Good field targets are LCP ≤2.5 s, INP ≤200 ms and CLS ≤0.1, evaluated at the 75th percentile; a single local sample cannot prove these targets. [Google Web Vitals guidance](https://web.dev/articles/vitals).

The bundle guard now requires a completed production build, readable route manifests, complete route coverage and every referenced chunk. Missing artifacts cannot count as zero bytes. Neither ordinary checks nor baseline updates may increase the ceiling; the previous half-kilobyte regression tolerance is removed. `.next-perf` keeps measurement builds separate from the user's development build.

The earlier database-only benchmark also requires an explicit disposable database and tenant. It no longer automatically loads `.env.local`, picks an arbitrary tenant, describes local throughput as a production floor, returns zero latency for empty samples, logs raw database errors, or cleans another run's records. Its role remains a local database regression microbenchmark.

## Verification and local evidence

Focused verification includes guarded HTTP tests using a controlled server, failure/status and payload accounting, deadlines, stale-evidence invalidation, pool callback/promise compatibility, timeout handling, connection budgeting, missing-artifact bundle failures, browser metric coverage and logout behavior. MFA, session assurance and platform revocation regression tests are included. The focused Vitest/CI run passed **92 tests** and the standalone measurement suite passed **22 tests**. Full workspace TypeScript verification and targeted lint/format checks passed. The standalone tooling tests also run in the unit-test CI job. Independent review found phase-deadline overruns and zero-valued pool-budget mismatches; both were reproduced with failing tests and corrected.

The final local HTTP smoke passed with one learner sustained and two in the burst, with 2-second think time. It completed **127 successful HTTP operations**, including four setup operations and 45 warmup requests. One additional warmup request was cancelled at the phase boundary and its journey recorded as incomplete. There were no unexpected request errors or boundary cancellations in the sustained/burst phases.

| Phase     | Learners / duration | Completed requests | Request p50 / p95 / p99 | Completed journeys | Journey p95 |
| --------- | ------------------- | -----------------: | ----------------------- | -----------------: | ----------: |
| Sustained | 1 / 15 seconds      |                 26 | 202 / 270 / 323 ms      |                  5 |    1,275 ms |
| Burst     | 2 / 15 seconds      |                 52 | 276 / 357 / 359 ms      |                 10 |    1,491 ms |

The excluded warmup lasted 30 seconds. Actual phase durations were within nine milliseconds of their configured boundaries. Achieved completed-request throughput was 1.73/s and 3.46/s; think time constrains those numbers. These small development samples validate the harness, not an SLO or production capacity.

A fresh API process emitted its first timestamped pool snapshot after 60 seconds: 208 acquisitions and 2,212 queries, with zero recorded errors. Checkout p95 was in the ≤1 ms bucket and query p95 in the ≤5 ms bucket; p99 bounds were ≤25 ms and ≤10 ms respectively. Four connections were idle and no callers were waiting at that observation. This cumulative snapshot is not a per-phase measurement and does not cover every final request. The fixture's materialized runnable delivery-job count and oldest runnable lag were zero; worker execution/throughput was not verified.

Artifacts live under ignored `.test-results/f17/`: `http-local.json`, `telemetry-local.json`, `mobile-lab.json`, and production build/bundle logs. They contain environment labels and explicit coverage limits. Do not reuse a previous artifact after a failed command or infer a hosted result from a local file.

The final mobile collector passed in 55.3 seconds with all three routes, all four measurements and real keyboard interactions. **These are single visits to a development build**, not production performance or field p75:

| Route              |      LCP |      INP |      CLS | JavaScript transferred |
| ------------------ | -------: | -------: | -------: | ---------------------: |
| Catalog            | 2,288 ms | 1,168 ms |        0 |        1,366,205 bytes |
| Lesson             | 3,724 ms |   496 ms | 0.000342 |        1,360,083 bytes |
| Assessment attempt | 2,256 ms |   488 ms | 0.000249 |        1,481,898 bytes |

The original throttled profile was used. Network bytes include development code and response headers, so they are not comparable to the compressed production manifest table. The observations justify investigating responsiveness and lesson loading in production-shaped staging; they do not establish production SLO failures.

Initial collector runs failed because of a searchbox/textbox selector mismatch and exhausted assessment fixtures; those runs are not performance evidence. Mobile pointer hit testing also encountered interception around the catalog search control. The final collector uses explicitly recorded keyboard focus/input and does **not** prove that touch interaction is correct. Reproduce and fix the catalog pointer interaction in a separate UI regression check.

## Reproduction

Run from the nested repository root. Start the disposable F16 Docker stack and its API/web services on 3101/3100 using the F16 runbook. Keep the normal development services on 3001/3000 separate. Set `DATABASE_POOL_METRICS=1` on the test processes before starting them.

`pnpm perf:build` provides the isolated production-build wrapper for `.next-perf`, without inheriting hosted service credentials. Then run the bundle gate with `ATLAS_PERF_BUILD=1`. The underlying Next build completed twice; the wrapper's environment filtering is unit-tested, but the final wrapper itself was not used for a third full build. This is build verification only: serving the production build still requires the full deployment-service configuration. A local production-server attempt correctly failed on the required Redis setting; that check was not bypassed.

1. `node scripts/e2e/local-run.mjs scenarios` creates fresh isolated course/assessment fixtures using the already-seeded fixture identities.
2. `pnpm perf:local` runs the bounded authenticated HTTP smoke and writes `.test-results/f17/http-local.json`.
3. `pnpm perf:telemetry <api-log> <web-log>` captures aggregate local pool and delivery-job evidence.
4. `pnpm perf:mobile` runs the mobile lab. It completes the fixture lesson and saves an assessment answer; regenerate scenarios before repeating it. Do not run it concurrently with HTTP tests against the same accounts.
5. `pnpm perf:budget scripts/perf/connection-budget.example.json` checks the example arithmetic. Supply actual maximum process counts and limits for a deployment decision.
6. `pnpm perf:tooling-tests` runs the standalone measurement tests. Run the focused Vitest tests with database/Redis URLs removed from the environment, so unrelated global database teardown cannot target another database.

For staging, place credentials only in an ignored private configuration consumed by `pnpm perf:http <private-config.json> <output.json>`. Supply `mode`, exact `origin`, build identity, `disposableFixtures: true`, `pacingMs`, `timeoutMs`, the three named phases, fixture course/lesson/representable-position IDs and a distinct account per concurrent learner. Set the approved-origin environment variable independently. The tool does not seed or discover a hosted tenant automatically.

## Remaining production acceptance and next improvements

1. Establish a healthy staging deployment with the intended database region, TLS, Redis rate-limit backend, object storage and running workers. Record the deployed build, instance ceilings, database/pooler limits and connection budget.
2. Run 100 learners for at least 15 minutes and burst to 200 for five minutes after warmup; follow with a two-hour soak at the expected normal load. These durations are proposed validation policy, not measured results. Keep authentication and rate limits enabled. Record 429s separately rather than removing controls to improve a score.
3. Extend the current lesson HTTP mix with complete quiz autosave/submit/grade, upload initiation/transfer/confirmation, export generation/download and worker processing. F16 already verifies several of these functional outcomes, but those tests are not concurrent performance evidence. Use several tenants and a deliberately busy tenant, with separate fixture identities and administrator background work.
4. Correlate request/journey p50/p95/p99, errors, exact run windows, process pool deltas, query timings, runnable-job age, retries and drain time. The current worker snapshot alone cannot satisfy this requirement. Check the load generator's own CPU/network saturation and use an arrival-rate workload before making throughput promises.
5. Repeat mobile production-build measurements per critical route and collect field p75 after rollout. Profile the now-largest diagnostic result page, shared client providers and optional media/editor/chart dependencies. Keep the 150 kB target and ratchet downward using measured builds. Add a mobile touch/pointer regression for the catalog interception observed during the lab.
6. Profile repeated identity/principal and shell reads before optimizing them. Prefer request-scoped reuse or change-sensitive writes that retain fresh account/membership/grant status. Any broader cache needs explicit revocation regression evidence. Do not trade authorization freshness for a benchmark score.

F17 therefore delivers a repeatable local baseline and a proven bundle reduction. Production concurrency, full mixed-workload/worker acceptance and the 150 kB target remain explicit release work.
