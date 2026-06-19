-- AlterTable
ALTER TABLE "learning_paths" ADD COLUMN "path_type" TEXT NOT NULL DEFAULT 'program';
ALTER TABLE "learning_paths" ADD COLUMN "metadata_json" JSONB;
ALTER TABLE "learning_paths" ADD COLUMN "created_by_membership_id" UUID;

-- CreateIndex
CREATE INDEX "learning_paths_tenant_id_path_type_status_idx" ON "learning_paths"("tenant_id", "path_type", "status");
