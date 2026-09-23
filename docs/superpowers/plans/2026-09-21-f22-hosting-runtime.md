# F22 hosting/runtime implementation plan

**Goal:** implement the approved F22 finding: durable usage across request termination, restart-safe workers, and large direct-to-object-storage uploads with bounded asynchronous processing.

**Architecture:** retain the documented F11 Vercel web + managed Node API/worker topology. Append metering to PostgreSQL before request completion and aggregate it in bounded transactional worker batches. Keep bulk bytes off web request paths. Use existing durable job/lease patterns for heavy processing and enforce the runtime contract. Customer billing remains on its transactional ledger.

**Execution:** subagent-driven-development for independent upload/processing and worker/runtime tasks; root implements metering, integration, verification and report. Preserve all F01–F21 work. No new hosting subscription or production deployment is implied.

- [x] Trace current uploads, job persistence, metering and hosting configuration.
- [x] Replace production timer metering with durable append and idempotent rollup processing; prove restart persistence.
- [x] Verify/fix direct lesson/SCORM uploads, bounded processing and explicit worker ownership with targeted tests.
- [x] Add deployable worker/runtime constraints and restart verification without choosing an unconfigured paid host.
- [x] Verify a payload above 4.5 MB through the supported direct upload path; distinguish local/provider/live evidence.
- [x] Run focused tests, database migration/rollback/restart tests, typecheck and independent review; document rollout requirements.
