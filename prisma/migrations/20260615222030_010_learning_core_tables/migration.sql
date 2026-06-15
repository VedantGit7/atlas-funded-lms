-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "metadata_json" JSONB,
    "created_by_membership_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_modules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "course_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content_json" JSONB,
    "video_provider" TEXT,
    "video_url" TEXT,
    "duration_seconds" INTEGER,
    "position" INTEGER NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "enrolled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_progress" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "progress_pct" INTEGER NOT NULL DEFAULT 0,
    "last_seen_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "courses_tenant_id_slug_idx" ON "courses"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "courses_tenant_id_status_updated_at_idx" ON "courses"("tenant_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "course_modules_tenant_id_course_id_idx" ON "course_modules"("tenant_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_modules_tenant_id_course_id_position_key" ON "course_modules"("tenant_id", "course_id", "position");

-- CreateIndex
CREATE INDEX "lessons_tenant_id_slug_idx" ON "lessons"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "lessons_tenant_id_status_idx" ON "lessons"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_tenant_id_module_id_position_key" ON "lessons"("tenant_id", "module_id", "position");

-- CreateIndex
CREATE INDEX "enrollments_tenant_id_membership_id_status_idx" ON "enrollments"("tenant_id", "membership_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_tenant_id_course_id_membership_id_key" ON "enrollments"("tenant_id", "course_id", "membership_id");

-- CreateIndex
CREATE INDEX "lesson_progress_tenant_id_membership_id_updated_at_idx" ON "lesson_progress"("tenant_id", "membership_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_progress_tenant_id_lesson_id_membership_id_key" ON "lesson_progress"("tenant_id", "lesson_id", "membership_id");
