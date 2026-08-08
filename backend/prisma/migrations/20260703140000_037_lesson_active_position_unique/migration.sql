-- Lesson position uniqueness should apply only to active (non-deleted) rows.
-- Soft-deleted lessons previously collided when reusing position + offset.
DROP INDEX IF EXISTS "lessons_tenant_id_module_id_position_key";

CREATE UNIQUE INDEX "lessons_tenant_id_module_id_position_key"
  ON "lessons" ("tenant_id", "module_id", "position")
  WHERE "deleted_at" IS NULL;
