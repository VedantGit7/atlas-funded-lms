# Local endurance latency review — 2026-09-26

The sampled process has business-pool checkout contention and separate usage-pool failures. Source inspection identifies repeated reads and substantial per-request database work. It does not establish which query, host resource, or development-runtime overhead accounts for most latency. No application, service, pool limit, timeout, workload, or SLO was changed during this review.

## Evidence and limits

One bounded streaming pass through `.test-results/performance-2026-09-26/api-1790420063782-5446f468.log` used `poolEvidenceFromFile`; only the latest allowlisted measurements were retained. No SQL text, parameters, credentials, or raw log lines are reproduced. No database probes, builds, tests, or profiler ran for this review.

| Measurement | Tenant pool | Usage pool |
| --- | ---: | ---: |
| Snapshot UTC | 11:02:00.916 | 11:02:02.128 |
| Process PID | 6920 | 6920 |
| Instrumentation uptime | 300,165 ms | 300,337 ms |
| Connections total / idle / waiting | 20 / 0 / 52 | 2 / 0 / 14 |
| Completed acquisition attempts / errors | 4,985 / 0 | 2,578 / 1,589 |
| Acquisition mean / maximum | 1,341 / 4,391 ms | 463 / 1,528 ms |
| Acquisition p95 histogram upper bound | 5,000 ms | 1,000 ms |
| Completed query calls / errors | 47,625 / 0 | 4,936 / 3 |
| Query mean / maximum | 56 / 1,274 ms | 41 / 1,172 ms |
| Query p95 histogram upper bound | 250 ms | 250 ms |

These aggregates are cumulative from process instrumentation startup, including setup and earlier phases. They are not phase deltas or exact percentiles. Acquisition errors are failed attempts, not a count of permanently lost usage records: a subsequent retry may succeed. Query duration includes the checked-out client's queue and application scheduling; it is not PostgreSQL execution time alone. The snapshot cannot determine CPU, disk, database locks, network time, individual query cost, or the proportion of request latency due to each contributor. Timers are scheduling deadlines, so observed elapsed maxima may exceed configured timeout values.

The coordinator reported an early sustained sample with zero HTTP errors, 609 requests, request p95 8,843 ms and journeys around 39 seconds. Those values were not independently reread here. HTTP success does not prove metering success: metering failures are deliberately prevented from replacing business responses. This remains a local development-runtime test, not production capacity verification.

## Repeated work on the measured paths

The harness executes five sequential requests: identity, course detail, lesson detail, progress save, then lesson detail again to verify saved progress. Its 20-second think time starts after journey timing ends. Thus the journey measurement sums five request durations and client processing; it excludes the think time (`scripts/perf/http-workload.mjs:362`).

For a successful existing learner, those five requests each authenticate, resolve tenant/global identity, then acquire a separate tenant transaction. That is ten business-pool checkouts per full journey, plus periodic refresh work. Authentication occurs before checkout, so its network wait does not pin these connections. `session.ts:43` calls remote `getUser` and then `getClaims` each time; this means five `getUser` calls and five claims validations per journey, not necessarily ten network calls. Claims implementation/key caching and auth latency were not measured.

Each request invokes `upsertAuthPrincipal` with `markLogin:false`; the existing-row UPDATE still assigns identity/MFA fields and `updated_at`. Each also invokes `requireActiveMembership`, which executes a membership read, a conditionally effective last-active UPDATE, and an active-day INSERT ON CONFLICT. A no-op write still issues a database command. The ordinary allowed authorization path executes three more sequential reads: permission existence, current override, and role grant. These checks enforce current security state; removing them or caching them across requests is not justified by this evidence.

The following duplicate reads are visible within a single request and the same tenant transaction:

| Request | Repeated read | Source locations |
| --- | --- | --- |
| Identity | Member profile in resource loader and response handler | `backend/apps/api/src/app/api/v1/me/route.ts:28,89` |
| Course detail | Course projection and enrollment in resource loader and service | `backend/apps/api/src/server/courses/load-course-resource-ref.ts:20,33`; `courses.service.ts:124,132` |
| Each lesson detail | Lesson projection and enrollment in resource loader and player service | `load-course-resource-ref.ts:131,33`; `backend/apps/api/src/server/lessons/lessons.service.ts:369,379` |
| Progress save | Lesson projection and enrollment in resource loader and progress service | `load-course-resource-ref.ts:131,33`; `backend/apps/api/src/server/lessons/lesson-progress.service.ts:34,44` |

This identifies nine repeated reads per full five-request journey. They are candidates for explicitly scoped reuse of authorization-loaded projections, retaining tenant/actor checks, publication checks, and transactional correctness. The progress path must retain its enrollment lock and fresh progress read. Reuse is a proposed optimization, not a measured latency improvement.

No per-item SQL loop was found in these measured detail paths. Lesson navigation fetches all published course lesson IDs in one query and finds neighbours in memory; course resume similarly reads course lesson/progress rows. These are result-size scaling concerns, not demonstrated N+1 query loops (`lessons.repository.ts:803,831`). The fixture does not establish performance for large real course outlines. Lesson thumbnails can invoke asset signing while the tenant transaction is held when a thumbnail reference exists; this conditional branch was not proven active by the permitted evidence.

## Usage persistence and development logging

The four generic course/lesson/progress requests await `recordTenantUsage` in `finally`, after business transactions release their connections (`backend/packages/api/src/create-tenant-route.ts:437`). A successful append uses five serial commands—BEGIN, role setup, tenant/context setup, INSERT, COMMIT—on the separate two-connection usage pool. The recorder immediately retries once with the same event ID on failure (`tenant-usage-meter.ts:77`; `backend/packages/db/src/metering-client.ts:70`). Both attempts are awaited before the route promise settles. This adds response time without holding the business pool, and retry attempts add load during contention. The snapshot confirms pressure on this pool; it cannot count terminal persistence failures or isolate retry cost. The special `/me` route does not use this generic metering wrapper.

The business Prisma client enables `query`, `error`, and `warn` logs in development (`backend/packages/db/src/client.ts:33`), and the fixture launcher sends child stdout/stderr to its log file (`scripts/perf/local-capacity-services.mjs:256`). Query serialization/output is therefore a real additional activity in this configuration. The 47,625 instrumented query calls are not a measured log-line count. No CPU/disk profile or controlled logging comparison was taken, so attributing the observed delay to query logging alone would be unsupported.

## Follow-up after the unchanged run

1. Preserve this run's failed latency gates and metering evidence. Add bounded route-stage timings for authentication, global checkout/work, tenant checkout/work, and awaited usage persistence to a subsequent run, without recording SQL or identities.
2. Remove the nine duplicate reads through a typed, request-scoped projection contract; validate authorization revocation, cross-tenant denial, publication changes, progress locking and response behavior. Compare identical fixed workload/SLOs afterward.
3. Evaluate consolidation of activity and authorization round trips while keeping fresh permission/deny state and activity semantics. Avoid simply raising pool limits or weakening timeouts to obscure saturation.
4. Treat terminal usage persistence failures as a separate correctness/durability follow-up. Design bounded durable ingestion or batching only with explicit acknowledgement/retry semantics; fire-and-forget memory buffering is not an equivalent fix.
5. Run a controlled development query-logging comparison after this measurement, then repeat on an accurately configured production runtime. Hold fixture, hardware, concurrency, pacing, phase lengths and SLOs constant, and disclose each runtime/configuration difference.
