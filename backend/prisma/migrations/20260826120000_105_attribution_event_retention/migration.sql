-- Retention for the marketing attribution event log.
--
-- `sales_attribution_events` accumulated indefinitely. Nothing wrote an expiry,
-- nothing deleted a row, and no setting existed to express a policy. Every
-- tracked page view, signup and purchase a tenant has ever recorded was kept
-- forever, each one linked to a membership_id — so the corpus is personal data
-- that grows without bound and that nobody chose to keep.
--
-- Unlike the proctoring media policy (M12), this table is NOT empty in existing
-- tenants, so the default here has to be the opposite: retention is off until a
-- tenant sets it. A finite default would delete real history on deploy, which is
-- not a decision a migration gets to make on a tenant's behalf.
--
-- The floor, rather than a ceiling, is the safety cap. Tenants may lengthen
-- retention freely — that only keeps more history. Shortening it below a month
-- is capped in the application, because an attribution log with a week of
-- history cannot answer the question it exists for, and "why did our campaign
-- reporting go blank" is a worse outcome than a slightly larger table.

CREATE TABLE IF NOT EXISTS sales_attribution_retention_settings (
  tenant_id uuid PRIMARY KEY,
  -- NULL means "keep indefinitely", which is the pre-existing behaviour and the
  -- default. It is a real, chosen value, not an absent one.
  retention_days integer,
  updated_by_membership_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_attribution_retention_days_floor
    CHECK (retention_days IS NULL OR retention_days >= 30)
);

COMMENT ON COLUMN sales_attribution_retention_settings.retention_days IS
  'Days of attribution history to keep. NULL keeps everything, which is the default so no tenant loses history by deploy. The 30-day floor is enforced here as well as in the application because a shorter window makes the log useless for its purpose.';

GRANT SELECT, INSERT, UPDATE, DELETE ON sales_attribution_retention_settings
  TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE sales_attribution_retention_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_attribution_retention_settings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sales_attribution_retention_tenant_isolation
  ON sales_attribution_retention_settings;
CREATE POLICY sales_attribution_retention_tenant_isolation
  ON sales_attribution_retention_settings
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS sales_attribution_retention_platform_scope
  ON sales_attribution_retention_settings;
CREATE POLICY sales_attribution_retention_platform_scope
  ON sales_attribution_retention_settings
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);

-- The purge deletes by age within a tenant. The existing
-- (tenant_id, occurred_at) index already serves that scan.
