-- Migration 073: Marketing Events (Learnyst Marketing → Events).

CREATE TABLE "marketing_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6),
    "location" TEXT,
    "link_url" TEXT,
    "join_url" TEXT,
    "cover_image_url" TEXT,
    "reminder_minutes_before" INTEGER,
    "created_by_membership_id" UUID NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "marketing_events_tenant_status_starts_idx"
  ON "marketing_events"("tenant_id", "status", "starts_at");
CREATE INDEX "marketing_events_tenant_status_created_idx"
  ON "marketing_events"("tenant_id", "status", "created_at");

CREATE TABLE "marketing_event_registrations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "contact_id" UUID,
    "membership_id" UUID,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "source" TEXT NOT NULL DEFAULT 'LINK',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_event_registrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketing_event_registrations_tenant_event_email_uidx"
  ON "marketing_event_registrations"("tenant_id", "event_id", "email");
CREATE INDEX "marketing_event_registrations_tenant_event_created_idx"
  ON "marketing_event_registrations"("tenant_id", "event_id", "created_at");

GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_events TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_event_registrations TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE marketing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_events FORCE ROW LEVEL SECURITY;
ALTER TABLE marketing_event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_event_registrations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_events_tenant_isolation ON marketing_events;
CREATE POLICY marketing_events_tenant_isolation ON marketing_events
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS marketing_events_platform_scope ON marketing_events;
CREATE POLICY marketing_events_platform_scope ON marketing_events
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS marketing_event_registrations_tenant_isolation ON marketing_event_registrations;
CREATE POLICY marketing_event_registrations_tenant_isolation ON marketing_event_registrations
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS marketing_event_registrations_platform_scope ON marketing_event_registrations;
CREATE POLICY marketing_event_registrations_platform_scope ON marketing_event_registrations
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);
