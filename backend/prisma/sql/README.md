# Atlas LMS Raw SQL

## Purpose

This folder contains approved raw SQL used alongside Prisma migrations.

Raw SQL is required for PostgreSQL features Prisma cannot safely express, including:

- RLS helper functions
- RLS policies
- database grants
- append-only triggers
- partial indexes
- partitioning
- database setup helpers

## Folder structure

Applied in this order by `pnpm db:provision` (see `scripts/db/provision-database.mjs`):

1. `setup/` — schemas, extensions, and base helper functions. Runs **before** Prisma
   migrations, because migrations depend on helpers defined here.
2. _(Prisma migrations run here)_
3. `functions/` — functions that query product tables, so they must be created after
   migrations (e.g. `app.verify_audit_chain`).
4. `rls/` — row-level security policies and tenant isolation policies
5. `triggers/` — append-only and audit-related triggers
6. `indexes/` — partial indexes and non-Prisma-safe indexes
7. `grants/` — database grants/revokes
8. `partitions/` — partition parent/child setup

Every folder above must appear in **both** `scripts/db/apply-sql-directory.mjs` and
`scripts/db/check-sql-approved-paths.mjs`. `functions/` was previously absent from both,
so `app.verify_audit_chain` was never deployed despite being called by
`backend/packages/audit/src/services/audit-chain.service.ts`.

## Rules

1. SQL must map to approved Database Design v2 scope only.
2. No product feature table may be added casually.
3. No session-level `SET app.tenant_id` is allowed.
4. Tenant context must use transaction-local `set_config(..., true)`.
5. RLS SQL must include tests later.
6. Append-only tables must use trigger enforcement later.
7. Production SQL execution requires migration review and approval.

## Forbidden

Do not use:

```sql
SET app.tenant_id = '...';
SET app.actor_membership_id = '...';
SET app.request_id = '...';
```
