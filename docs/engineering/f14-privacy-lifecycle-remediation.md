# F14 — Privacy lifecycle remediation

Date: 2026-09-20. Status: **partially remediated locally; full privacy lifecycle remains open**.

The user's requested policy check found individual retention settings, but no approved schedule covering all personal-data domains or implemented legal holds. The [data inventory](f14-data-inventory.md) distinguishes those settings from approval and identifies storage/provider/backup gaps. No retention periods or erasure authorization were invented.

## Implemented

- Renamed learner/admin/help-center promises to describe school-access removal and partial exports. Removed unsupported permanent-erasure/anonymization claims.
- Added a versioned, persisted access-removal outcome with retained categories/reasons, unchanged shared identity, unperformed erasure and explicit review requirements. Outcomes and completion audit commit with the membership change. Processing locks serialize concurrent attempts on the same request ID.
- Preserved unknown historical outcomes and legacy request/response replay compatibility. Unsupported erasure operations are rejected instead of reinterpreted.
- Added explicit included/omitted scope to new tenant exports and the learner snapshot. API scope remains unknown if historical metadata cannot be verified. Missing learner download sections no longer silently become empty successful sections.
- Added the [operational runbook](../runbooks/privacy-lifecycle.md) for migration, accurate outcome delivery, review, holds, provider/backup verification and rollback.

## Verification

Evidence is stored under [audits/2026-09-20](audits/2026-09-20). Focused regression tests were written before the fixes and reproduced missing outcomes/manifests and legacy replay incompatibility. The disposable PostgreSQL fixture uses the actual outcome repository, completion service and membership-update query, while substituting minimal tables and audit/permission dependencies; it is not proof of deployed authorization/RLS. It applies migration 111 only inside a random local maintenance schema, verifies rollback/concurrency and tenant predicates, and removes that schema afterward.

- Broad local regression: **2,804 passed, one skipped** across unit, security and structure suites (`f14-regression.log`). No runtime database environment was passed to this run.
- Final focused privacy tests: **35 passed** (`f14-focused-final.log`), covering outcome mapping, retained scope, failure boundaries, tenant denial, legacy replay compatibility, export manifests and learner/admin screen rendering. These overlap the broad run.
- Isolated PostgreSQL: **five passed** (`f14-postgres.log`): migration/default/constraint, retained data and shared identity, atomic audit rollback, concurrent processing/replay, and cross-tenant denial. Production RLS/authorization/provider erasure are outside this fixture's scope.
- Prisma client generation and schema validation passed (`f14-prisma-generate.log`, `f14-prisma-validate.log`); migration application to the real LMS database remains pending. Whole-workspace TypeScript, scoped backend/frontend lint, formatting and all five repository guards passed. Exact results and source hashes are recorded in `f14-verification.json`.
- Independent review found two replay compatibility issues; both were corrected and covered by tests. The final review found no blocking defect in the implemented scope. No authenticated browser interaction or hosted end-to-end journey was run; frontend checks use real screen rendering with design-system test substitutions.

## Still open

Comprehensive erasure/anonymization and complete subject export are **not implemented**. A full outcome needs approved per-domain decisions, a subject-to-record/object map, real legal holds, resumable domain/provider actions, delivery evidence and backup expiry/restore handling. After F15/F22, export-file cleanup and usage draining include inactive/deleted tenants. Tenant replay, proctoring-media and attribution retention still visit only active, non-deleted tenants. Report/export cleanup now queues deletion and preserves references until absence is confirmed; configured run-metadata retention still lacks an enforcement job. These findings remain explicit rather than being hidden behind a successful access-removal status.

F15 addresses the export storage lifecycle; its scope does not automatically cover every privacy gap above. During the original F14 verification, no live records were erased, no production settings were changed, and migration 111 was not applied to the LMS application database. F22 subsequently provisioned a fresh local LMS database with all 117 migrations; production acceptance remains separate. F14 must remain open until the runbook's full acceptance has been satisfied.

## Retention safety follow-up — 2026-09-26

The worker previously discarded the failed count returned by proctoring-media cleanup. Failed object deletions kept their rows for retry but produced no sweep error. It now reports the failure after successful row deletions commit, so the existing `worker.sweep.processor_failed` log includes the task/tenant and failure count while other tasks continue. A partial failure does not contribute to the sweep's successful-purge counter, so that counter is not an exact deletion receipt. No retention period or tenant eligibility changed.

Focused verification passed 31 tests across `proctoring-retention-failures`, `outbox-sweep` and `report-artifact-retention`. Both new regression cases failed before the fix. They execute the real proctoring purge and sweep with substituted transaction/storage boundaries, checking failure visibility, successful-only row removal, transaction completion before reporting, retry and continued task execution. They do not prove live database commits, object deletion or deployed alerts.

Proctoring media does not yet have F15's storage identity and verification guarantees: it uses the currently configured provider/bucket, does not persist the original location, and does not verify object absence before removing a row. Those gaps need storage reconciliation and a durable cleanup design; failure reporting alone does not close them. None of these purge paths enforce a legal hold. A placeholder callback or undocumented environment switch would not establish an authoritative, auditable hold system.

Full closure still needs owner-approved per-category actions, triggers and periods; authority and scope for holds and their release/review; shared-login versus school-only scope; provider/backup treatment; and required verification/delivery evidence. Existing tenant settings establish current behavior, not approval for expanding deletion to other domains or inactive tenants. This follow-up made no database/provider changes. Earlier migration rollout statements above describe the original F14 verification; see F22 for the later local database provisioning, which does not establish production acceptance.
