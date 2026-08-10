-- Fix missing table grants + align RLS with atlas_app / atlas_worker / atlas_platform roles.
GRANT SELECT, INSERT, UPDATE, DELETE ON report_delivery_destinations TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE report_delivery_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_delivery_destinations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS report_delivery_destinations_tenant_isolation ON report_delivery_destinations;
CREATE POLICY report_delivery_destinations_tenant_isolation
  ON report_delivery_destinations
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS report_delivery_destinations_platform_scope ON report_delivery_destinations;
CREATE POLICY report_delivery_destinations_platform_scope
  ON report_delivery_destinations
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
