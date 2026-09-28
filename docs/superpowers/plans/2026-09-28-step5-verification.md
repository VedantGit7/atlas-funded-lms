# Step 5 continuation — 28 September 2026

The user requested completion of Step 5. On 28 September the user briefly resumed Render preparation, then rejected the USD 120/month proposal and explicitly selected **USD 0 — local testing only**. Paid provisioning remains paused; no resources were created. Continue local implementation and evidence collection, preserving all earlier failed measurements and the existing staging security requirements. Hosted acceptance is outside the current budget authorization.

- [x] Reproduce the successful-response usage gap in route regressions. Append usage inside the business transaction, acknowledge only after commit, and retain the exact event on uncertain-commit fallback. Keep failed-request/email attribution explicitly best-effort.
- [x] Verify usage transaction rollback, RLS and replay against the isolated PostgreSQL fixture; clean only tracked test records.
- [x] Verify the installed Supabase SDK's duplicate symmetric-token user lookup. Reuse only one successful exact-request response inside a single verification operation; keep fresh provider verification across requests and SDK signature/expiry/assurance checks.
- [x] Distinguish auth-provider outages from invalid credentials without granting access or replacing identities during an outage.
- [x] Run the bounded local canary and 100/200-learner diagnostic with CPU profiling, then a corrected unprofiled diagnostic after capping the Auth fixture pool. Preserve both: corrected run has zero request errors and exact usage, but still fails latency. Development runtime is not hosted acceptance.
- [x] Correct the duplicate usage timing sample identified in review; 77 focused route/security tests, targeted lint and DB/API typechecking passed after the first diagnostic snapshot closed.
- [x] Reduce the remaining learner bundle with behavior/accessibility regressions and a final production build. Final maximum 204.435 KiB across 71 routes; preserve the unmet 150 KiB goal and full route accounting.
- [x] Publish a new evidence report, retain prior snapshots, and stop only task-owned local services.
- [ ] After staging hosting is authorized and fully configured, run the production canary, 100 learners for 15 minutes, 200 for five minutes and 100 for a full two hours. Verify deployed browser behavior and exact usage reconciliation. This gate cannot be marked complete from local development diagnostics or unit tests.

No increase to queue limits, pool limits, latency thresholds or test cancellation allowances is part of this continuation. Atomic success duration is measured before journal insertion/commit/output serialization; dedicated usage-pool counters now cover fallback and email writes, not successful transactional request counts. The journal is the authoritative count reconciliation source.
