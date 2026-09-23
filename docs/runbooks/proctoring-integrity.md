# Proctoring media integrity and retention

Media artifacts must reference a real tenant and a session belonging to that tenant. An optional event must belong to that same tenant and session. A recording without a specific event remains valid.

The three F21 foreign keys use `RESTRICT` for parent deletion and key updates. A parent cannot disappear while an artifact references it. Existing media expiry settings remain in force: the retention worker deletes the storage object first, then the artifact row. A storage failure retains the row for retry and keeps its parent protected. Proctoring events retain their existing append-only permissions and triggers after media expiry; media cleanup does not authorize event deletion.

## Inspect before deployment

Set `PROCTORING_INTEGRITY_DATABASE_URL` explicitly to the target's administrative connection, then run:

```text
pnpm db:proctoring-integrity:check
```

The checker uses a read-only repeatable-read transaction, requires complete RLS visibility, and reports aggregate counts and constraint definitions. It never prints connection credentials, media keys or learner identifiers. An ordinary restricted application login is refused rather than reporting a falsely clean, filtered view.

Nonzero missing-tenant, invalid-session or invalid-event counts block a clean preflight. Invalid events include same-tenant events from a different session. Preserve these records and investigate their authoritative parentage and retention requirements. Do not null event links or delete evidence simply to pass validation. An approved correction should identify the exact affected IDs, correct source relationships, record why the change was made, and handle any storage object according to its retention policy.

## Staged migration

1. `20260921010000_114_proctoring_media_integrity` adds supporting indexes and three `NOT VALID` foreign keys. New inserts and parent-reference updates are checked immediately; historical rows are preserved.
2. `20260921010100_115_validate_proctoring_media_integrity` validates historical rows in a separate transaction. Any invalid row fails this stage without undoing stage-one protection or deleting evidence.
3. Verify completion with `pnpm db:proctoring-integrity:check --require-validated` and inspect migration history.

Use the normal reviewed Prisma migration deployment after confirming all pending migrations are in scope. A validation failure leaves stage one applied; after an approved repair, mark the failed validation migration rolled back using Prisma's recovery workflow and retry it. Do not mark failed validation as applied.

Both migration stages have a five-second lock timeout and sixty-second statement timeout. The supporting index creation uses ordinary PostgreSQL indexing, which can block writers while it runs. The inspected local tables were empty. For a populated deployment, size the index work and schedule an appropriate maintenance window; a timeout is a failed deployment to investigate, not a reason to remove the constraints. PostgreSQL documents the separate enforcement/validation behavior in [ALTER TABLE](https://www.postgresql.org/docs/17/sql-altertable.html) and the optional composite-reference rules in [foreign-key constraints](https://www.postgresql.org/docs/17/ddl-constraints.html#DDL-CONSTRAINTS-FK).

## Verification

`pnpm test:proctoring-integrity` runs a destructive regression only against a fresh disposable PostgreSQL 17 database at `127.0.0.1:15442/atlas_lms_test`, owner `postgres`, fixture password `atlas_f21_disposable_only`. It refuses any existing public tables. CI creates this dedicated service automatically.

The regression verifies missing parents, cross-tenant/session references, insert/update rejection, nullable events, restrictive parent deletion, accurate preflight counts and preservation of historical rows when validation fails. Its minimal schema isolates foreign-key behavior; actual event immutability and object-first deletion are also tested in the full-schema proctoring retention integration suite under F20's guarded fixture cleanup.
