-- Device policy overrides and blocked fingerprints for Active Devices policies.
CREATE TABLE IF NOT EXISTS "device_policy_overrides" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "scope_type" TEXT NOT NULL,
  "scope_id" UUID NOT NULL,
  "devices_allowed" INTEGER NOT NULL,
  "on_limit_reached" TEXT NOT NULL DEFAULT 'inherit',
  "expires_at" TIMESTAMPTZ(6),
  "updated_by_membership_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "device_policy_overrides_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "device_policy_overrides_devices_allowed_check" CHECK ("devices_allowed" >= 1 AND "devices_allowed" <= 99),
  CONSTRAINT "device_policy_overrides_scope_type_check" CHECK ("scope_type" IN ('role', 'batch', 'learner')),
  CONSTRAINT "device_policy_overrides_on_limit_reached_check" CHECK (
    "on_limit_reached" IN ('inherit', 'block', 'sign_out_oldest', 'allow_and_alert')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS "device_policy_overrides_tenant_scope_key"
  ON "device_policy_overrides" ("tenant_id", "scope_type", "scope_id");

CREATE INDEX IF NOT EXISTS "device_policy_overrides_tenant_updated_idx"
  ON "device_policy_overrides" ("tenant_id", "updated_at" DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON device_policy_overrides TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE device_policy_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_policy_overrides FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS device_policy_overrides_tenant_isolation ON device_policy_overrides;
CREATE POLICY device_policy_overrides_tenant_isolation ON device_policy_overrides
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS device_policy_overrides_platform_scope ON device_policy_overrides;
CREATE POLICY device_policy_overrides_platform_scope ON device_policy_overrides
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS "device_blocked_fingerprints" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "blocked_by_membership_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "device_blocked_fingerprints_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "device_blocked_fingerprints_tenant_fp_key"
  ON "device_blocked_fingerprints" ("tenant_id", "fingerprint");

CREATE INDEX IF NOT EXISTS "device_blocked_fingerprints_tenant_created_idx"
  ON "device_blocked_fingerprints" ("tenant_id", "created_at" DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON device_blocked_fingerprints TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE device_blocked_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_blocked_fingerprints FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS device_blocked_fingerprints_tenant_isolation ON device_blocked_fingerprints;
CREATE POLICY device_blocked_fingerprints_tenant_isolation ON device_blocked_fingerprints
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS device_blocked_fingerprints_platform_scope ON device_blocked_fingerprints;
CREATE POLICY device_blocked_fingerprints_platform_scope ON device_blocked_fingerprints
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
