# Step 5 completion implementation plan

**Goal:** Correct the measured performance failures, reduce learner initial JavaScript toward 150 KiB, and verify 100 sustained learners, a 200-learner burst and two hours of endurance against the resulting staging runtime.

**Architecture:** Retain fresh authorization and database isolation. Reuse projections only within their original request/transaction. Coalesce tenant usage writes with bounded queues and commit acknowledgements. Remove unnecessary browser dependencies while preserving user-visible behavior. Use production artifacts and actual staging services for acceptance; never weaken deployment validation to make a local fixture appear deployed.

The user requested completion after reviewing the measured failures and delegated hosting selection. Render is selected for managed API/worker containers, and its connected workspace is confirmed. Vercel browser access is available, though its connector remains unauthorized. The user explicitly paused the proposed US$120/month paid provisioning. No billable resources were created.

- [x] Write failing regressions for redundant reads; implement scoped reuse in identity/course/lesson/progress paths; verify revocation, publication, scope and progress locks.
- [x] Write failing regressions for metering bursts, acknowledgement, retry, isolation and shutdown; implement bounded tenant batches; verify real PostgreSQL journal and rollup totals. Real-load admission loss remains a separate open item below.
- [x] Make development SQL query logging explicit opt-in, retaining development errors and warnings and excluding query logs in production. Compare local diagnostics without mislabelling runtime scope.
- [x] Separate plain notification catalog data from validation; narrow role/client dependencies and remove unnecessary animation-library costs; verify behavior and a fresh production manifest for all 71 learner routes. Final maximum 225.396 KiB; continue toward 150 KiB in remaining work.
- [x] Add a bounded load-test drain period so phase boundaries do not cancel successful work; preserve exact duration, actor coverage, errors and incomplete-work rejection.
- [ ] Resolve the short diagnostic's two missing usage events, sustained latency and six burst HTTP failures. Preserve bounded admission and security checks; no successful capacity result exists yet.
- [ ] Prepare Render deployment and costed resource selection, validate complete staging configuration, and resolve required account/credential inputs. Obtain price approval before creating billable resources.
- [ ] Build and verify the integrated candidate. Run a canary first; if it passes, run the full unchanged 100/200/two-hour profile, correlate pool/stage/memory and usage durability, and verify browser transfers/interactions.
- [x] Independently review changes/evidence, retain previous failed evidence, update the report and closure matrix with actual results, and stop only task-owned local test resources.
