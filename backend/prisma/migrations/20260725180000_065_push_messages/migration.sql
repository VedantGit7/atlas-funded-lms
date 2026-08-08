-- Migration 065: marketing push messages (Learnyst Messenger → Push Message).

CREATE TABLE "push_messages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "audience_type" TEXT,
    "audience_batch_id" UUID,
    "subject" TEXT,
    "body" TEXT,
    "deep_link" TEXT,
    "image_url" TEXT,
    "channel_android" BOOLEAN NOT NULL DEFAULT true,
    "channel_ios" BOOLEAN NOT NULL DEFAULT true,
    "channel_web" BOOLEAN NOT NULL DEFAULT true,
    "recipient_count" INTEGER NOT NULL DEFAULT 0,
    "scheduled_at" TIMESTAMPTZ(6),
    "sent_at" TIMESTAMPTZ(6),
    "created_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "push_messages_tenant_status_created_idx"
  ON "push_messages"("tenant_id", "status", "created_at");

CREATE INDEX "push_messages_tenant_scheduled_idx"
  ON "push_messages"("tenant_id", "scheduled_at");

GRANT SELECT, INSERT, UPDATE, DELETE ON push_messages TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE push_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_messages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_messages_tenant_isolation ON push_messages;
CREATE POLICY push_messages_tenant_isolation ON push_messages
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS push_messages_platform_scope ON push_messages;
CREATE POLICY push_messages_platform_scope ON push_messages
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
