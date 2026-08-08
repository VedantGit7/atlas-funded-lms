-- Migration 048: usage metering — per-day active-user markers for MAU/DAU.
-- Gauge history reuses the existing analytics_rollups table (no schema change).

-- CreateTable
CREATE TABLE "tenant_active_days" (
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "day" DATE NOT NULL,

    CONSTRAINT "tenant_active_days_pkey" PRIMARY KEY ("tenant_id", "membership_id", "day")
);

-- CreateIndex
CREATE INDEX "tenant_active_days_tenant_id_day_idx" ON "tenant_active_days"("tenant_id", "day");

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_active_days TO atlas_app, atlas_worker, atlas_platform;

-- Row level security (tenant isolation + platform scope), mirroring migration 045/047.
ALTER TABLE tenant_active_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_active_days FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_active_days_tenant_isolation ON tenant_active_days;
CREATE POLICY tenant_active_days_tenant_isolation ON tenant_active_days
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS tenant_active_days_platform_scope ON tenant_active_days;
CREATE POLICY tenant_active_days_platform_scope ON tenant_active_days
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
