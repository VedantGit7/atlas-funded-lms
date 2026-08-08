-- Migration 049: learner billing configuration (per-tenant pricing model).

-- CreateTable
CREATE TABLE "learner_billing_config" (
    "tenant_id" UUID NOT NULL,
    "pricing_model" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learner_billing_config_pkey" PRIMARY KEY ("tenant_id")
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON learner_billing_config TO atlas_app, atlas_worker, atlas_platform;

-- Row level security (tenant isolation + platform scope), mirroring migration 045/047/048.
ALTER TABLE learner_billing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE learner_billing_config FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS learner_billing_config_tenant_isolation ON learner_billing_config;
CREATE POLICY learner_billing_config_tenant_isolation ON learner_billing_config
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS learner_billing_config_platform_scope ON learner_billing_config;
CREATE POLICY learner_billing_config_platform_scope ON learner_billing_config
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
