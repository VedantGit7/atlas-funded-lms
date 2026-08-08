-- Migration 025 marker.
-- Raw SQL hardening is applied through:
-- prisma/sql/grants/025_01_roles.sql
-- prisma/sql/grants/025_02_table_grants.sql
-- prisma/sql/rls/025_tenant_rls_policies.sql
-- prisma/sql/indexes/025_partial_active_indexes.sql
-- prisma/sql/partitions/025_partition_policy_assertions.sql

SELECT 1;
