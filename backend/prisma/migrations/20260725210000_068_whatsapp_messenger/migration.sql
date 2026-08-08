-- Migration 068: WhatsApp Messenger (Learnyst Marketing → Messenger → WhatsApp).

CREATE TABLE "whatsapp_connections" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "provider_mode" TEXT NOT NULL DEFAULT 'mock',
    "display_name" TEXT,
    "phone_number" TEXT,
    "phone_number_id" TEXT,
    "waba_id" TEXT,
    "access_token_ciphertext" TEXT,
    "access_token_last4" TEXT,
    "quality_rating" TEXT,
    "messaging_limit" INTEGER NOT NULL DEFAULT 250,
    "connected_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whatsapp_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_connections_tenant_id_key" ON "whatsapp_connections"("tenant_id");

CREATE TABLE "whatsapp_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "header_type" TEXT NOT NULL DEFAULT 'NONE',
    "header_text" TEXT,
    "header_image_url" TEXT,
    "body" TEXT NOT NULL,
    "footer" TEXT,
    "buttons_json" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "meta_template_id" TEXT,
    "rejection_reason" TEXT,
    "created_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_templates_tenant_name_key" ON "whatsapp_templates"("tenant_id", "name");
CREATE INDEX "whatsapp_templates_tenant_status_created_idx" ON "whatsapp_templates"("tenant_id", "status", "created_at");

CREATE TABLE "whatsapp_campaigns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "audience_type" TEXT,
    "audience_batch_id" UUID,
    "template_id" UUID,
    "recipient_count" INTEGER NOT NULL DEFAULT 0,
    "delivered_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "scheduled_at" TIMESTAMPTZ(6),
    "sent_at" TIMESTAMPTZ(6),
    "created_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whatsapp_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "whatsapp_campaigns_tenant_status_created_idx" ON "whatsapp_campaigns"("tenant_id", "status", "created_at");
CREATE INDEX "whatsapp_campaigns_tenant_scheduled_idx" ON "whatsapp_campaigns"("tenant_id", "scheduled_at");

CREATE TABLE "whatsapp_conversations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "wa_phone" TEXT NOT NULL,
    "membership_id" UUID,
    "learner_name" TEXT,
    "last_message_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whatsapp_conversations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_conversations_tenant_phone_key" ON "whatsapp_conversations"("tenant_id", "wa_phone");
CREATE INDEX "whatsapp_conversations_tenant_last_message_idx" ON "whatsapp_conversations"("tenant_id", "last_message_at");

CREATE TABLE "whatsapp_inbox_messages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "direction" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "meta_message_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whatsapp_inbox_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "whatsapp_inbox_messages_tenant_conversation_created_idx"
  ON "whatsapp_inbox_messages"("tenant_id", "conversation_id", "created_at");

GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_connections TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_templates TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_campaigns TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_conversations TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_inbox_messages TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_connections FORCE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_inbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_inbox_messages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_connections_tenant_isolation ON whatsapp_connections;
CREATE POLICY whatsapp_connections_tenant_isolation ON whatsapp_connections
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS whatsapp_connections_platform_scope ON whatsapp_connections;
CREATE POLICY whatsapp_connections_platform_scope ON whatsapp_connections
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS whatsapp_templates_tenant_isolation ON whatsapp_templates;
CREATE POLICY whatsapp_templates_tenant_isolation ON whatsapp_templates
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS whatsapp_templates_platform_scope ON whatsapp_templates;
CREATE POLICY whatsapp_templates_platform_scope ON whatsapp_templates
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS whatsapp_campaigns_tenant_isolation ON whatsapp_campaigns;
CREATE POLICY whatsapp_campaigns_tenant_isolation ON whatsapp_campaigns
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS whatsapp_campaigns_platform_scope ON whatsapp_campaigns;
CREATE POLICY whatsapp_campaigns_platform_scope ON whatsapp_campaigns
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS whatsapp_conversations_tenant_isolation ON whatsapp_conversations;
CREATE POLICY whatsapp_conversations_tenant_isolation ON whatsapp_conversations
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS whatsapp_conversations_platform_scope ON whatsapp_conversations;
CREATE POLICY whatsapp_conversations_platform_scope ON whatsapp_conversations
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS whatsapp_inbox_messages_tenant_isolation ON whatsapp_inbox_messages;
CREATE POLICY whatsapp_inbox_messages_tenant_isolation ON whatsapp_inbox_messages
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS whatsapp_inbox_messages_platform_scope ON whatsapp_inbox_messages;
CREATE POLICY whatsapp_inbox_messages_platform_scope ON whatsapp_inbox_messages
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);
