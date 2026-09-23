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

Comprehensive erasure/anonymization and complete subject export are **not implemented**. A full outcome needs approved per-domain decisions, a subject-to-record/object map, real legal holds, resumable domain/provider actions, delivery evidence and backup expiry/restore handling. Retention sweeps skip inactive tenants; some report cleanup discards object references without deleting bytes; some configured metadata retention lacks an enforcement job. These findings remain explicit rather than being hidden behind a successful access-removal status.

F15 addresses the export storage lifecycle; its scope does not automatically cover every privacy gap above. No live records were erased, no production settings were changed, and migration 111 has not been applied to the LMS application database. F14 must remain open until the runbook's full acceptance has been satisfied.
