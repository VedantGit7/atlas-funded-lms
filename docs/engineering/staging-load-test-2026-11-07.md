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

## Reproducing

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

The raw results, minute-by-minute progress, host and container samples, index and table counters from before and after, and the CPU profile stay on the staging server under `/root/atlas/loadtest/out/results`. They are not committed, because they name the staging host.
