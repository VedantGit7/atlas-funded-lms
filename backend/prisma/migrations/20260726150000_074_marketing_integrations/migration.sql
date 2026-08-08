-- Migration 074: Marketing Integrations (Learnyst Marketing → Integrations).

CREATE TABLE "marketing_integration_settings" (
    "tenant_id" UUID NOT NULL,
    "site_body_html" TEXT,
    "order_tracking_html" TEXT,
    "signup_tracking_html" TEXT,
    "api_key_hash" TEXT,
    "api_key_prefix" TEXT,
    "api_key_created_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_integration_settings_pkey" PRIMARY KEY ("tenant_id")
);

CREATE TABLE "marketing_integration_webhooks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_tested_at" TIMESTAMPTZ(6),
    "last_delivery_at" TIMESTAMPTZ(6),
    "last_delivery_status" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_integration_webhooks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketing_integration_webhooks_tenant_event_url_uidx"
  ON "marketing_integration_webhooks"("tenant_id", "event_key", "url");
CREATE INDEX "marketing_integration_webhooks_tenant_event_enabled_idx"
  ON "marketing_integration_webhooks"("tenant_id", "event_key", "enabled");

GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_integration_settings TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_integration_webhooks TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE marketing_integration_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_integration_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE marketing_integration_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_integration_webhooks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_integration_settings_tenant_isolation ON marketing_integration_settings;
CREATE POLICY marketing_integration_settings_tenant_isolation ON marketing_integration_settings
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS marketing_integration_settings_platform_scope ON marketing_integration_settings;
CREATE POLICY marketing_integration_settings_platform_scope ON marketing_integration_settings
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS marketing_integration_webhooks_tenant_isolation ON marketing_integration_webhooks;
CREATE POLICY marketing_integration_webhooks_tenant_isolation ON marketing_integration_webhooks
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS marketing_integration_webhooks_platform_scope ON marketing_integration_webhooks;
CREATE POLICY marketing_integration_webhooks_platform_scope ON marketing_integration_webhooks
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);
