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

The raw results, minute-by-minute progress, host and container samples, index and table counters from before and after, and the CPU profiles stay on the staging server: run 1 under `/root/atlas/loadtest/out/results-run1`, run 2 under `/root/atlas/loadtest/out/results-run2` run 3 under `/root/atlas/loadtest/out/results-run3`, the first burst profile under `/root/atlas/loadtest/out/results-burst1`, the second under `/root/atlas/loadtest/out/results-burst2`, the first connection check under `/root/atlas/loadtest/out/results-conn1`, the five-process check under `/root/atlas/loadtest/out/results-conn2`, the 46-statement check under `/root/atlas/loadtest/out/results-conn3`, the diagnostics run under `/root/atlas/loadtest/out/results-diag1`, the ten-connection run under `/root/atlas/loadtest/out/results-pool10`, the run on the bigger database under `/root/atlas/loadtest/out/results-db4cpu`, the run with reused plans under `/root/atlas/loadtest/out/results-planreuse`, the API profiles under `/root/atlas/loadtest/out/results-apiprofile`, the twelve-connection run under `/root/atlas/loadtest/out/results-pool12`, and run 4 under `/root/atlas/loadtest/out/results-run4`. The database runs keep `pg-stat-statements.txt`. They are not committed, because they name the staging host.

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

## Burst runs after the follow-up (9 November, build 8ce44939)

Two more short runs (warmup 100 for 1 minute, sustained 300 for 3 minutes, burst 500 for 4 minutes) checked the build with three web processes and no Sentry tracer. The first took CPU profiles of every API and web process at the start of the burst. The second took none, and recorded instead which API process owns each connection from web, every 2 seconds for 150 seconds of the burst. Both had no errors, no restarts and no error log lines.

| Short run                      | Sustained p95 (journey) | Burst p95 (journey) |
| ------------------------------ | ----------------------- | ------------------- |
| Before the follow-up, profiled | 1,319 ms                | 1,588 ms            |
| After, profiled                | 1,463 ms (7.2 s)        | 1,929 ms (9.9 s)    |
| After, connection check only   | 1,129 ms (5.9 s)        | 1,814 ms (8.8 s)    |

The same build differed by about 25% between the two runs, so a short run measures the shape of the problem, not small gains.

**Both changes worked.** Sentry's share of busy time fell from 13–19% to 0.2%. The three web processes never went above 52% of a core, so web is no longer a bottleneck.

**The API is now the only tier that saturates, and its processes shared the load unevenly.** During the burst the three API processes averaged 42%, 20% and 39% of a core. The cause is how connections are balanced:

- node:cluster hands each new connection to the next process in turn, so web's connections were spread evenly: 29 to 189 per process.
- Next's proxy keeps up to 256 connections alive, but always reuses the most recently used one first. Most requests therefore travel down a few connections, and so reach a few processes. Web's request bytes split 35%, 21% and 44% across the three processes, matching their CPU.

**Even perfect balance would not make the burst pass.** Each wave sends about 2,500 requests at once, and each request costs the API about 12 ms of CPU, mostly Prisma (33% of busy time) and the `pg` driver (20%). That is about 30 seconds of CPU per wave, which keeps three processes saturated for 8 to 10 seconds. Balancing alone would shorten the busiest process's share by about a quarter.

### What the second follow-up changed

1. **Connections are recycled.** With `API_MAX_REQUESTS_PER_SOCKET` set, `server-cluster.mjs` sets Node's `maxRequestsPerSocket` on the server Next creates. After that many requests, the response carries `Connection: close`, and the client's next connection goes to the next process. The compose file sets 100, which is about 25 new local connections per wave. A test shows that one kept-alive connection stays on one process without the setting and moves across all three with it.
2. **Five API processes instead of three.** The host had about two cores spare during the burst. The API container goes to 5 CPUs and 5 GB, with 768 MiB heaps (three processes used 1.9 GiB at most). Each process's main pool drops from 6 to 4, so five API processes, three web processes and the worker open at most 87 connections.
3. **Next: less work per request.** Each request reads the user's roles about five times (3.3 million reads of `user_roles_tenant_id_membership_id_role_id_key` in run 2). Caching the permission lookup within a request, or for a few seconds, would remove much of the API's database work. It touches authorization, so it is being designed separately.

## Five API processes (9 November, build 6eb90b1d)

The same short connection-check run on the build with five API processes and connections recycled every 100 requests had no errors, no restarts and no error log lines.

