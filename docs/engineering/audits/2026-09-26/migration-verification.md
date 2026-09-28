# Historical migration verification — 2026-09-26

Raw `.log` files referenced below are retained locally and excluded from Git. Published JSON artifacts and this summary provide the repository evidence.

Current schema effects for migrations 059, 083, 084, 085 and 086 match a clean replay. Historical checksum provenance is **not clean**, and this verification does not change applied SQL files or the migration ledger.

## Findings

| Migration | Recorded checksum | Finding | Status |
| --- | --- | --- | --- |
| 059 | `4392e9569fc9d14229f08a082fef70ee00c720106d2045ba4451c64b5b906799` | Exact hash of the current file's first 515 lines encoded as CRLF. The historical version ends with the `messenger_messages_conversation_id_fkey` statement. The remaining file appends 23 table grants. | Original bytes recovered cryptographically; current file still differs from applied bytes. Current grant effects verified. |
| 083 | `manual-apply-payment-report-fields` | Non-SHA256 manual marker; cannot attest SQL bytes. | Historical provenance unresolved; current catalog effects verified. |
| 084 | Empty string | No checksum evidence recorded. | Historical provenance unresolved; current catalog effects verified. |
| 085 | Empty string | No checksum evidence recorded. | Historical provenance unresolved; current catalog effects verified. |
| 086 | `manual-apply` | Non-SHA256 manual marker; cannot attest SQL bytes. | Historical provenance unresolved; current catalog effects verified. |

All five ledger records are finished, not rolled back, and have one applied step. The four manual/empty markers are not line-ending differences. Their identical start and finish timestamps are consistent with manually inserted history, but do not identify the operator or the executed SQL.

Migration 059 was recorded on 2026-07-24. Available path history first appears in the August 8 monorepo snapshot (`838b0b8`, and stash index `c071d0b`), already containing the appended grants. Searching all 17,556 available Git objects, including 10,411 blobs and unreachable objects, found no whole blob with the recorded SHA256 in raw, LF or CRLF form. The exact historical prefix reconstruction succeeds. Its SQL grant delta also exists in `backend/prisma/sql/grants/059_reports_insights_domains_table_grants.sql`; this explains how provisioning can produce matching effective permissions without changing the earlier ledger.

## Current-state proof and limits

The target is local Docker container `atlas-postgres`, database `atlas_lms_dev`. The reference is the independently provisioned PostgreSQL 17 container `atlas-ops-drill-20260926`, database `atlas_lms_ops_source`, with all 117 current migrations plus setup/functions/RLS/triggers/indexes/grants/partitions applied. Neither database was modified by this verifier. Every query runs in a PostgreSQL-enforced read-only transaction with a statement timeout.

The verifier selects the 37 tables created or altered by these five migration files. Exact definitions match for:

- 413 columns, including types, defaults, nullability, identity/generation and collation;
- 61 constraints, including validation and deferral states;
- 122 indexes, including definitions, validity and readiness;
- 74 RLS policies, including roles, commands, permissiveness and both expressions;
- RLS enable/force flags on all 37 tables;
- 777 effective role/privilege combinations for `atlas_app`, `atlas_worker`, and `atlas_platform`;
- one non-internal trigger, including definition and enablement.

Both catalog fingerprints are `bc44198bd6f0a8521315770f01afcedf08a1c964f5c96da69ee40be789146d32`. The comparison covers definitions and effective permissions; it is not a complete database comparison, a policy-function-body audit, a behavioral cross-tenant test, or proof of historical execution.

Migration 083 also backfills payment report fields. The target currently has **zero** payment-order rows created before its recorded application time. Aggregate checks found no remaining eligible null fields, but this is vacuous evidence: it cannot prove whether the historical backfill ran, nor recover any historical data values. No customer records or metadata values were emitted.

## Reproduce and gate

Run from the repository root with Node 24 and Docker access:

```powershell
node --test scripts/db/migration-verification.test.mjs
node scripts/db/migration-verification.mjs --container atlas-postgres --database atlas_lms_dev --user atlas --reference-container atlas-ops-drill-20260926 --reference-database atlas_lms_ops_source --reference-user atlas --output docs/engineering/audits/2026-09-26/migration-verification.json
```

The reference is disposable: recreate it with the full provisioning workflow when it is no longer running. Pass explicit Docker container/database/user names; this tool does not load `.env`, accept connection URLs, apply SQL, or alter migration history. The payment-backfill cutoff is deliberately specific to this local historical incident (2026-08-03T08:45:45.11444Z), so it must not be used as a generic hosted data audit.

Exit 0 requires valid matching current-file checksums **and** a complete matching reference catalog. Exit 2 means the check ran but provenance or catalog verification is unresolved. Exit 1 means the check could not run. This incident intentionally returns exit 2 even when catalog comparison passes. Recovered historical prefix bytes do not turn an edited migration into a matching current-file checksum.

Five focused Node tests were observed failing before their implementation and then passing. They cover invalid manual markers, LF/CRLF equivalence versus content drift, exact prefix recovery, definition/permission differences, and refusal to approve missing/duplicate/unfinished/rolled-back history or matching schema with unknown provenance.

Evidence: [machine-readable verification](migration-verification.json), [complete local Git-object search](migration-verification-git-objects.json), focused tests (local log: `migration-verification-tests.log`).

## Forward-only reconciliation

There is no catalog drift in this local target to repair. Do not issue a compensating no-op migration merely to disguise the evidence gap, rewrite `_prisma_migrations.checksum`, use `migrate resolve` to attest bytes that were never recorded, or reset the existing database.

For another target, run the same read-only comparison against an independently provisioned reference with the intended release's migrations and auxiliary SQL. If the definitions or effective grants differ, create a new, dated forward-only migration that applies only the reviewed missing effects, rehearse it on a restored disposable copy, and rerun the catalog and application checks. Any data backfill needs a separately reviewed, idempotent transformation with aggregate preflight and postconditions; historical SQL must not be replayed indiscriminately against present-day data.

The four missing historical checksums require an explicit provenance exception backed by available deployment/backup evidence, or an independently approved replacement-database cutover after data validation. Such an exception must state that original bytes remain unknown. Neither outcome has been authorized or executed here. The 059 investigation is resolved as known historical file editing; the resulting current-file checksum mismatch remains visible until the repository's historical-migration policy is formally reconciled. Production history has not been inspected or certified by this local exercise.
