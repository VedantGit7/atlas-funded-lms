# Staging load test — 7 November 2026 (launch plan 5.2)

**Result: no CPU throttling on the Hostinger server, and no errors in about 600,000 requests. 300 active learners are handled within the latency targets once their requests spread out, but 500 at once are not.** The limit is the API: it runs as one Node.js process on one of the server's eight cores and tops out at about 70 to 78 requests a second. The database, Redis and the host all had spare capacity. This run is the baseline for the fixes listed at the end, and a second run is due after them.

## What ran

- **Server:** the staging server (Hostinger KVM 8, Mumbai, 8 vCPU, 32 GB), running build `48d8f4d2` through Coolify. Each app container is limited to 2 CPUs and 2 GB.
- **Load generator:** `scripts/perf/http-workload.mjs` in a `node:24` container on the same server, joined to the app's Docker network. Requests went through the Coolify proxy and the web app to the API over HTTPS, the same path a browser takes, except Cloudflare. The generator used about 2 to 3% of one core.
- **Learners:** 500 synthetic learners (`loadtest-learner-NNN@loadtest.example.test`) and one published course (`load-test-course`) in the staging tenant, created by `scripts/perf/staging-load-fixture.ts`. They are kept for re-runs. Passwords exist only in a mode-600 file on the server.
- **Client addresses:** each learner sends its own address from the RFC 2544 benchmark range (198.18.0.0/15) in `cf-connecting-ip`. This way the per-IP and per-user rate limits apply as they would for 500 separate homes. It does not model a school where every learner shares one address.
- **Journey:** one learner journey is five signed-in requests: identity, course, lesson, progress save, then progress read. Each learner then waits 20 seconds before the next journey (closed loop).
- **Not covered:** quizzes, uploads, exports, worker throughput as a target, and mobile browser metrics.

| Phase     | Learners | Length  | Start (UTC) |
| --------- | -------: | ------- | ----------- |
| Warmup    |      100 | 2 min   | 15:25       |
| Sustained |      300 | 15 min  | 15:27       |
| Burst     |      500 | 5 min   | 15:42       |
| Endurance |      300 | 120 min | 15:47–17:47 |

Pass gates: zero errors, request p95 ≤ 1,000 ms, journey p95 ≤ 3,000 ms, and no host throttling.

## Results

Setup: 500 sign-ins (p95 147 ms) and 500 enrolments (p95 43 ms), with no errors.

| Phase     | Learners | Requests | Errors | Requests/s | Request p50 / p95 / p99  | Journey p95 | Result         |
| --------- | -------: | -------: | -----: | ---------: | ------------------------ | ----------: | -------------- |
| Warmup    |      100 |    3,000 |      0 |       24.7 | 428 / 1,347 / 2,271 ms   |      6.48 s | Not gated      |
| Sustained |      300 |   61,395 |      0 |       68.2 | 213 / 1,989 / 3,729 ms   |     10.17 s | Failed latency |
| Burst     |      500 |   23,600 |      0 |       77.8 | 2,271 / 6,043 / 6,681 ms |     28.42 s | Failed latency |
| Endurance |      300 |  511,600 |      0 |       71.1 | 169 / 587 / 1,050 ms     |      2.81 s | **Passed**     |

Every learner finished every phase. No request was cancelled and no deadline was missed. Every response was a 200. The five request types had nearly identical latency in each phase (endurance p95 551 to 619 ms), so no single endpoint is the problem.

Sustained and endurance had the same 300 learners and the same throughput, yet only endurance passed. In sustained, all 300 learners started together and their requests arrived in waves 20 seconds apart. By the endurance phase they had drifted apart. A 30-second CPU profile was also taken during sustained. A real launch is closer to the wave case, so 300 learners count as the comfortable limit today, not a safe one.

### Host and containers

