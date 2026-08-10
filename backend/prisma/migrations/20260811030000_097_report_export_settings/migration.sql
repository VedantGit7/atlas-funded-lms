-- Per-tenant export governance settings (retention, access, PII treatments).
CREATE TABLE IF NOT EXISTS report_export_settings (
  tenant_id uuid PRIMARY KEY,
  settings_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by_membership_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON report_export_settings TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE report_export_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_export_settings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS report_export_settings_tenant_isolation ON report_export_settings;
CREATE POLICY report_export_settings_tenant_isolation
  ON report_export_settings
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS report_export_settings_platform_scope ON report_export_settings;
CREATE POLICY report_export_settings_platform_scope
  ON report_export_settings
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
