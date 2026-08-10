-- Zoom connection health: account profile fields, sync runs, webhook event log.

ALTER TABLE "zoom_connections"
  ADD COLUMN IF NOT EXISTS "account_name" TEXT,
  ADD COLUMN IF NOT EXISTS "account_email" TEXT,
  ADD COLUMN IF NOT EXISTS "app_id" TEXT,
  ADD COLUMN IF NOT EXISTS "scopes_json" JSONB,
  ADD COLUMN IF NOT EXISTS "token_expires_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "last_synced_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "disconnected_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "schedule_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "schedule_interval_minutes" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "webhook_secret_ref" TEXT,
  ADD COLUMN IF NOT EXISTS "coverage_gap_count" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "zoom_sync_runs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "zoom_connection_id" UUID NOT NULL,
  "trigger" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMPTZ(6),
  "meetings_count" INTEGER NOT NULL DEFAULT 0,
  "participants_count" INTEGER NOT NULL DEFAULT 0,
  "skipped_count" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "log_json" JSONB,
  "range_from" TIMESTAMPTZ(6),
  "range_to" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "zoom_sync_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "zoom_sync_runs_connection_fkey"
    FOREIGN KEY ("zoom_connection_id") REFERENCES "zoom_connections"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "zoom_sync_runs_tenant_started_idx"
  ON "zoom_sync_runs" ("tenant_id", "started_at" DESC);

CREATE INDEX IF NOT EXISTS "zoom_sync_runs_tenant_connection_idx"
  ON "zoom_sync_runs" ("tenant_id", "zoom_connection_id", "started_at" DESC);

CREATE TABLE IF NOT EXISTS "zoom_webhook_events" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "zoom_connection_id" UUID,
  "event_type" TEXT NOT NULL,
  "topic" TEXT,
  "status_code" INTEGER NOT NULL DEFAULT 200,
  "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payload_json" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "zoom_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "zoom_webhook_events_tenant_received_idx"
  ON "zoom_webhook_events" ("tenant_id", "received_at" DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON zoom_sync_runs TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON zoom_webhook_events TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE zoom_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoom_sync_runs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS zoom_sync_runs_tenant_isolation ON zoom_sync_runs;
CREATE POLICY zoom_sync_runs_tenant_isolation ON zoom_sync_runs
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS zoom_sync_runs_platform_scope ON zoom_sync_runs;
CREATE POLICY zoom_sync_runs_platform_scope ON zoom_sync_runs
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);

ALTER TABLE zoom_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoom_webhook_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS zoom_webhook_events_tenant_isolation ON zoom_webhook_events;
CREATE POLICY zoom_webhook_events_tenant_isolation ON zoom_webhook_events
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS zoom_webhook_events_platform_scope ON zoom_webhook_events;
CREATE POLICY zoom_webhook_events_platform_scope ON zoom_webhook_events
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
