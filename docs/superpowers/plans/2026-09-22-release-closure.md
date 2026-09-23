# F01–F22 consolidated verification and closure plan

> **For agentic workers:** Use subagent-driven-development for the independent evidence inventory and build/browser verification tracks. Root owns database verification, integration fixes and final review.

**Goal:** Produce a current, evidence-backed closure matrix and staging/production readiness decision for the combined F01–F22 working tree.

**Architecture:** Preserve the existing uncommitted changes. Identify the base commit and content fingerprint; validate local code against disposable databases and isolated browser services. Separate implementation, local proof, hosted proof and unresolved requirements. No paid service provisioning or production release is included.

**Tech stack:** Next.js, TypeScript, Vitest, PostgreSQL/Prisma, Playwright, Docker, connected provider tools.

- [x] Inventory all 22 remediation reports and acceptance requirements; write `docs/engineering/f01-f22-closure-matrix.md` with explicit residuals and dated evidence.
- [x] Capture current commit, source fingerprint, test commands and sanitized results under `docs/engineering/audits/2026-09-22/closure`.
- [x] Run combined offline tests, type checking, static guards, lint and formatting; reproduce and fix failures caused by the combined changes without weakening assertions.
- [x] Provision an isolated full-schema test database using the F20 identity/cleanup boundary; run database, integration, authorization, route and tenant-isolation tests. Keep the development database out of destructive tests.
- [x] Inspect development migration history/checksums and reconcile pending F01–F22 migrations only after reviewing their data effects and verifying them on the disposable database.
- [x] Build API/web and run the existing isolated browser journey suite; retain fresh results and explicitly identify any external prerequisites or unverified scope.
- [x] Refresh available read-only hosted evidence for CI, deployment and provider security; record unavailable permissions/plan requirements without changing subscriptions, collaborators or customer data.
- [x] Independently review fixes and evidence, rerun affected checks, stop task-owned verification services, and publish the closure matrix plus ordered release blockers.
