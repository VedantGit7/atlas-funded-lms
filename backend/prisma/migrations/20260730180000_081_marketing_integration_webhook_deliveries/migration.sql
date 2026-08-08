-- Migration 081: Marketing integration webhook delivery history.

CREATE TABLE "marketing_integration_webhook_deliveries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "webhook_id" UUID NOT NULL,
    "event_key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "status_code" INTEGER,
    "message" TEXT NOT NULL,
    "request_body" TEXT,
    "source" TEXT NOT NULL DEFAULT 'dispatch',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_integration_webhook_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "marketing_integration_webhook_deliveries_webhook_created_idx"
  ON "marketing_integration_webhook_deliveries"("tenant_id", "webhook_id", "created_at" DESC);
CREATE INDEX "marketing_integration_webhook_deliveries_tenant_created_idx"
  ON "marketing_integration_webhook_deliveries"("tenant_id", "created_at" DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_integration_webhook_deliveries TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE marketing_integration_webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_integration_webhook_deliveries FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_integration_webhook_deliveries_tenant_isolation ON marketing_integration_webhook_deliveries;
CREATE POLICY marketing_integration_webhook_deliveries_tenant_isolation ON marketing_integration_webhook_deliveries
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS marketing_integration_webhook_deliveries_platform_scope ON marketing_integration_webhook_deliveries;
CREATE POLICY marketing_integration_webhook_deliveries_platform_scope ON marketing_integration_webhook_deliveries
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);