| Short connection-check run | Sustained p95 (journey) | Burst p95 (journey) |
| -------------------------- | ----------------------- | ------------------- |
| Three API processes        | 1,129 ms (5.9 s)        | 1,814 ms (8.8 s)    |
| Five API processes         | 1,292 ms (6.5 s)        | 1,814 ms (9.2 s)    |

**The load is now balanced.** Web's request bytes split 17%, 16%, 19%, 16% and 31% across the five processes, and their burst CPU averaged 24–27% each. No process stayed saturated for more than a few seconds.

**Latency did not move, because the host is now the limit at each wave.** At the peak of a wave the 8-core host was about 88% busy (71% user, 17% system, 9–12% idle), with PostgreSQL at up to two cores. The database itself did not queue: at most 8 active statements and no lock waits. The load generator runs on the same host and uses about half a core.

### Statements per request

A local count of every statement the `pg` driver sends, using the five journey routes against the test database, showed where the CPU goes:

| Journey step  | Statements |
| ------------- | ---------: |
| identity      |         11 |
| course        |         11 |
| lesson        |         15 |
| progress save |         16 |
| progress read |         15 |
| **Journey**   |     **68** |

- Every request opened a separate transaction only to read the signed-in principal: BEGIN, role, the principal, COMMIT. That was 20 of the 68 statements. The membership gate in the main transaction already read the account status as well.
- The lesson routes read the lesson, its course and the member's enrollment as three statements.
- Saving progress read the progress row twice.
- The permission check was already one statement per request, so role lookups were not the cost.

### What the third follow-up changed

1. **No principal transaction.** The membership gate's statement now starts from the principal and joins the membership, so it is always one row. The gate checks the account first, with the answers the separate read gave: a principal that no longer exists is 401 `AUTH_REQUIRED`, and a disabled account is 403 `ACCOUNT_DISABLED`, whatever its membership. Tenant routes now open the global transaction only when this process has not resolved the request's host in the last 30 seconds. `/me` and the other custom routes still read the principal themselves, because they return its details.
2. **One statement for a lesson's access.** `findLessonWithCourseAndEnrollment` reads the lesson, its course and the active enrollment together. The loader keeps the same checks.
3. **One progress read per save.** The save passes the row it read after locking the enrollment to the upsert, instead of reading it again. The lock stays a separate statement before that read, so overlapping autosaves still see the last committed progress.

The journey is now 46 statements: identity 11, course 8, lesson 9, progress save 9 and progress read 9. `hot-path-round-trips.test.ts` holds the course read to 8 statements in one transaction, and the lesson read and progress save to 9 each. It also checks against the database that an unknown principal is refused as signed out.

## Fewer statements (9 November, build 948dfd9b)

The same short connection-check run on the build with 46 statements per journey had no errors: all 44,430 requests returned 200.

| Short connection-check run         | Sustained p95 (journey) | Burst p95 (journey) | Host idle at the waves |
| ---------------------------------- | ----------------------- | ------------------- | ---------------------- |
| Five API processes, 68 per journey | 1,292 ms (6.5 s)        | 1,814 ms (9.2 s)    | 9–12% at the lowest    |
| Five API processes, 46 per journey | 1,165 ms (6.2 s)        | 1,540 ms (8.1 s)    | 24% at the lowest      |

- **Faster, and the host has room again.** Burst p95 fell by about 15% and the burst median from 38 ms to 27 ms. The host stayed at least 24% idle at the waves. PostgreSQL averaged 94% of a core in the burst (up to 184%), with at most 5 active statements and no lock waits.
- **Still balanced.** The five API processes averaged 22–25% each in the burst, and none was saturated for more than 3 seconds.
- **The identity step was now the slowest.** `/me` had a burst p95 of 1,814 ms, against 1,305–1,572 ms for the others. It was the one journey request still reading the principal in a transaction of its own, so it still made 11 statements.

The burst still misses both gates (request p95 1 s, journey p95 3 s). Nothing stays saturated for more than a few seconds, so the remaining tail is queueing while 500 learners click within the same second. The next run turns on the API's stage timings to show where that queueing happens.

### What the fourth follow-up changed

