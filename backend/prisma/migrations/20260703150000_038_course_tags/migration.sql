-- CreateTable
CREATE TABLE "course_tags" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_tags_tenant_id_course_id_tag_id_key" ON "course_tags"("tenant_id", "course_id", "tag_id");

-- CreateIndex
CREATE INDEX "course_tags_tenant_id_tag_id_idx" ON "course_tags"("tenant_id", "tag_id");

-- CreateIndex
CREATE INDEX "course_tags_tenant_id_course_id_idx" ON "course_tags"("tenant_id", "course_id");
