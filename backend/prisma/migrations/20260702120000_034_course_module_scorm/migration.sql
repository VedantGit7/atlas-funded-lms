-- CreateEnum
CREATE TYPE "CourseModuleContentKind" AS ENUM ('STANDARD', 'SCORM');

-- AlterTable
ALTER TABLE "course_modules"
ADD COLUMN "content_kind" "CourseModuleContentKind" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN "scorm_package_reference_id" UUID;

-- CreateIndex
CREATE INDEX "course_modules_tenant_id_content_kind_idx" ON "course_modules"("tenant_id", "content_kind");
