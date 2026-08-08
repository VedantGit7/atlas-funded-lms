-- CreateEnum
CREATE TYPE "LessonTagVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'CLASSIFICATION');

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "LessonTagVisibility" NOT NULL DEFAULT 'PUBLIC',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_tags" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tags_tenant_id_slug_key" ON "tags"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "tags_tenant_id_visibility_idx" ON "tags"("tenant_id", "visibility");

-- CreateIndex
CREATE INDEX "tags_tenant_id_deleted_at_idx" ON "tags"("tenant_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_tags_tenant_id_lesson_id_tag_id_key" ON "lesson_tags"("tenant_id", "lesson_id", "tag_id");

-- CreateIndex
CREATE INDEX "lesson_tags_tenant_id_tag_id_idx" ON "lesson_tags"("tenant_id", "tag_id");

-- CreateIndex
CREATE INDEX "lesson_tags_tenant_id_lesson_id_idx" ON "lesson_tags"("tenant_id", "lesson_id");
