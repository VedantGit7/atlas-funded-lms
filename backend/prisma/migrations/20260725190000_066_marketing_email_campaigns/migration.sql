-- Migration 066: marketing email campaigns (Learnyst Messenger → Marketing Email).

CREATE TABLE "marketing_email_campaigns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "audience_type" TEXT,
    "audience_batch_id" UUID,
    "subject" TEXT,
    "body_html" TEXT,
    "template_key" TEXT,
    "recipient_count" INTEGER NOT NULL DEFAULT 0,
    "scheduled_at" TIMESTAMPTZ(6),
    "sent_at" TIMESTAMPTZ(6),
    "created_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_email_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "marketing_email_campaigns_tenant_status_created_idx"
  ON "marketing_email_campaigns"("tenant_id", "status", "created_at");

CREATE INDEX "marketing_email_campaigns_tenant_scheduled_idx"
  ON "marketing_email_campaigns"("tenant_id", "scheduled_at");

GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_email_campaigns TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE marketing_email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_email_campaigns FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_email_campaigns_tenant_isolation ON marketing_email_campaigns;
CREATE POLICY marketing_email_campaigns_tenant_isolation ON marketing_email_campaigns
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS marketing_email_campaigns_platform_scope ON marketing_email_campaigns;
CREATE POLICY marketing_email_campaigns_platform_scope ON marketing_email_campaigns
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
