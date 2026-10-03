# Performance targets implementation and verification plan

**Goal:** Measure 100 sustained active learners, 200 during bursts and a full two-hour endurance phase; reduce the largest learner initial JavaScript bundle toward 150 KiB gzip.

**Architecture:** Preserve the real authorization and rate-limit paths. Use guarded disposable local Auth/database fixtures and distinct actors behind a loopback fixture edge for local observations. Hosted acceptance remains separate. Measure production-build bundles before and after focused dependency changes. Preserve existing security/reliability work.

**Execution completed; acceptance failed.** See [the measured results](../../engineering/performance-targets-2026-09-26.md). The two-hour clock ran fully, but learner coverage, reliability and latency failed. The bundle decreased about 28%; its 150 KiB target remains open. Checkmarks below indicate work performed, not performance acceptance.

- [x] Reproduce current production bundle totals using the existing manifest guard; attribute initial chunks before editing frontend dependencies.
- [x] Correct the HTTP harness duration/sample limits with failing regressions first. Use bounded histograms, periodic session refresh, complete actor/duration coverage and sanitized progress. Never mark a shortened or partial run successful.
- [x] Prepare the isolated F16 Auth/database stack and 200 namespaced learner accounts. A loopback edge strips caller forwarding headers and supplies a distinct benchmark client address only for valid private fixture credentials. Leave application security budgets unchanged.
- [x] Run a short canary and review latency/errors before committing to the long run. Target profile: warmup 120 seconds / 100 users, sustained 900 seconds / 100 users, burst 300 seconds / 200 users, endurance 7,200 seconds / 100 users, 20-second think time. Initial latency gates: request p95 <=1,000 ms, journey p95 <=3,000 ms, zero unexpected functional errors. These are local acceptance thresholds, not a production SLO promise.
- [x] Complete the full endurance phase if the environment supports a valid run; capture wall-clock duration, actor coverage, error/latency trends and pool/process observations. Development mode is reported explicitly and cannot certify production capacity. Do not disable deployment checks or substitute fake providers to claim a production-shaped result.
- [x] Optimize measured eager learner dependencies; verify behavior/privacy regressions, fresh production build and exact before/after bundle sizes. Do not raise the stored budget or relabel missing chunks as zero.
- [x] Review the final changes independently, run appropriate tests/types/lint/guards, stop only task-owned processes/resources, and save a dated report separating measured passes, failures and untested hosted targets.

No live-provider load, deployment, purchase, production data mutation, or weakening of security controls is part of this plan. Local baseline and load runs must not overlap CPU-heavy builds if interpreting their timings.
