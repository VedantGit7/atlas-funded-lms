-- AlterTable
ALTER TABLE "course_modules"
ADD COLUMN "scorm_launch_path" TEXT,
ADD COLUMN "scorm_version" TEXT;

-- CreateTable
CREATE TABLE "module_scorm_progress" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "progress_pct" INTEGER NOT NULL DEFAULT 0,
    "cmi_json" JSONB,
    "completed_at" TIMESTAMPTZ(6),
    "last_seen_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "module_scorm_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "module_scorm_progress_tenant_id_module_id_membership_id_key" ON "module_scorm_progress"("tenant_id", "module_id", "membership_id");

-- CreateIndex
CREATE INDEX "module_scorm_progress_tenant_id_membership_id_updated_at_idx" ON "module_scorm_progress"("tenant_id", "membership_id", "updated_at");

ALTER TABLE "module_scorm_progress" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "module_scorm_progress_tenant_isolation" ON "module_scorm_progress"
  USING ("tenant_id" = app.current_tenant_id())
  WITH CHECK ("tenant_id" = app.current_tenant_id());
