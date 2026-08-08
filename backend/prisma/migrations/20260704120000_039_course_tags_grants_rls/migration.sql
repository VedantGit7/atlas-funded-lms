-- Post-migration 038: atlas_app needs explicit grants and tenant RLS on course_tags.

GRANT SELECT, INSERT, UPDATE, DELETE ON course_tags TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE course_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_tags FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_tags_tenant_isolation ON course_tags;
CREATE POLICY course_tags_tenant_isolation ON course_tags
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS course_tags_platform_scope ON course_tags;
CREATE POLICY course_tags_platform_scope ON course_tags
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
