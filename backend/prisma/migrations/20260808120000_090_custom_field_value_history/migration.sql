-- Custom field value audit: who last set a value, and a history timeline.
ALTER TABLE "custom_field_values"
  ADD COLUMN IF NOT EXISTS "updated_by_membership_id" UUID;

CREATE INDEX IF NOT EXISTS "custom_field_values_tenant_updated_by_idx"
  ON "custom_field_values" ("tenant_id", "updated_by_membership_id");

CREATE TABLE IF NOT EXISTS "custom_field_value_history" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "custom_field_definition_id" UUID NOT NULL,
  "membership_id" UUID NOT NULL,
  "old_value_json" JSONB,
  "new_value_json" JSONB,
  "changed_by_membership_id" UUID,
  "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "custom_field_value_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "custom_field_value_history_tenant_member_changed_idx"
  ON "custom_field_value_history" ("tenant_id", "membership_id", "changed_at" DESC);

CREATE INDEX IF NOT EXISTS "custom_field_value_history_tenant_definition_idx"
  ON "custom_field_value_history" ("tenant_id", "custom_field_definition_id", "changed_at" DESC);

ALTER TABLE "custom_field_value_history"
  DROP CONSTRAINT IF EXISTS "custom_field_value_history_definition_fkey";
ALTER TABLE "custom_field_value_history"
  ADD CONSTRAINT "custom_field_value_history_definition_fkey"
  FOREIGN KEY ("custom_field_definition_id") REFERENCES "custom_field_definitions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON custom_field_value_history TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE custom_field_value_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_value_history FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custom_field_value_history_tenant_isolation ON custom_field_value_history;
CREATE POLICY custom_field_value_history_tenant_isolation ON custom_field_value_history
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS custom_field_value_history_platform_scope ON custom_field_value_history;
CREATE POLICY custom_field_value_history_platform_scope ON custom_field_value_history
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
