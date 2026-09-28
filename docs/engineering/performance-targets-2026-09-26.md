# Performance verification — 2026-09-26

This report preserves the earlier failed run. Subsequent fixes and verification are tracked in [the Step 5 follow-up](step5-followup-2026-09-26.md).

**Step 5 remains open: the measured capacity targets failed.** The complete local test schedule ran, including an actual two-hour endurance window, but errors, latency, automatic API restarts and learner dropouts prevent acceptance. The largest learner initial JavaScript bundle fell from **403.8 to 290.6 KiB gzip (about 28%)**; the 150 KiB goal remains open. No production-capacity acceptance is claimed.

Work is on `release/atlas-staging-20260923`, based on `0c405545d5c9d51dc29b27f11163c18e723d5bbc`, with earlier security/reliability changes and current performance changes uncommitted. No deployment, merge, purchase, or hosted load test is part of this evidence.

## Workload and environment

The isolated local feature lab uses real Next development servers, PostgreSQL 16, GoTrue authentication, and Redis 7 rate-limit counters. Two hundred distinct synthetic learner accounts have real memberships and enrollments in the F16 published course. Each learner refreshes its session, reads identity/course/lesson data, saves progress, reads it back, and pauses 20 seconds before repeating. Each actor runs one journey at a time. This closed-loop model measures achieved throughput and concurrent active sessions; it does not promise a fixed arrival rate.

The profile uses a two-minute warmup with 100 actors, 15 minutes with 100 actors, a five-minute burst with 200 actors, and a 7,200-second endurance phase with 100 actors. Setup/login/enrollment are measured separately. Local gates are zero unexpected functional errors, request p95 at most 1,000 ms, and journey p95 at most 3,000 ms. These are local test gates, not a replacement for the deployed service's SLOs. Histogram percentiles are conservative bucket bounds, approximately 1% or 1 ms above observed values.

The fixture edge binds only loopback and requires a private test token. It strips caller forwarding headers and assigns each actor a distinct benchmark address. The application retains its authentication, tenant scope and Redis rate limits. This does not test a school or office where many learners share one public IP; that traffic pattern needs a separate acceptance test.

Host: Intel i7-11370H, eight logical CPUs, approximately 15.8 GiB RAM. Web and API run on the same Windows workstation as the load generator and Docker. API pools are capped at 20 tenant connections, 10 platform connections and two usage connections. Redis has a 256 MiB / one-CPU container limit. PostgreSQL uses the existing isolated fixture configuration. This is not representative production hardware or a deployed production build.

## Results

The corrected run finished at **13:20:30 UTC on 26 September 2026**. All 200 accounts logged in and enrolled successfully during setup. The table includes completed HTTP attempts, including failures and session refreshes. Latency columns use **all-attempt** histogram bounds, not only successful requests.

| Phase     | Planned learners / duration | Learners completing duration | Requests / failures | Failure rate | Request p95 / p99 | Journey p95 | Result                                         |
| --------- | --------------------------- | ---------------------------: | ------------------: | -----------: | ----------------- | ----------: | ---------------------------------------------- |
| Warmup    | 100 / 2 min                 |                          100 |           1,129 / 0 |           0% | 10.17 / 10.91 s   |     41.50 s | Excluded from sizing                           |
| Sustained | 100 / 15 min                |                          100 |           8,194 / 1 |       0.012% | 10.80 / 12.17 s   |     47.71 s | Failed error and latency gates                 |
| Burst     | 200 / 5 min                 |                          194 |         2,844 / 475 |       16.70% | 23.99 / 29.87 s   |     88.46 s | Failed coverage, error and latency gates       |
| Endurance | 100 / 120 min               |                           98 |        71,204 / 420 |       0.590% | 11.70 / 14.86 s   |     54.85 s | Failed coverage, error, latency and continuity |

The endurance clock ran from **11:20:30.602 to 13:20:30.621 UTC**, with monotonic elapsed time **7,200,018.7 ms**. All 100 learners were active through the minute-110 checkpoint; 98 remained at minute 111 after two session refresh failures. Only 98 completed the duration, so `durationCompleted` is correctly false. The burst lost six learners following refresh failures. No shorter test or earlier aborted attempt was counted toward endurance. Progress was captured every minute; the largest endurance gap was 60.020 seconds. This is sampled coverage, not continuous per-instant proof.

