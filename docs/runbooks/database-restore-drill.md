# Isolated database restore drill

This procedure proves a quiesced logical dump restores into a fresh database in the **same disposable PostgreSQL cluster**. It does not prove managed backups, point-in-time recovery, cluster reconstruction, external storage/Auth recovery, or complete application recovery.

## Preconditions

Use a separately provisioned disposable PostgreSQL container. Apply all migrations and auxiliary SQL with the repository provisioning script. Never select the normal development or production database for the fixture seeder. Cluster roles and extensions must already exist; this procedure does not restore them. Stop all writers before setting `RESTORE_DRILL_QUIESCED=1`.

The drill requires at least two records in each of `tenants`, `tenant_domains`, and `tenant_usage_events`. This is minimum fixture coverage, not evidence for every learning/payment/proctoring workflow. The optional fixture seeder only accepts empty databases named `atlas_lms_ci` or `atlas_lms_ops_source`, with the local `atlas` superuser. It inserts six synthetic rows and an uncalled sequence whose next value is 42, under a transaction and exclusive writer locks. It refuses reuse or overwrite.

## Run

From the repository root, with Node 24 and Docker available:

```powershell
$env:RESTORE_DRILL_CONTAINER = '<owned-disposable-container>'
$env:RESTORE_DRILL_SOURCE_DB = 'atlas_lms_ops_source'
$env:RESTORE_DRILL_USER = 'atlas'
# Run once, only after verifying that the selected database is disposable and empty:
$env:RESTORE_DRILL_SEED_FIXTURE = '1'
node scripts/reliability/seed-restore-fixture.mjs
# Proceed only after the seeder exits zero. No writers may run during the drill.
$env:RESTORE_DRILL_QUIESCED = '1'
$env:RESTORE_DRILL_OUT = 'restore-drill.json'
pnpm release:restore:drill
```

Do not set a target name routinely: the script generates a unique name. It refuses existing targets and never replaces a database. A target override must use `atlas_restore_drill_` followed by 32 hexadecimal characters and differ from the source.

The script snapshots every non-system ordinary/partitioned table, takes a custom-format dump, verifies the source remained unchanged, creates its target, and restores with `--exit-on-error --single-transaction`. Verification compares row counts and sorted row-content digests, schema definitions including object ownership/grants/RLS, and sequence `last_value` plus `is_called`. Table queries are batched to avoid excessive Docker startup overhead. Digests are non-adversarial integrity checks, not cryptographic backup signatures. The aggregate row hashing is intended for bounded fixtures; benchmark a streaming strategy before using it on a large database.

Success requires all checks and cleanup to pass. Cleanup checks a per-run database ownership comment before dropping the target and deletes only its own randomly named dump. A changed ownership marker or cleanup failure leaves the result failed and may retain the target for inspection. Never blindly delete a leftover target. No forced disconnections occur.

`databaseRecoveryDurationMs` includes target creation, restore, and verification. It excludes backup generation and application recovery; **it is not a production RTO**. RPO is not measured. Database-level settings, database ACLs, locale and cluster roles are expressly excluded. Retain the JSON with the tested source revision and fixture description.

The scheduled Drills workflow seeds the disposable CI source before invoking the same procedure. Small boundary tests run in ordinary CI through `pnpm test:reliability-tooling`. A local pass does not establish that the updated GitHub workflow has run.

## Hosted acceptance still required

Restore an actual provider-managed backup into an isolated environment, using the intended recovery runbook. Record backup age, recovery point, complete service downtime, database roles/settings, external storage and Auth dependencies, tenant isolation and representative learner/payment/proctoring journeys. Restore application traffic only after validation. Keep provider receipts and before/after identities with the release evidence.

Latest local evidence: [operational reliability report](../engineering/operational-reliability-2026-09-26.md).
