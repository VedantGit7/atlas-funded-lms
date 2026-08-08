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

- `setup/` — schemas, extensions, helper functions, database role setup
- `rls/` — row-level security policies and tenant isolation policies
- `triggers/` — append-only and audit-related triggers
- `indexes/` — partial indexes and non-Prisma-safe indexes
- `grants/` — database grants/revokes
- `partitions/` — partition parent/child setup

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