| Measure (sampled every ~17 s, 465 samples) | Value                                                                                        |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| CPU steal (Hostinger throttling)           | mean 0.19%, max 9%; 2 of 465 samples ≥ 5%                                                    |
| Host idle CPU                              | lowest 49%, usually 60–75%                                                                   |
| Host available memory                      | about 29 GB throughout                                                                       |
| API container CPU                          | mean 100%, max 159% (main thread pinned)                                                     |
| API memory                                 | 398 MiB at start, about 700 MiB from the burst onward, flat for 2 h; 423 MiB idle afterwards |
| Postgres container CPU                     | mean 72%, max 123% (see the worker finding)                                                  |
| Worker CPU                                 | mean 39%, max 94%                                                                            |
| Web CPU                                    | mean 29%, max 70%                                                                            |
| Redis CPU                                  | mean 2%                                                                                      |
| Database connections                       | 27 at most, at most 5 active, no lock waits, no deadlocks                                    |
| Container restarts (API, web, worker)      | 0, 0, 0                                                                                      |

The API logged no error codes, no `usage_meter.persistence_failed` events, and no pool or timeout messages. The web app logged no errors. Docker keeps a limited log, so the scan covers only the most recent part of the run.

### Where the API spends its time

A 30-second CPU profile of the API's main thread was taken during the sustained phase. The main thread was busy 99.9% of the time. As a share of that busy time:

- **Sentry and OpenTelemetry request instrumentation: about 31%.** This runs on every request, even though only 5% of traces are sent.
- Prisma: 14% in Prisma itself, 43% including what it calls.
- Native work: about 20%. This is garbage collection plus writing two log lines per request to stdout.
- The Next.js runtime: 8.5%.
- The `pg` driver: 2.4%.

## Remaining-work item 12

**Unused indexes.** 534 of 778 indexes have never been scanned since the statistics were last reset. Together they take only 5.3 MB. The test exercised only learner flows, so 79 indexes were used. Every index on the tables written most often (`tenant_usage_events`, `lesson_progress`, the outbox tables) was used, except `outbox_delivery_jobs_tenant_state_idx` (128 KB). Dropping indexes in bulk would save almost nothing in writes or space at this size, and it could break admin and report pages that this test did not touch. **Recommendation:** don't drop them now. Review them again after launch, using production statistics from a full month of use.

**Usage-metering writes.** These are confirmed as significant. Each API request adds a row to `tenant_usage_events` (480,169 inserts for about 600,000 requests), and the worker then updates every row as processed (480,140 updates). Processed rows are kept for 30 days. The table grew to 483,337 rows and 136 MB in 2.5 hours, which is most of the 163 MB database. At real traffic this becomes several GB a month of rows that are written twice and read once. Nothing went wrong in this run: the backlog drained to 0 after the test and no persistence failures were logged. **Recommendation:** add up usage per tenant and period in memory, and write one row per process every few seconds. Also keep processed rows for days, not 30 days.

## Other finding: the outbox worker scans its whole history on every cycle

The unique index `outbox_delivery_jobs_event_destination_key` was scanned **51.1 million times** during the run, but only 996 delivery jobs were created.

1. Each worker cycle runs `materializeDeliveryJobs` (`backend/packages/events/src/repositories/outbox-job.repository.ts`) for each of the 12 outbox processors.
2. That query joins every available row in `outbox_events` (all history, which is never pruned) with the processor's subscriptions, and then checks `NOT EXISTS` against `outbox_delivery_jobs` for each pair.
3. During the test, the usage-event backlog kept the worker busy, so it ran about 3 cycles a second (26,102 cycles in total) and repeated that scan each time.

This is why Postgres averaged 72% of a core while the API's own queries were cheap. With 536 outbox events it costs only CPU. The cost grows with total event history, though, so at 100,000 events each cycle would make about 12 × 100,000 index probes. **Recommendation:** mark each event once its jobs exist (or keep a cursor), so materialisation looks only at new events. Also prune outbox events that are fully delivered.

## Recommended fixes, then a second run

1. **Run 3 API processes instead of 1.** Use replicas or a Node cluster, and raise the API container's CPU limit to match. The host was at least 49% idle and the database was barely loaded, so this is the biggest gain.
2. **Stop per-request Sentry tracing on the server.** Set the traces sample rate to 0 or turn the tracing integration off, and keep error reporting. This saves about 30% of API CPU.
3. **Log once per request, not twice.** Drop `route.start` and keep `route.complete`.
4. **Fix the outbox materialisation scan** described above.
5. **Coalesce usage-metering writes** and shorten how long processed usage rows are kept.