The harness stops in-flight work at phase deadlines. It records 99 cancelled requests in sustained and 123 in burst separately from completed-attempt error rates; these are not claimed as successes. Endurance had no cancelled requests. Achieved request throughput was 9.10/s sustained, 9.48/s burst and 9.89/s endurance. Doubling the learners did not materially increase throughput in this environment.

**Four automatic development-server memory-threshold restarts** occurred during endurance, at 11:56:58, 12:26:10, 12:47:33 and 13:10:58 UTC. There were no manual service restarts or application-source changes during the corrected measurement. The maximum sampled API resident memory was approximately **4.39 GiB**, and private committed memory approximately **4.55 GiB**, across separate process lifetimes. These are not V8 heap measurements or proof of an operating-system out-of-memory kill. Next development-mode behavior cannot establish a production memory leak. Resource samples outside each recorded process lifetime were excluded, including one sample from a reused process ID.

The generator's late sample recorded 208 CPU-seconds over approximately 8,553 elapsed seconds (about 2.4% of one core on average), with a reported lifetime resident-memory peak of about 162 MiB. This does not prove absence of short CPU spikes, host-wide contention or network limits. Builds and heavy verification did not overlap the corrected measured phases.

**Usage persistence is a separate correctness blocker.** The bounded log scan counted **26,492 terminal `usage_meter.persistence_failed` events**: 364 in warmup, 2,454 sustained, 1,080 burst and 22,594 endurance. These occur after the recorder's retry path is exhausted. They are failure-log counts, not a database reconciliation of distinct permanently missing records; ambiguous commits and deduplication were not investigated. The service cannot claim reliable usage accounting from successful HTTP responses. The scan also counted 451 structured route failures and four untimed restart warnings; route-log counts do not cover every observed HTTP failure and are not substituted for client measurements.

Machine-readable [load results and summary](audits/2026-09-26/performance/load-summary.json), [error counts](audits/2026-09-26/performance/error-summary.json), [pool telemetry](audits/2026-09-26/performance/pool-telemetry.json), minute progress, resource observations and restart records are saved in the dated audit directory. Approximate half-hour counter deltas retain their actual sample boundaries; they do not invent interval latency percentiles. The source snapshot's 73 captured source/test/configuration files all matched their final hashes.

The first 100-actor trial was stopped at 10:47:54 UTC after revealing transaction pool starvation. At the first measured minute, 121 of 409 requests had returned HTTP 500 (29.6%). Successful-request p95 was 12,670 ms; only 28 of 149 journeys succeeded. Cumulative process telemetry recorded 371 connection-acquisition errors. The endpoint nested a tenant transaction inside a global transaction using the same 20-connection pool. This failed, incomplete attempt is retained separately; none of its elapsed time counts toward the corrected endurance run.

The initial two-actor canary completed without unexpected errors. After restarting services, a second canary also had zero functional errors, but burst request p95 was 1,236.8 ms while a production build was running. That gate failure is retained as preflight evidence; it is not a capacity measurement.

Bundle results and final verified bytes are recorded separately in [the learner bundle evidence](audits/2026-09-26/learner-bundle/README.md). The reduction is approximately 28%; the 150 KiB goal remains open.

## Corrections made

- The load harness now supports the actual two-hour phase, removes the former request-count truncation, bounds latency storage, refreshes sessions, and verifies elapsed duration and completed journeys for every required actor. Functional and latency acceptance are reported separately. Partial or failed runs cannot certify capacity.
- The canary exposed a Redis startup race: the first command could execute before connection readiness with offline queuing disabled. Requests now share a readiness wait bounded at two seconds before their own atomic counter command. Failures still reject requests; rate-limit budgets, offline-queue settings and command timeout remain unchanged.
- The 100-actor run exposed nested same-pool transactions in `/api/v1/me`. Authentication now happens before checkout, and the global identity transaction finishes before the tenant transaction starts. Review found the same nesting in tenant login; password verification now happens without holding a connection, and atomic principal statements and tenant membership work use separate transactions. Principal mirror updates can therefore persist if later membership work fails, while no success cookies are issued for a failed route. This preserves the independent identity mirror and tenant transaction boundary. No pool size or timeout was raised to conceal the failure.
- Optional analytics and diagnostic identity UI are loaded only when needed. Consent, cancellation, failure/retry and retained diagnostic state have focused regressions. The bundle ceiling is reduced against the previously committed baseline only after a completed production build.
- Local telemetry streams large logs and retains only bounded, sanitized pool snapshots. The service launcher has bounded owned-process-tree cleanup on Windows. Process identities will also be checked before the task's final cleanup.

