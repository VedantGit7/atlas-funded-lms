-- Audit finding H11 — replace the hardcoded admin bypass with an explicit
-- capability on the role record.
--
-- `isAdminBypassRole()` matched the literal strings "owner" and "admin" and, on
-- a match, skipped every ownership and relationship predicate in `can()`. Three
-- problems followed from that:
--
--   1. The bypass was invisible in the data. Nothing in `roles` said a role
--      skipped resource predicates, so it could not be reviewed or revoked
--      without a deploy.
--   2. `roles` had only `@@index([tenant_id, key])`, so two roles could hold the
--      same key in one tenant. Concurrent creates could race a duplicate in.
--   3. Combining the two: a *custom* role keyed "admin" inherited the bypass
--      implicitly. Creating one was a privilege escalation that no permission
--      grant recorded.

ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS bypasses_resource_predicates boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN roles.bypasses_resource_predicates IS
  'When true, can() skips ownership and relationship predicates for this role. Tenant-wide authority; grant deliberately.';

-- The two system roles that previously matched by string keep their behaviour.
-- Scoped to is_system so a custom role that happens to be keyed "admin" does
-- not silently acquire the bypass during this backfill.
UPDATE roles
   SET bypasses_resource_predicates = true
 WHERE is_system = true
   AND key IN ('owner', 'admin');

-- NOTE: the unique index this finding asked for already exists.
--
-- H11 says roles "currently only @@index, so duplicate keys can race in". That
-- is true of `schema.prisma`, which declares `@@index([tenant_id, key])`, but
-- not of the database: migration 029 created
-- `roles_tenant_key_active_uq` — UNIQUE on (tenant_id, key) WHERE deleted_at IS
-- NULL — and `sql/indexes/004_access_control_partial_indexes.sql` maintains it.
-- Verified live: a duplicate active key is rejected, per tenant.
--
-- So this migration adds no index. The Prisma model is corrected to declare
-- `@@unique` instead, which closes the drift that made the finding look open.

-- Reserved keys belong to the seeded system roles. Without this a tenant admin
-- could create a custom role keyed "owner" and, before the capability column
-- existed, inherit the bypass by name alone.
ALTER TABLE roles
  DROP CONSTRAINT IF EXISTS roles_reserved_keys_are_system;

ALTER TABLE roles
  ADD CONSTRAINT roles_reserved_keys_are_system
  CHECK (
    key NOT IN ('owner', 'admin', 'instructor', 'moderator', 'learner')
    OR is_system = true
  );