After these, repeat the same profile with the same fixture and the same `profile.json`. The target is for both the 300-learner sustained phase and the 500-learner burst to pass.

## What the follow-up changed

1. **Three API processes.** `deploy/managed-node/api-cluster.mjs` starts the Next server as `API_PROCESS_COUNT` processes (3 in `deploy/coolify/compose.yaml`) that share port 3001. It restarts a process that dies, and it exits so that the container restarts if processes keep dying. Each process has a 1 GiB heap. The API container goes from 2 CPUs and 2 GiB to 4 CPUs and 4 GiB. The per-process database pools are smaller, and so are the worker's, so all of them together stay inside PostgreSQL's 100 connections (88 at most).
2. **Server tracing off.** Setting the rate to 0 was not enough, because Sentry turns tracing on whenever `tracesSampleRate` is present at all. The API and web server and edge configs now leave it out unless `SENTRY_TRACES_SAMPLE_RATE` is above 0, and the compose default is now 0. Error reporting is unchanged.
3. **One log line per request.** `route.start` is gone. `route.complete` and `route.failure` now carry the tenant and actor IDs that only the start line had before.
4. **Outbox materialisation window.** Outbox events are append-only by design, so pruning them is not an option. Instead, each worker process keeps, for each tenant and subscription set, the start of the last pass that found nothing more to create. Later passes look only at events that became available after that point, minus a one-hour margin for late commits. The first pass in a process still covers all history, which also picks up a destination added by a deploy.
5. **Usage metering.** The per-request row is kept, because it is written inside the request's own transaction so usage is counted exactly once, and the insert is cheap. What changed is the cost around it:
   - processed rows are kept for 2 days instead of 30, which is still far longer than any retry;
   - the worker drains up to 500 rows a sweep instead of 25, so the drain keeps up with three API processes.

The fixture script and the harness are in `scripts/perf/`. The run used the profile below, plus `pacingMs` 20,000, `setupPacingMs` 250, `timeoutMs` 30,000 and `drainMs` 30,000:

```json
{
  "phases": [
    { "name": "warmup", "users": 100, "seconds": 120 },
    { "name": "sustained", "users": 300, "seconds": 900 },
    { "name": "burst", "users": 500, "seconds": 300 },
    { "name": "endurance", "users": 300, "seconds": 7200 }
  ],
  "slo": { "requestP95Ms": 1000, "journeyP95Ms": 3000 }
}
```

The raw results, minute-by-minute progress, host and container samples, index and table counters from before and after, and the CPU profiles stay on the staging server: run 1 under `/root/atlas/loadtest/out/results-run1`, run 2 under `/root/atlas/loadtest/out/results-run2` run 3 under `/root/atlas/loadtest/out/results-run3`, and the burst profiling run under `/root/atlas/loadtest/out/results`. They are not committed, because they name the staging host.

## Run 2 (8 November, build a9975de1)

Run 2 used the same fixture, profile and pacing as run 1, on the build with the changes above.

| Phase     | Learners | Requests | Request p95 (run 1) | Journey p95 (run 1) |          Errors | Result         |
| --------- | -------: | -------: | ------------------: | ------------------: | --------------: | -------------- |
| Warmup    |      100 |    3,000 |   816 ms (1,347 ms) |              3.77 s |               0 | not counted    |
| Sustained |      300 |   66,580 |   478 ms (1,989 ms) |    2.67 s (10.17 s) |               0 | **pass**       |
| Burst     |      500 |   32,683 | 1,621 ms (6,043 ms) |      7.1 s (28.4 s) | 1,376 (all 429) | fail           |
| Endurance |      300 |  532,850 |     191 ms (587 ms) |     0.91 s (2.81 s) |   300 (all 429) | fail on errors |

Setup was 500 logins and 500 enrolments with no errors (login p95 136 ms, enrolment p95 33 ms). No container restarted, and no request failed on the server side.