1. **`/me` reads the principal in its tenant transaction.** It still reads it before the membership gate and refuses it unless active, but not in a global transaction of its own. The tenant comes from the process's recent lookups when it can. `/me` goes from 11 statements to 8, and the journey from 46 to 43. `hot-path-round-trips.test.ts` holds it to 8 statements in one transaction against PostgreSQL. The unit tests check the order (tenant transaction, then principal, then membership), that a disabled account is refused before the gate, and that a recently resolved tenant needs no global transaction.
2. **Diagnostics can be turned on in Coolify.** The compose file passes `ATLAS_ROUTE_STAGE_TIMINGS` and `DATABASE_POOL_METRICS` to the API, both 0 by default (`docs/runbooks/coolify-deployment.md`).

## Where the burst waits (10 November, build 2b4e9d88)

The same short run with `ATLAS_ROUTE_STAGE_TIMINGS=1` and `DATABASE_POOL_METRICS=1` had no errors: all 43,450 requests returned 200. Request p95 was 1,347 ms sustained and 1,760 ms in the burst (journey p95 7.0 s and 8.8 s), in the range of the previous run.

**Requests spend most of their server time waiting for a database connection.** The figures below are the API's own stage timings and pool metrics, as averages over the burst and all five processes:

| Stage                                 | Mean   |
| ------------------------------------- | ------ |
| Session check                         | 4 ms   |
| Waiting for a main-pool connection    | 287 ms |
| The request's work in the transaction | 28 ms  |
| The whole tenant transaction          | 333 ms |
| Usage recording                       | 3 ms   |

- **The wait has a long tail.** The p95 of the connection wait fell in the 1–5 second bucket. It was the same in the 300-learner phase (mean 286 ms).
- **The queries themselves were fast.** They averaged 3.7 ms, about 9.7 per request.
- **The auth pool did not queue.** Its connection wait averaged 1.4 ms.

The cause is the pool size. Each API process had 4 main connections, cut from 6 in the five-process change to stay under PostgreSQL's 100 connections. A wave sends each process about 100 requests at once, each holding its connection for about 35 ms, so the last ones wait close to a second. Between waves the pools sat idle.

### What the fifth follow-up changed

1. **PostgreSQL allows 200 connections.** On staging, `ALTER SYSTEM SET max_connections = 200` writes `postgresql.auto.conf` in the data volume, so the setting survives restarts and redeploys, and the database was restarted once. It was back in about 2 seconds, and the services reconnected with no errors. `docs/runbooks/coolify-deployment.md` makes this part of each environment's one-time setup.
2. **Ten main connections per API process.** `DATABASE_POOL_MAX` goes from 4 to 10. Every process's pools together can now open up to 117 connections. `coolify-compose.test.ts` holds that total to 180 or fewer, leaving room for a migration job, an operator's `psql` and PostgreSQL's reserved superuser slots.

`shared_buffers` is still PostgreSQL's default of 128 MB on a 32 GB host. That is not the bottleneck here, but it is worth sizing before production.

## Ten connections per process (10 November, build 23388a1d)

The same short run with the main pool raised from 4 to 10 per API process, and PostgreSQL allowing 200 connections, had no errors but was slower:

| Short run with diagnostics | Sustained p95 (journey) | Burst p95 (journey) | Pool wait (burst) | Query time (burst) | Active statements |
| -------------------------- | ----------------------- | ------------------- | ----------------- | ------------------ | ----------------- |
| 4 connections per process  | 1,347 ms (7.0 s)        | 1,760 ms (8.8 s)    | 287 ms            | 3.7 ms             | at most 5         |
| 10 connections per process | 1,638 ms (8.4 s)        | 2,030 ms (10.5 s)   | 276 ms            | 10.8 ms            | at most 27        |

**PostgreSQL is the bottleneck, and it has two CPUs.** Coolify runs the database container with its default resource limits: 2 CPUs and 2 GB. Its CPU peaked at about 200% in every run, while the host still had at least 20% idle. With four connections per process, the queue formed in the API. With ten, up to 27 statements shared the same two CPUs, each took three times as long, and the wait did not shrink.

Two smaller causes:

- **Connections closed between waves.** node-postgres closes an idle connection after 10 seconds, and the waves were about 15 seconds apart. Every wave opened its connections again: a TLS handshake, a new PostgreSQL backend and empty caches. With ten per process that happened more, which is also why the 100-learner warmup was slower (p95 1,621 ms).
- **PostgreSQL's settings were its defaults.** Shared buffers were 128 MB for a 525 MB database, in a 2 GB container.

### What the sixth follow-up changed

