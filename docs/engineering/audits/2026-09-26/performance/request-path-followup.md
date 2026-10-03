# Request-path corrections after the failed capacity run

The failed capacity results in `latency-review.md` remain the baseline. These changes remove identified repeated reads and add measurements; unit-test success is not evidence that request or journey latency meets the capacity gates.

## Request-local projection reuse

The identity profile, course detail, lesson detail and progress-save paths reuse projections already loaded for the resource authorization decision. A private typed weak map accompanies each resource object; it is not serialized into that resource or a response. Reuse requires the exact transaction and request-context objects, the same tenant and actor, and the expected resource ID. Calls without this matching evidence retain their ordinary repository reads. Each new resource load still reads the database. Authorization results are never cached.

This removes nine repeated repository reads in the measured five-request learner journey: one profile read, two course/enrollment reads, and two lesson/enrollment reads on each of the two lesson views and the progress save. Course reads performed by the lesson's parent-resource loader remain. Publication and tenant checks still execute against the request's loaded projection. A new request reloads publication and enrollment state; this is an authorization-time snapshot within the request, not cross-request caching.

The fresh membership, permission existence, permission override, role grant, entitlement, rate-limit and session-MFA checks remain in the pipeline. Progress saving still acquires the active enrollment row lock, verifies that the enrollment remains active after waiting, then reads progress and performs the existing completion/event logic. No progress snapshot or lock is reused.

## Optional bounded stage timing

Set `ATLAS_ROUTE_STAGE_TIMINGS=1` on the API process to collect stage observations on the generic protected tenant routes and `/api/v1/me`. With the flag unset, calls proceed without creating a collector. There is no background timer, additional database query or connection.

The collector emits `route.stage_timings` at most once per minute per collector/process, when a stage completes. Each record contains cumulative counts, errors, duration sums, maxima and twelve fixed histogram buckets for six fixed labels: `authentication`, `global_total`, `global_work`, `tenant_total`, `tenant_work` and `usage`. The final bucket has a null upper bound and represents overflow. Storage does not grow with requests, tenants, resource IDs or route paths. Snapshots contain a process ID and timestamp, but no account identity, request ID, URL, SQL, parameters, business result or error message.

The `*_total` stages include transaction acquisition, setup and commit/rollback; `*_work` measures their application callbacks. The difference includes checkout, transaction setup/finish and application scheduling, so it is not a pure pool-wait or PostgreSQL-execution metric. `usage` covers the awaited recorder, including its existing acknowledgement/retry behavior. `/me` retains its existing lack of generic usage recording. Nested stages overlap and must not be summed into request time. Statistics combine all instrumented routes in the process; they are not endpoint-specific percentiles. Stage counters can differ at a snapshot boundary while requests are in flight.

## Focused verification

Final verification passed **72 tests across nine files** with timing collection enabled, targeted lint for all changed TypeScript files, API package declaration generation and the API application's no-emit type check. The final test run began at 16:12:53 UTC on 26 September and completed in 8.25 seconds. These were local mocked security/service tests, not a capacity run or a fresh full-repository CI run.

New red-first regressions demonstrated duplicate-read failures before the implementation, then passed with reuse. Coverage includes request/transaction/actor/tenant/resource isolation, enrollment removal on a new request, unpublished lessons, publication reloads, revocation while waiting for the progress lock, and a real permission-override decision preventing the next handler invocation. Identity tests retain authentication-before-checkout and non-nested transaction checks. Timing tests cover success and error propagation, fixed storage across 10,000 observations, bounded emission and logger-failure isolation.

Private local evidence is retained in `.test-results/step5-projections-red.log`, `.test-results/step5-profile-red.log`, `.test-results/step5-stage-timings-red.log`, `.test-results/step5-request-final-suite.log`, `.test-results/step5-request-lint.log` and `.test-results/step5-request-typecheck.log`. Mock-based unit runs clear inherited database, Redis and cleanup configuration so they do not access external services.

No pool capacity, timeout, security budget or metering policy was changed by this request-projection work. A controlled runtime/load comparison and full capacity acceptance are still required.
