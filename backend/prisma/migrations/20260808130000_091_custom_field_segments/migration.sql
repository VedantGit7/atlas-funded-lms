-- Saved custom-field condition segments (Screen 5).
CREATE TABLE IF NOT EXISTS "custom_field_segments" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "visibility" TEXT NOT NULL DEFAULT 'shared',
  "refresh_mode" TEXT NOT NULL DEFAULT 'live',
  "conditions_json" JSONB NOT NULL,
  "matched_count" INTEGER,
  "previous_matched_count" INTEGER,
  "matched_count_at" TIMESTAMPTZ(6),
  "snapshot_batch_id" UUID,
  "created_by_membership_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "custom_field_segments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "custom_field_segments_tenant_idx"
  ON "custom_field_segments" ("tenant_id");

CREATE INDEX IF NOT EXISTS "custom_field_segments_tenant_visibility_idx"
  ON "custom_field_segments" ("tenant_id", "visibility");

CREATE INDEX IF NOT EXISTS "custom_field_segments_tenant_matched_at_idx"
  ON "custom_field_segments" ("tenant_id", "matched_count_at");

CREATE INDEX IF NOT EXISTS "custom_field_segments_tenant_created_by_idx"
  ON "custom_field_segments" ("tenant_id", "created_by_membership_id");

GRANT SELECT, INSERT, UPDATE, DELETE ON custom_field_segments TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE custom_field_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_segments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custom_field_segments_tenant_isolation ON custom_field_segments;
CREATE POLICY custom_field_segments_tenant_isolation ON custom_field_segments
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS custom_field_segments_platform_scope ON custom_field_segments;
CREATE POLICY custom_field_segments_platform_scope ON custom_field_segments
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