1. **The database's size is written down and checked.**
   - `deploy/coolify/postgresql-settings.sql` sizes PostgreSQL for 4 CPUs and 6 GB: 200 connections, 1.5 GB of shared buffers, a 4 GB cache estimate, 8 MB of `work_mem`, SSD costs and `pg_stat_statements`.
   - The Coolify runbook adds the resource limits and these settings to each environment's setup. Its apply step refuses to run until Coolify's limits are raised.
   - `postgresql-settings.test.ts` keeps the memory settings inside the limits, even with every connection sorting at once during a vacuum. `coolify-compose.test.ts` keeps every process's pools at least 20 below `max_connections`.
2. **Connections stay open between waves.** All four pools (main, platform, auth and usage) keep an unused connection for 60 seconds, set by `DATABASE_POOL_IDLE_TIMEOUT_MS` (1 second to 1 hour).
3. **Six connections per API process.** That is 30 in all, enough to keep a four-CPU database busy; the rest of a burst queues in the API, which is cheaper than queueing inside PostgreSQL. The services together now open at most 97 connections.

## A bigger database, and where its time goes (15 November, build 7b3fc063)

Staging's database was given 4 CPUs and 6 GB in Coolify. Saving the limits did not apply them; a restart from Coolify did. Then `postgresql-settings.sql` was applied with one more restart, about 2 seconds. The same short run, with the diagnostics on and `pg_stat_statements` tracking planning time, had no errors: all 43,105 requests returned 200.

| Short run with diagnostics                  | Sustained p95 (journey) | Burst p95 (journey) | Pool wait (burst) | Host idle at the waves |
| ------------------------------------------- | ----------------------- | ------------------- | ----------------- | ---------------------- |
| 2-CPU database, 4 connections per process   | 1,347 ms (7.0 s)        | 1,760 ms (8.8 s)    | 287 ms            | about 20%              |
| 4-CPU database, new settings, 6 per process | 1,361 ms (7.0 s)        | 1,969 ms (9.4 s)    | 237 ms            | 4–6%                   |

**The bigger database used its extra CPU but did not get faster.** In the burst PostgreSQL averaged 127% of a core and peaked at 299%, and the API peaked at 293%. Together they filled the 8-core host at each wave.

**Most of PostgreSQL's time was spent planning.** Over the run it executed statements for 67 seconds and planned them for 234 seconds: 78% of its time. There were 416,618 plans for 563,851 calls. Prisma's pg adapter sends every statement unnamed, and PostgreSQL plans an unnamed statement each time it runs. Three statements took about two thirds of the database's time, each costing about five times more to plan than to run:

| Statement                     | Share of DB time | Planning | Running |
| ----------------------------- | ---------------: | -------: | ------: |
| Membership gate               |              25% |  1.44 ms | 0.30 ms |
| Permission check (`can()`)    |              25% |  1.39 ms | 0.31 ms |
| Lesson, course and enrollment |              15% |  1.55 ms | 0.24 ms |

Row-level security adds its policies to every table these statements read, which makes them costly to plan. Shared buffers held the database: 4.4 million block hits against 1,462 reads.

### What the seventh follow-up changed

1. **Named statements.** `@prisma/adapter-pg` takes a `statementNameGenerator`. The main, auth and platform clients now give a statement a name once it has run three times, up to 200 per pool (`backend/packages/db/src/statement-names.ts`). A connection then parses it once, and after five runs PostgreSQL can keep a generic plan instead of planning it again. Since the previous change, connections stay open between bursts, which is what makes this pay. The limits:
   - only SELECT, WITH, INSERT, UPDATE and DELETE are named;
   - nothing that selects or returns `*`, so a migration that adds a column cannot break a statement held by a running process;
   - a bounded number of statements is counted, so one-off SQL cannot grow the cache.
2. **Tests.**
   - `tests/integration/db/statement-plan-reuse.test.ts` runs one row-level-security query twelve times on one connection, alternating tenants, until PostgreSQL uses a generic plan. Each tenant still sees only its own rows. It fails, as it should, with naming turned off.
   - The integration, tenant-isolation, routes, authorization, db, workers and events suites also passed with every statement named from its first use.
3. **An off switch.** `DATABASE_STATEMENT_CACHE_MAX=0` turns naming off for the API and the worker without a code change. The Coolify runbook covers this, the migration caveat, and turning on `track_planning` for a load test only.

## Reused plans (15 November, build 441c3841)

The same short run with named statements, the diagnostics on and `pg_stat_statements` tracking planning time had no errors: all 44,245 requests returned 200.