- **API.** Average CPU was 76–90% of one core in every phase, out of four, and at most about 3.5 cores. Memory peaked at 1.8 GiB of 4 GiB.
- **Database.** PostgreSQL averaged 50% of a core, down from 72%. There were at most 32 connections and 9 active, with no lock waits and no deadlocks.
- **Outbox.** The worker averaged 3% CPU, down from 39%. `outbox_delivery_jobs_event_destination_key` was probed 153,736 times, down from 51.1 million.
- **Usage metering.** 507,730 rows were inserted and 507,494 marked processed, so the drain kept up.
- **Host.** Idle never fell below 32%, and CPU steal averaged 0.17%.

**The 429s came from the tenant ceiling.** Besides each member's own budgets, the code allowed one tenant 4,800 reads and 1,200 writes a minute in total. In the burst, the tenant made about 5,000 reads and 1,260 writes a minute, so about 4% of requests were refused every minute. Run 1 never got there, because it was too slow. The ceiling counts in fixed one-minute windows, so the minute that was still full when the burst ended refused the first request of each of the 300 endurance learners, and endurance had no errors after that.

The ceiling is now a deployment setting with higher defaults: 12,000 reads and 3,000 writes a minute (`TENANT_RATE_LIMIT_READS_PER_MINUTE`, `TENANT_RATE_LIMIT_WRITES_PER_MINUTE`; see `docs/runbooks/rate-limiting.md`).

Even without the 429s, the burst is still over target: request p95 is 1.6 s and journey p95 7.1 s, while the API used well under its four cores. Run 3, on the build with the new ceiling, shows the burst without 429s. If it is still slow, the next step is to profile the API during the burst.

Two smaller findings:

- The API container keeps only 30 MB of logs (`max-size` 10m, `max-file` 3), which at this load is about the last 15 minutes.
- `user_roles_tenant_id_membership_id_role_id_key` was read about five times per request (3.3 million in the run). The authorization lookups are cheap, but they are the most-read index in the database.

## Run 3 (9 November, build 6d6a1911)

Run 3 used the same fixture, profile and pacing, on the build with the higher tenant ceiling (12,000 reads and 3,000 writes a minute).

| Phase     | Learners | Requests | Requests/s | Request p50 / p95 / p99 | Journey p95 | Errors | Result (run 2)                  |
| --------- | -------: | -------: | ---------: | ----------------------- | ----------: | -----: | ------------------------------- |
| Warmup    |      100 |    3,000 |       25.0 | 294 / 654 / 956 ms      |      2.99 s |      0 | not counted                     |
| Sustained |      300 |   66,385 |       73.8 | 33 / 633 / 1,361 ms     |      3.14 s |      0 | fail by 140 ms (pass at 2.67 s) |
| Burst     |      500 |   36,415 |      121.3 | 45 / 1,572 / 2,271 ms   |      8.50 s |      0 | fail (fail, with 1,376 × 429)   |
| Endurance |      300 |  533,415 |       74.1 | 29 / 207 / 371 ms       |      1.00 s |      0 | **pass** (fail on 300 × 429)    |

Setup was 500 logins (p95 175 ms) and 500 enrolments (p95 40 ms) with no errors. Every one of the 639,215 requests returned 200. No container restarted, and the API and web logs had no error codes, usage-metering failures, pool messages or timeouts.

**The ceiling change worked.** There were no 429s, and the burst completed 11% more requests than in run 2 (36,415 against 32,683).

**The burst is still slow, and the slowness is a tail, not the typical request.** Burst median latency was 45 ms, but p95 was 1.6 s. The slow requests bunch up when the number of learners steps up:

- in sustained, the running p95 was 1.28 s after the first 4 minutes and fell to 633 ms by the end;
- in burst, it was 1.85 s after 3 minutes;
- the slowest burst requests were progress read (p95 1.8 s), progress save (1.8 s) and lesson (1.6 s).

Run 2 passed sustained at 2.67 s and run 3 missed it at 3.14 s with nothing changed in that path, so 300 learners starting together sit right at the journey limit.

**The server was not the limit:**

- **Host.** Idle averaged 61% in the burst and never fell below 17%. CPU steal averaged 0.96% over the run (18 of 508 samples at 5% or more, one 42% sample in endurance).
- **API.** CPU averaged 143% in the burst, out of 4 cores across 3 processes, with a peak of 356%. Memory peaked at 1.9 GiB of 4 GiB.
- **Database.** PostgreSQL averaged 89% of a core in the burst and 56% in endurance. There were at most 28 connections and 7 active, with no lock waits and no deadlocks.
- **Worker.** The worker averaged 3–5% CPU. `outbox_delivery_jobs_event_destination_key` was probed 154,088 times, the same as run 2.
- **Usage metering.** 512,015 rows were inserted and 511,727 marked processed, so the drain kept up.

