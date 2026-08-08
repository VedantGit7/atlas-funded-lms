-- Migration 067: marketing announcements (Learnyst Messenger → Announcements).

CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "audience_batch_id" UUID,
    "deep_link" TEXT,
    "image_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "recipient_count" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMPTZ(6),
    "created_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "announcements_tenant_type_created_idx"
  ON "announcements"("tenant_id", "type", "created_at");

CREATE INDEX "announcements_tenant_created_idx"
  ON "announcements"("tenant_id", "created_at");

GRANT SELECT, INSERT, UPDATE, DELETE ON announcements TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS announcements_tenant_isolation ON announcements;
CREATE POLICY announcements_tenant_isolation ON announcements
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS announcements_platform_scope ON announcements;
CREATE POLICY announcements_platform_scope ON announcements
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
