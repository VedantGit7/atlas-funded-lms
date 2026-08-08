-- Migration 042: seasonal events with XP multipliers (gamification Phase 5).

-- CreateTable
CREATE TABLE "seasonal_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "multiplier_json" JSONB NOT NULL,
    "linked_quest_ids" JSONB,
    "linked_leaderboard_key" TEXT,
    "theme_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "seasonal_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seasonal_events_tenant_id_key_key" ON "seasonal_events"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "seasonal_events_tenant_id_status_starts_at_idx" ON "seasonal_events"("tenant_id", "status", "starts_at");

-- Grants + tenant RLS (same pattern as migrations 039-041).
GRANT SELECT, INSERT, UPDATE, DELETE ON seasonal_events TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE seasonal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasonal_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seasonal_events_tenant_isolation ON seasonal_events;
CREATE POLICY seasonal_events_tenant_isolation ON seasonal_events
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS seasonal_events_platform_scope ON seasonal_events;
CREATE POLICY seasonal_events_platform_scope ON seasonal_events
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