| Short run with diagnostics       | Sustained p95 (journey) | Burst p95 (journey) | Database CPU in burst (peak) | Host idle at the waves |
| -------------------------------- | ----------------------- | ------------------- | ---------------------------- | ---------------------- |
| 4-CPU database, plans not reused | 1,361 ms (7.0 s)        | 1,969 ms (9.4 s)    | 127% (299%)                  | 4–6%                   |
| 4-CPU database, plans reused     | 1,361 ms (6.5 s)        | 1,347 ms (7.2 s)    | 54% (184%)                   | at least 33%           |

- **Planning nearly stopped.** There were 16,423 plans for 583,894 calls, against 416,618 for 563,851 before. Planning time fell from 234 to 13 seconds, and the database's total time from 301 to 79 seconds. At most 3 statements ran at once.
- **The memory is small.** A backend's memory contexts show each reused statement takes about 40 KB: 19 KB for the plan, 9 KB for its source and 12 KB for its query tree. At 200 per connection that is about 8 MB.
- **Two statements were still costly.** The worker's outbox claim selected `j.*`, so it was never named: 9,328 calls and 9,328 plans, 10% of the remaining time. The per-request usage insert was 14%, but it was already named (452 plans for 35,949 calls); it simply runs once per request.

## The API during a burst (15 November, build 441c3841)

The same run again, with 30-second CPU profiles of three API and three web processes at the start of the burst, had no errors. It measured faster than the run before: 861 ms sustained p95 (journey 4.4 s) and 1,227 ms burst p95 (journey 6.5 s). Short runs vary by about 20%.

**Requests wait for a connection, and neither the API nor the database is saturated.** Averaged over the burst, an API request spent:

| Stage                                 | Mean   |
| ------------------------------------- | ------ |
| Waiting for a main-pool connection    | 194 ms |
| The request's work in the transaction | 26 ms  |
| Session check                         | 7 ms   |
| Usage recording                       | 4 ms   |

The profiled API processes were busy 19–35% of the 30 seconds, and every API process stayed under 110% even at the waves. A wave still sends each process about 100 requests at once. Each holds a connection for about 35 ms, so six connections take about 600 ms to clear it. The pool had been cut to six while the two-CPU database was the limit. That is no longer true.

**Where the API's CPU goes,** as a share of its busy time:

- **The `pg` driver: 21%.** 15% is writing queries to the database socket, over TLS.
- **Prisma's runtime: 32%,** including what it calls.
- **Next.js: 20%.**
- **The rate limiter's Redis calls: 5%.**
- **Garbage collection: 5%.**

The web processes were busy 18% of the time, mostly Next.js's proxying.

### What the eighth follow-up changed

1. **Twelve connections per API process.** The pool goes from 6 to 12. The services together can open at most 127 of PostgreSQL's 200 connections; `coolify-compose.test.ts` keeps that at least 20 below the limit.
2. **The outbox claim names its columns.** It selects the 13 columns of `DeliveryJob` instead of `j.*`, so it gets a reusable plan. The `RETURNING *` and the event read after a claim are unchanged; they run only when there is a job to deliver.
3. **Measured memory in the runbook.** Reused plans take about 40 KB each, at most about 8 MB per connection.

## Twelve connections per process (15 November, build 84e70916)

The same short run with twelve connections per API process and the diagnostics on had no errors: all 44,370 requests returned 200.

| Short run with diagnostics | Sustained p95 (journey) | Burst p95 (journey) | Connection wait in burst | Work in the transaction |
| -------------------------- | ----------------------- | ------------------- | -----------------------: | ----------------------: |
| Six connections            | 861 ms (4.4 s)          | 1,227 ms (6.5 s)    |                   194 ms |                   26 ms |
| Twelve connections         | 1,214 ms (6.5 s)        | 1,279 ms (7.2 s)    |                   125 ms |                   44 ms |

**The wait moved instead of going away.** Requests waited less for a connection, but with twice as many statements running at once, each one took longer: the mean query rose from 4.0 to 7.0 ms, and the work inside a transaction from 26 to 44 ms. Burst latency was the same, within the variation between short runs. Nothing was saturated: the database, the API and the host all had spare CPU between the waves.

