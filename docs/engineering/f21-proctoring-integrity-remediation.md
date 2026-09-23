# F21 — Proctoring referential integrity

Implemented, tested and applied to the local LMS database on 2026-09-21.

## Outcome

`proctoring_media_artifacts` now has three validated foreign keys:

| Relationship                                                                                                        | Guarantee                                                                         |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `tenant_id → tenants.id`                                                                                            | The tenant exists.                                                                |
| `(tenant_id, proctoring_session_id) → proctoring_sessions(tenant_id, id)`                                           | The session exists and belongs to that tenant.                                    |
| `(tenant_id, proctoring_session_id, proctoring_event_id) → proctoring_events(tenant_id, proctoring_session_id, id)` | A linked event exists in the same tenant and session; the event remains optional. |

Parent deletion and key changes are restricted while media references remain. Supporting compound indexes avoid unindexed relationship checks. The Prisma schema and generated client now describe these relationships.

The existing retention lifecycle remains object-first: successful storage deletion permits removal of the artifact row; storage failure retains it and protects its parent for retry. Proctoring events remain immutable through existing permissions and append-only triggers. This change does not set new retention periods or turn media expiry into permission to erase other exam evidence.

## Rollout and evidence

The local preflight found **0 artifacts, 0 sessions and 0 events**, with no existing artifact foreign keys. The two migrations install new-write enforcement first, then validate historical rows separately. Neither stage deletes or rewrites media records.

Only the F21 migration files were executed against the local database, then accurately registered as applied using Prisma's migration resolution command. A post-check confirms all three constraints are validated and all integrity counts remain zero. Six earlier pending migrations were left pending; a broad deployment of that backlog was outside this rollout.

- [Local preflight](audits/2026-09-21/f21-local-before.json)
- [Local post-migration verification](audits/2026-09-21/f21-local-after.json)

No hosted database or production deployment was changed. Other environments must apply and validate these migrations through their deployment process.

## Tests

- The baseline PostgreSQL regression failed because the old schema accepted a nonexistent session, reproducing F21.
- The fixed PostgreSQL regression passed: orphan/cross-tenant/cross-session inserts, invalid updates, optional events, restrictive parent operations, historical-data validation failure and subsequent successful validation. The read-only checker also identifies the intentionally inconsistent historical fixtures.
- A separate disposable database was provisioned from the complete LMS migration history and seeded with 146 catalogue records.
- Four proctoring, retention, risk and structure suites passed 23 tests. After adding a full-schema parent-retention regression, the final retention suite passed all 7 tests (24 distinct tests across those suites). It proves that failed storage deletion retains session protection and that the application cannot delete retained event evidence after media expiry.
- Full-project TypeScript checking, Prisma validation/client generation, targeted lint, formatting and SQL placement checks passed.
- Independent review found no blocking issues. The rollout notes cover ordinary index creation's writer locks and distinguish minimal foreign-key tests from full-schema event immutability.

The complete application test suite and hosted CI were not run for this change. The local verification containers are stopped after testing. See the [deployment, validation and retention runbook](../runbooks/proctoring-integrity.md) for operating instructions.
