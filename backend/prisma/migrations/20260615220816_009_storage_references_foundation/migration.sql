-- CreateTable
CREATE TABLE "lesson_assets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "asset_type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "object_key_or_url" TEXT NOT NULL,
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "lesson_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lesson_assets_tenant_id_lesson_id_idx" ON "lesson_assets"("tenant_id", "lesson_id");