With spare CPU everywhere, the tail looks like requests queueing inside each API process when load steps up. The next step is a CPU profile of the API processes during a short 500-learner burst.

### Burst profile (9 November)

A short run on the same build (warmup 100 for 1 minute, sustained 300 for 3 minutes, burst 500 for 4 minutes) sampled the CPU of each API process and of the web process every second. It also took 30-second CPU profiles of one API process and the web process at the start of the burst. The run had no errors (request p95: sustained 1,319 ms, burst 1,588 ms). Both debugger ports were closed again afterwards.

**The load arrives in waves, and every process is saturated during each wave.** All 500 learners join the burst together and then wait 20 seconds between journeys, so their requests stay grouped. Each wave keeps all three API processes and the web process at 85–120% of a core for about 10 seconds. All four are then nearly idle for about 15 seconds before the next wave. Averaged over the burst, the API processes were at 40–47% and the web at 43%, which is why the container and host averages look like spare capacity. Requests that arrive in the middle of a wave queue behind the others, which is the slow tail. The three API processes shared the load evenly.

**The web app is a second bottleneck.** It runs as one Node process, and every API call passes through it. During each wave it was saturated at the same time as the API, so adding API processes alone would not remove the queueing.

**What each request still costs** (share of busy time in the 30-second profiles):

| Work                                      | API | Web |
| ----------------------------------------- | --: | --: |
| Sentry and OpenTelemetry code (self time) | 13% | 19% |
| Socket writes to PostgreSQL and HTTP      | 15% | 14% |
| Prisma (inclusive)                        | 34% |   — |
| `pg` driver (inclusive)                   | 18% |   — |
| Garbage collection                        |  4% |  7% |

Request tracing has been off since run 2, but Sentry still registers its OpenTelemetry tracer, and so builds an unsampled span for each of Next.js's own spans (`handleOnSpanStart`, `httpHeadersToSpanAttributes`, `uuid4`).

The socket writes are not logging, although the profile names them after the same low-level functions: the logger accounts for almost none of the busy time. In the API, 12% is sending queries to PostgreSQL over TLS and 1% is Redis; in web, it is proxying requests to the API and responses to the browser. Fewer queries per request would cut the API's share, but that is separate work.

**Recommended next changes:**

1. Run the web app as several processes too, as the API does, and give the web container the CPU for them.
2. Stop Sentry registering its tracer on the API and web servers when tracing is off.
3. Repeat the burst. The waves are the harness's worst case: everyone clicks at the same moment, as at the start of a live class or exam. Keep that shape rather than smoothing it, because it is the case a launch has to survive.

### What the burst follow-up changed

1. **Three web processes.** `deploy/managed-node/api-cluster.mjs` is now `server-cluster.mjs` and starts either app: `node server-cluster.mjs <api|web> <entry>`, reading `API_PROCESS_COUNT` and `API_PROCESS_HEAP_MB` or `WEB_PROCESS_COUNT` and `WEB_PROCESS_HEAP_MB`. The API's log lines are unchanged (`api.cluster.*`); web's are `web.cluster.*`. The Coolify compose file runs web as 3 processes with 512 MiB heaps (the heaviest load so far used 370 MiB in its one process), and the web container goes from 2 CPUs to 4, still 2 GB. Web opens no database pools today. It now has small pool settings (2 and 1) so the connection budget holds if a route ever opens one.
2. **No Sentry tracer when tracing is off.** The API and web server configs pass `skipOpenTelemetrySetup: true` unless `SENTRY_TRACES_SAMPLE_RATE` is above 0, so Next.js gets OpenTelemetry's no-op tracer. Sentry keeps each request's scope in OpenTelemetry's context, so the configs still install Sentry's context manager. Without it, a test with two concurrent requests attached one request's tag to the other's error. Error reporting is otherwise unchanged. The worker loads the API's config, so it gets the same change.
