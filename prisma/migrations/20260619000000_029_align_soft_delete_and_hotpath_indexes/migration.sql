-- Align hot-path and soft-delete partial unique indexes with migration 025 raw SQL.
-- Replaces Prisma-default index names and full unique constraints superseded by partial uniques.

-- Hot-path audit indexes (025 naming convention).
DROP INDEX IF EXISTS "audit_entries_tenant_id_occurred_at_idx";
DROP INDEX IF EXISTS "audit_entries_tenant_id_action_occurred_at_idx";
DROP INDEX IF EXISTS "audit_entries_tenant_occurred_at_idx";
DROP INDEX IF EXISTS "audit_entries_tenant_action_occurred_at_idx";

CREATE INDEX "audit_entries_tenant_occurred_at_idx" ON "audit_entries"("tenant_id", "occurred_at");
CREATE INDEX "audit_entries_tenant_action_occurred_at_idx" ON "audit_entries"("tenant_id", "action", "occurred_at");

-- Hot-path operational indexes (025 naming convention).
DROP INDEX IF EXISTS "notification_dispatches_tenant_id_status_created_at_idx";
DROP INDEX IF EXISTS "notification_dispatches_tenant_status_created_at_idx";
CREATE INDEX "notification_dispatches_tenant_status_created_at_idx" ON "notification_dispatches"("tenant_id", "status", "created_at");

DROP INDEX IF EXISTS "export_jobs_tenant_id_status_created_at_idx";
DROP INDEX IF EXISTS "export_jobs_tenant_status_created_at_idx";
CREATE INDEX "export_jobs_tenant_status_created_at_idx" ON "export_jobs"("tenant_id", "status", "created_at");

DROP INDEX IF EXISTS "deletion_requests_tenant_id_target_type_target_id_idx";
DROP INDEX IF EXISTS "deletion_requests_tenant_target_idx";
CREATE INDEX "deletion_requests_tenant_target_idx" ON "deletion_requests"("tenant_id", "target_type", "target_id");

-- Soft-delete partial unique indexes (replace full unique where applicable).
DROP INDEX IF EXISTS "tenant_domains_hostname_key";
DROP INDEX IF EXISTS "tenant_domains_hostname_active_uq";
CREATE UNIQUE INDEX "tenant_domains_hostname_active_uq" ON "tenant_domains"("hostname") WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS "roles_tenant_key_active_uq";
CREATE UNIQUE INDEX "roles_tenant_key_active_uq" ON "roles"("tenant_id", "key") WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS "courses_tenant_slug_active_uq";
CREATE UNIQUE INDEX "courses_tenant_slug_active_uq" ON "courses"("tenant_id", "slug") WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS "learning_paths_tenant_id_slug_key";
DROP INDEX IF EXISTS "learning_paths_tenant_slug_active_uq";
CREATE UNIQUE INDEX "learning_paths_tenant_slug_active_uq" ON "learning_paths"("tenant_id", "slug") WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS "item_collections_tenant_id_slug_key";
DROP INDEX IF EXISTS "item_collections_tenant_slug_active_uq";
CREATE UNIQUE INDEX "item_collections_tenant_slug_active_uq" ON "item_collections"("tenant_id", "slug") WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS "certificate_templates_tenant_id_key_key";
DROP INDEX IF EXISTS "certificate_templates_tenant_key_active_uq";
CREATE UNIQUE INDEX "certificate_templates_tenant_key_active_uq" ON "certificate_templates"("tenant_id", "key") WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS "community_spaces_tenant_id_slug_key";
DROP INDEX IF EXISTS "community_spaces_tenant_slug_active_uq";
CREATE UNIQUE INDEX "community_spaces_tenant_slug_active_uq" ON "community_spaces"("tenant_id", "slug") WHERE deleted_at IS NULL;
