-- Migration 080: Marketing Campaigns (multi-channel orchestration builder).

CREATE TABLE "marketing_campaigns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "goal" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "audience_type" TEXT,
    "audience_batch_id" UUID,
    "recipient_count" INTEGER NOT NULL DEFAULT 0,
    "channels_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "touchpoints_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "launched_at" TIMESTAMPTZ(6),
    "scheduled_at" TIMESTAMPTZ(6),
    "created_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "marketing_campaigns_tenant_status_created_idx"
  ON "marketing_campaigns"("tenant_id", "status", "created_at");
CREATE INDEX "marketing_campaigns_tenant_updated_idx"
  ON "marketing_campaigns"("tenant_id", "updated_at");

GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_campaigns TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_campaigns FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_campaigns_tenant_isolation ON marketing_campaigns;
CREATE POLICY marketing_campaigns_tenant_isolation ON marketing_campaigns
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS marketing_campaigns_platform_scope ON marketing_campaigns;
CREATE POLICY marketing_campaigns_platform_scope ON marketing_campaigns
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);
