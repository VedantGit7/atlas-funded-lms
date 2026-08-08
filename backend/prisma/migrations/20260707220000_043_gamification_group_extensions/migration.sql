-- Migration 043: group streak states for group-scoped gamification streaks.

CREATE TABLE "group_streak_states" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "space_id" UUID NOT NULL,
    "streak_key" TEXT NOT NULL,
    "current_count" INTEGER NOT NULL DEFAULT 0,
    "longest_count" INTEGER NOT NULL DEFAULT 0,
    "last_activity_period" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "group_streak_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "group_streak_states_tenant_id_space_id_streak_key_key"
  ON "group_streak_states"("tenant_id", "space_id", "streak_key");

CREATE INDEX "group_streak_states_tenant_id_space_id_idx"
  ON "group_streak_states"("tenant_id", "space_id");

GRANT SELECT, INSERT, UPDATE, DELETE ON group_streak_states TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE group_streak_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_streak_states FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS group_streak_states_tenant_isolation ON group_streak_states;
CREATE POLICY group_streak_states_tenant_isolation ON group_streak_states
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS group_streak_states_platform_scope ON group_streak_states;
CREATE POLICY group_streak_states_platform_scope ON group_streak_states
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
