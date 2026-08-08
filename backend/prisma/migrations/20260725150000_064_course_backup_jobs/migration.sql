-- Migration 064: course backup jobs for Manage > Course Backup.

CREATE TABLE "course_backup_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "requested_by_membership_id" UUID NOT NULL,
    "course_title" TEXT NOT NULL,
    "scope_json" JSONB,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "r2_object_key" TEXT,
    "download_token" TEXT,
    "error_json" JSONB,
    "otp_verified_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_backup_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "course_backup_jobs_tenant_status_created_idx"
  ON "course_backup_jobs"("tenant_id", "status", "created_at");

CREATE INDEX "course_backup_jobs_tenant_course_created_idx"
  ON "course_backup_jobs"("tenant_id", "course_id", "created_at");

GRANT SELECT, INSERT, UPDATE, DELETE ON course_backup_jobs TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE course_backup_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_backup_jobs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_backup_jobs_tenant_isolation ON course_backup_jobs;
CREATE POLICY course_backup_jobs_tenant_isolation ON course_backup_jobs
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS course_backup_jobs_platform_scope ON course_backup_jobs;
CREATE POLICY course_backup_jobs_platform_scope ON course_backup_jobs
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
