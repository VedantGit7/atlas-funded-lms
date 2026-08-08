-- Migration 060: tenant-scoped sub-schools for Operate > Sub-schools.

CREATE TABLE "sub_schools" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sub_schools_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sub_schools_tenant_id_key_key" ON "sub_schools"("tenant_id", "key");
CREATE INDEX "sub_schools_tenant_id_status_idx" ON "sub_schools"("tenant_id", "status");
CREATE INDEX "sub_schools_tenant_id_name_idx" ON "sub_schools"("tenant_id", "name");

GRANT SELECT, INSERT, UPDATE, DELETE ON sub_schools TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE sub_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_schools FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sub_schools_tenant_isolation ON sub_schools;
CREATE POLICY sub_schools_tenant_isolation ON sub_schools
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS sub_schools_platform_scope ON sub_schools;
CREATE POLICY sub_schools_platform_scope ON sub_schools
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