## Scope limits and remaining acceptance

The workload uses one small, hot synthetic course and a constant representable progress value. It does not cover quiz submission, SCORM playback, large uploads, exports, worker throughput, varied tenant/course sizes, cold database caches, geographically distributed clients, or browser rendering and mobile responsiveness. Simulated distinct client addresses do not demonstrate behavior behind shared NAT.

Hosted acceptance requires the actual staging API/web/worker infrastructure, representative synthetic data, production artifacts, provider telemetry, network conditions, and the same full-duration workload. A local pass would not close that requirement. Pool snapshots are cumulative process observations, not phase-isolated deltas. Point-in-time queue counts do not prove worker execution. Database and Auth fixture data are synthetic; credentials remain in ignored local files and are excluded from published evidence.

## Next changes supported by the measurements

The [latency review](audits/2026-09-26/performance/latency-review.md) separates observations from possible causes. Its early snapshot found the 20-connection tenant pool fully occupied with 52 waiters, and the separate two-connection usage pool with 14 waiters and failed acquisition attempts. This establishes contention, but does not identify a single dominant query or prove PostgreSQL execution time caused the delay.

1. Add bounded stage timings for authentication, global identity work, tenant work and awaited usage persistence. Keep identities, credentials, SQL text and parameters out of telemetry. This will determine where the next optimization has the largest effect.
2. Reuse already-authorized projections within the same request and transaction. Source review identified nine repeated reads per complete learner journey. Preserve current membership/permission checks, tenant scope, publication checks and progress locking; do not use cross-request authorization caching as a shortcut.
3. Correct usage-persistence saturation with explicit durability and retry semantics. HTTP success alone does not prove its usage event was saved. An unbounded or fire-and-forget in-memory queue would hide the correctness problem.
4. Compare identical workloads on the intended production runtime and hosting topology. Development query logging and development-server restarts are relevant to this run but cannot establish production throughput or a production memory leak.
5. Continue the measured bundle work: separate notification catalog data from runtime validation imports, narrow role-shell client boundaries, and review Motion/shared-provider cost. The shared framework root alone is 129.2 KiB, leaving about 20.8 KiB of other initial JavaScript under a 150 KiB ceiling. Preserve validation, interaction, accessibility and consent behavior and remeasure browser transfer as well as manifests.

After those corrections, repeat all three capacity phases with unchanged thresholds and a broader workload, including multiple tenants, quizzes, large uploads, exports and workers. A successful build or a completed two-hour clock does not replace error, latency and continuity acceptance.

## Reproduction

Use the isolated F16 stack on database port 15436 and Auth gateway port 54326, plus isolated Redis port 16387. Run `scripts/perf/capacity-fixture.mjs --ack-local-disposable` only when deliberately creating/replacing the private 200-account fixture; reseeding changes its credentials and token. Start `scripts/perf/local-capacity-services.mjs api|web --ack-local-disposable`, then `scripts/perf/local-edge.mjs --ack-local-disposable`. Use the generated private configuration with `scripts/perf/http-workload.mjs`, preloading `scripts/e2e/local-dns.cjs` for process-local name resolution. Confirm the accepted profile and completed build before interpreting measured phases. Do not point fixture tools at hosted databases or publish the private configuration.

## Verification and cleanup

After the load finished, **106 focused application regressions passed across 13 files**, including real local Redis cold-start counters, transaction lifetime, login, MFA, rate limiting, consent and optional-dialog failure behavior. **42 tooling and bundle-guard tests passed**, and the secret guard passed. Commands, timestamps and exit codes are saved in [verification.json](audits/2026-09-26/performance/verification.json). Earlier verification also passed the workspace/API type checks, targeted lint, a completed production frontend build, and the 22-test frontend review set. This is targeted change verification, not a fresh full-repository CI run.

The task-owned API/web/fixture-edge processes and the isolated database, Auth, gateway and Redis containers were stopped after evidence collection. Ports 3100–3102 were checked for remaining listeners. The normal `atlas-postgres` development database on port 15432 remains healthy. Synthetic fixture data and Docker volumes were retained; private credentials/configuration and raw logs remain ignored local artifacts. Public evidence contains no account credentials or raw SQL. Nothing was committed, pushed or deployed by this task.
