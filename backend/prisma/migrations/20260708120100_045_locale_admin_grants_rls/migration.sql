-- Post-migration 044: grants and tenant RLS for locale admin tables.

GRANT SELECT, INSERT, UPDATE, DELETE ON locale_metadata TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON locale_canonical_keys TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON locale_qa_check_runs TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON locale_qa_issues TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE locale_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE locale_metadata FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS locale_metadata_tenant_isolation ON locale_metadata;
CREATE POLICY locale_metadata_tenant_isolation ON locale_metadata
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS locale_metadata_platform_scope ON locale_metadata;
CREATE POLICY locale_metadata_platform_scope ON locale_metadata
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);

ALTER TABLE locale_canonical_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE locale_canonical_keys FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS locale_canonical_keys_tenant_isolation ON locale_canonical_keys;
CREATE POLICY locale_canonical_keys_tenant_isolation ON locale_canonical_keys
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS locale_canonical_keys_platform_scope ON locale_canonical_keys;
CREATE POLICY locale_canonical_keys_platform_scope ON locale_canonical_keys
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);

ALTER TABLE locale_qa_check_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE locale_qa_check_runs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS locale_qa_check_runs_tenant_isolation ON locale_qa_check_runs;
CREATE POLICY locale_qa_check_runs_tenant_isolation ON locale_qa_check_runs
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS locale_qa_check_runs_platform_scope ON locale_qa_check_runs;
CREATE POLICY locale_qa_check_runs_platform_scope ON locale_qa_check_runs
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);

ALTER TABLE locale_qa_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE locale_qa_issues FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS locale_qa_issues_tenant_isolation ON locale_qa_issues;
CREATE POLICY locale_qa_issues_tenant_isolation ON locale_qa_issues
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS locale_qa_issues_platform_scope ON locale_qa_issues;
CREATE POLICY locale_qa_issues_platform_scope ON locale_qa_issues
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
