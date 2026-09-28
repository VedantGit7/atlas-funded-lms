# Release branch verification — 28 September 2026

This verification covers the pending security, reliability, performance and staging-preparation changes on `release/atlas-staging-20260923`, following base commit `0c405545d5c9d51dc29b27f11163c18e723d5bbc`. It approves neither production deployment nor the outstanding performance acceptance targets.

## Local results

- The complete Vitest run passed 4,382 tests across 653 files. Its four opt-in tests were subsequently executed successfully: two worker process-loss recovery cases, the maximum-size storage upload, and the certificate worker configuration gate. That last gate is a configuration assertion, not proof of a hosted PDF worker.
- Cleanup-boundary, architecture, performance-tooling and reliability-tooling script suites passed.
- All 28 browser tests passed with zero retries, including learner enrollment/progress, assessment persistence, instructor/reviewer workflows, role revocation, cross-tenant denials, platform provisioning, accessibility and all committed Linux visual comparisons. Snapshots were not updated.
- Fresh disposable PostgreSQL 17 databases passed the F19 event-trigger, F20 guarded cleanup and F21 proctoring-integrity regressions. Full provisioning, migration-state validation and the RLS check under the restricted application login passed.
- Server authority, generated contracts, route metadata, Prisma boundary, audit/outbox compliance, worker registration, frontend/API closure, SQL guards, permission/entitlement metadata, tenant-resource registry, package exports, observability configuration and tenant seed validation passed.
- ESLint, complete lint-shard coverage, formatting, workflow syntax and the repository secret guard passed. The audit measurement helper is now included in lint coverage and explicitly imports its Node globals.
- The complete workspace production build and final solution-wide TypeScript check passed, including the web and API applications. The unchanged learner bundle regression guard passed; its 150 KiB target remains open.
- The dependency audit passed its configured policy. Two previously documented high-severity development-tool exceptions remain under SEC-09; this is not a claim of zero advisories.
- A pre-publication scan found no newly embedded credentials or local secret values. Existing public loopback examples and Supabase demo fixtures were checked against the base commit. Raw logs, credentials, generated builds and local test artifacts remain excluded from Git.

The initial browser and type-check attempts exposed a corrupted generated `.next-e2e` cache. That cache was preserved locally; rebuilding it restored healthy routing and the browser suite passed. No application access check or test assertion was bypassed.

Raw verification outputs are retained locally under `.test-results/commit-verification-20260928/`. The GitHub checks for the containing commit provide independent clean-checkout verification; earlier successful runs must not be treated as evidence for a new commit.

## Outstanding acceptance

The [Step 5 report](step5-verification-2026-09-28.md) remains authoritative for performance: the largest measured learner first load is 204.435 KiB gzip, above the unchanged 150 KiB target. The corrected short local 100/200-learner diagnostic had no request failures and matched usage accounting, but failed latency targets. Hosted sustained/burst and two-hour endurance acceptance remain open. Passing the bundle regression guard does not close those targets.

The user's USD 0 budget and pause on paid infrastructure remain in force. Provider configuration, hosted operational/security acceptance, retention-policy decisions and migration-history gaps remain listed in the [closure matrix](f01-f22-closure-matrix.md). No paid infrastructure, production deployment or merge to `main` is authorized by this verification.
