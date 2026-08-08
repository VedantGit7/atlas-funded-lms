-- Migration 040: quest definitions and per-member quest progress (gamification Phase 3).

-- CreateTable
CREATE TABLE "quest_definitions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "quest_type" TEXT NOT NULL DEFAULT 'single_step',
    "criteria_json" JSONB NOT NULL,
    "rewards_json" JSONB NOT NULL,
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "course_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "quest_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quest_progress" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "quest_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "progress_json" JSONB NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "quest_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quest_definitions_tenant_id_key_key" ON "quest_definitions"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "quest_definitions_tenant_id_status_idx" ON "quest_definitions"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "quest_progress_tenant_id_quest_id_membership_id_key" ON "quest_progress"("tenant_id", "quest_id", "membership_id");

-- CreateIndex
CREATE INDEX "quest_progress_tenant_id_membership_id_status_idx" ON "quest_progress"("tenant_id", "membership_id", "status");

-- Grants + tenant RLS (same pattern as migration 039).
GRANT SELECT, INSERT, UPDATE, DELETE ON quest_definitions TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON quest_progress TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE quest_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_definitions FORCE ROW LEVEL SECURITY;
ALTER TABLE quest_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_progress FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quest_definitions_tenant_isolation ON quest_definitions;
CREATE POLICY quest_definitions_tenant_isolation ON quest_definitions
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS quest_definitions_platform_scope ON quest_definitions;
CREATE POLICY quest_definitions_platform_scope ON quest_definitions
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS quest_progress_tenant_isolation ON quest_progress;
CREATE POLICY quest_progress_tenant_isolation ON quest_progress
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS quest_progress_platform_scope ON quest_progress;
CREATE POLICY quest_progress_platform_scope ON quest_progress
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
