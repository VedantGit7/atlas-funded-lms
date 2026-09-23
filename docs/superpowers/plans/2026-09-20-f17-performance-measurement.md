# F17 performance measurement implementation plan

> **For agentic workers:** Use the subagent-driven-development workflow for bounded implementation and independent review. Preserve the existing F01–F16 working tree; do not commit unrelated work or deploy.

**Goal:** replace database-only throughput projections with repeatable authenticated HTTP/journey evidence, database/worker measurements, mobile lab metrics and an explicit cross-process connection budget.

**Architecture:** retain the old database microbenchmark with accurate labeling, add guarded scenario-driven measurements using the isolated F16 stack, and support explicitly configured staging runs. Record the environment, workload, duration and evidence gaps alongside every result. Instrument database acquisition/query timings without SQL, credentials or customer data in logs. Preserve fresh authorization/revocation checks. Production sizing requires production-shaped staging; localhost/development runs validate tooling only.

**Planning target:** 100 simultaneously active learners sustained, 200 during a burst. The user delegated this decision. This is provisional workload planning, not an advertised supported capacity. Use small bounded local smoke levels to validate the harness before any staging target run.

**Observed staging limitation:** Vercel project `prj_mLNnaCQpELmd5nwk6z4jWKSlrjhg` is discoverable; the latest 20 deployments returned on 20 September 2026 are ERROR, including the audited branch and main. Do not direct load at a failed deployment, unrelated redirect or customer environment.

## Tasks

- [x] Inspect current authentication, database pooling, instrumentation, browser fixtures, bundle checks and critical route imports. Read installed Next documentation before app edits.
- [x] Add bounded pool acquisition/query instrumentation and configurable connection timeouts, with tests for successful and failed measurements and callback/promise compatibility. Emit aggregate safe measurements only when enabled; retain ordinary runtime behavior by default.
- [x] Add a pure connection-budget validator covering web/API/worker process counts, both pool types, database limits and reserved operational capacity. Reject malformed/over-budget configurations rather than guessing an instance count.
- [x] Add a guarded HTTP workload runner that authenticates distinct fixture users, measures request and journey p50/p95/p99 plus errors/statuses, includes warmup, sustained/burst phases and pacing, forbids redirects/cross-origin credential forwarding, and requires explicit fixture targets. Record worker backlog and SQL/pool evidence or mark them unavailable. Validate percentiles and error accounting with controlled local servers.
- [x] Add mobile browser lab collection for critical learner routes with actual interactions, LCP/INP/CLS and network JavaScript bytes. Label synthetic measurements and distinguish zero from unavailable. Preserve auth and tenant separation.
- [x] Freshly build and measure learner bundles if possible; inspect concrete heavy imports and make a bounded, measured improvement only where evidence supports it. Do not weaken a bundle threshold or invent an improvement when the build is unavailable.
- [x] Verify the harness against isolated services, run relevant unit/security checks, obtain independent review, and record evidence and remaining staging requirements in the F17 report. Link the report from the original audit without claiming full acceptance when staging measurements are missing.

## Verification contract

Tests must reject misleading evidence: empty latency samples, errors counted as successes, missing telemetry represented as zero, invalid concurrency/durations, missing identities, non-local unapproved targets, redirects and missing bundle artifacts. Pool calculations must include all process instances and operational reserves. Any optimization must retain MFA, token validation, membership status and platform grant revocation behavior. No hosted data mutation, production load, credentials in artifacts or silent authentication bypass is part of local verification.
