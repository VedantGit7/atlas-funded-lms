-- Migration 062: product copy jobs for Sub-Schools Copy Product pipeline.

CREATE TABLE "product_copy_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "destination_sub_school_id" UUID NOT NULL,
    "requested_by_membership_id" UUID NOT NULL,
    "product_type" TEXT NOT NULL,
    "source_product_id" UUID NOT NULL,
    "source_product_title" TEXT NOT NULL,
    "destination_product_name" TEXT NOT NULL,
    "section_ids_json" JSONB,
    "result_product_id" UUID,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "error_json" JSONB,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_copy_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_copy_jobs_tenant_destination_created_idx"
  ON "product_copy_jobs"("tenant_id", "destination_sub_school_id", "created_at");

CREATE INDEX "product_copy_jobs_tenant_status_created_idx"
  ON "product_copy_jobs"("tenant_id", "status", "created_at");

GRANT SELECT, INSERT, UPDATE, DELETE ON product_copy_jobs TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE product_copy_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_copy_jobs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_copy_jobs_tenant_isolation ON product_copy_jobs;
CREATE POLICY product_copy_jobs_tenant_isolation ON product_copy_jobs
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS product_copy_jobs_platform_scope ON product_copy_jobs;
CREATE POLICY product_copy_jobs_platform_scope ON product_copy_jobs
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