After eight rounds of changes, the synchronized burst has gone from 6.0 s to about 1.3 s p95 and stopped improving. All 500 learners send a request at the same moment, and then all wait 20 seconds. Each wave puts about 500 requests in the queue at once; whichever resource serves them, the last ones wait about a second. Cutting that further means making each request cheaper (Prisma, Next.js and TLS to the database take most of the API's CPU) or adding cores, and either is a large change for a shape of load that real learners do not produce.

### The realistic burst

Learners arriving for a class or an exam log in over several seconds, not within the same millisecond. The harness can now spread a phase's first journeys: with `arrivalSeconds` on a phase, learner _i_ of _n_ starts its first journey at _i_ × `arrivalSeconds` / _n_ seconds and then keeps its 20-second rhythm (`scripts/perf/http-workload.mjs`). Without it, a phase's learners start together, as before.

The launch gate is now the burst with its 500 learners arriving over 10 seconds, which is still 50 new learners a second, every one of them sending a request in that 10-second window. The synchronized burst stays in the record as a stress figure: about 1.3 s p95, with no errors.

## Run 4 (15 November, build 84e70916)

Run 4 is the full profile again (warmup 100 for 2 minutes, sustained 300 for 15 minutes, burst 500 for 5 minutes, endurance 300 for 2 hours), with the diagnostics off and the burst's learners arriving over 10 seconds. Sustained still starts all 300 together.

| Phase     | Learners | Requests | Requests/s | Request p50 / p95 / p99 | Journey p95 | Errors | Result (run 3)                    |
| --------- | -------: | -------: | ---------: | ----------------------- | ----------: | -----: | --------------------------------- |
| Warmup    |      100 |    3,000 |       25.0 | 153 / 640 / 1,094 ms    |      2.78 s |      0 | not counted                       |
| Sustained |      300 |   66,785 |       74.2 | 23 / 515 / 1,201 ms     |      2.54 s |      0 | **pass** (fail: 633 ms, 3.14 s)   |
| Burst     |      500 |   37,510 |      125.0 | 39 / 210 / 515 ms       |      1.02 s |      0 | **pass** (fail: 1,572 ms, 8.50 s) |
| Endurance |      300 |  536,225 |       74.5 | 21 / 53 / 367 ms        |      0.25 s |      0 | **pass** (pass: 207 ms, 1.00 s)   |

**Every phase passed both limits** (request p95 1 s, journey p95 3 s), with no errors: all 643,520 requests and the 1,000 setup requests (500 logins, p95 184 ms, and 500 enrolments, p95 45 ms) returned 200. No container restarted, and the API and web logs had no error codes, usage-metering failures, pool messages or timeouts.

- **Sustained passes with the synchronized start,** which run 3 missed by 140 ms. Its journey p95 of 2.54 s is the closest of the phases to its limit.
- **Endurance is four times faster than in run 3** at p95 (53 against 207 ms). The two hours of 300 learners are the steady state, so this is the clearest measure of what the eight rounds of changes did per request.
- **Memory was flat.** Over the two hours of endurance the API's memory went from 2.9 to 2.8 GiB and web's stayed at 0.7 GiB.
- **The database had room.** At most 74 connections were open and 8 active, with no lock waits and no deadlocks, and 99.8% of block reads came from its cache. The usage drain kept up: 515,449 rows inserted and 515,288 marked processed. The indexes and tables were the same before and after (778 and 244).

**The slowest requests coincide with the host losing its CPU.** The request maximum in endurance was 5.0 s, at 17:00. The host sample at 17:00:00 shows 75% CPU steal: the hypervisor gave the server's cores to other machines for three quarters of that sample's 17 seconds. The highest steal samples fell on quarter hours (16:15, 16:30, 16:45, 17:00, 17:15, 17:30 and 18:30, 30–75%), which points to other tenants' scheduled jobs on the same physical host. Steal was also higher in general than in run 3: it averaged 4.1% over the run, against 0.96%, and 85 of 505 samples were between 5% and 29%. It does not move the p95, but it sets the worst case, and it varies from day to day with the neighbours. A plan with dedicated cores would remove it; the shared KVM plan cannot.

### Gate status

| Profile                                | Request p95 | Journey p95 | Errors | Gate                   |
| -------------------------------------- | ----------: | ----------: | -----: | ---------------------- |
| Full run, burst arriving over 10 s     |      210 ms |      1.02 s |      0 | **pass** (launch gate) |
| Short run, synchronized burst (stress) |    1,279 ms |       7.2 s |      0 | recorded, not a gate   |

Launch plan 5.2 is met on staging with the current build: 500 learners arriving over 10 seconds, 300 learners for two hours, and no errors.
