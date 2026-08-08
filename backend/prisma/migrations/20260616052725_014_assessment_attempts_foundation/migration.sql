-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('STARTED', 'SUBMITTED', 'GRADED', 'ABANDONED', 'VOIDED');

-- CreateTable
CREATE TABLE "assessments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "assessment_type" TEXT NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "config_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "points" DECIMAL(10,2) NOT NULL,
    "config_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'STARTED',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMPTZ(6),
    "graded_at" TIMESTAMPTZ(6),
    "score_pct" DECIMAL(8,4),
    "metadata_json" JSONB,
    "idempotency_key" TEXT,

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_answers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "assessment_item_id" UUID NOT NULL,
    "answer_json" JSONB NOT NULL,
    "is_correct" BOOLEAN,
    "points_awarded" DECIMAL(10,2),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotency_key" TEXT NOT NULL,

    CONSTRAINT "attempt_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grading_tasks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "assigned_to_membership_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'open',
    "rubric_json" JSONB,
    "result_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "grading_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assessments_tenant_id_assessment_type_status_idx" ON "assessments"("tenant_id", "assessment_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "assessments_tenant_id_slug_key" ON "assessments"("tenant_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_items_tenant_id_assessment_id_item_id_key" ON "assessment_items"("tenant_id", "assessment_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_items_tenant_id_assessment_id_position_key" ON "assessment_items"("tenant_id", "assessment_id", "position");

-- CreateIndex
CREATE INDEX "attempts_tenant_id_assessment_id_membership_id_started_at_idx" ON "attempts"("tenant_id", "assessment_id", "membership_id", "started_at");

-- CreateIndex
CREATE INDEX "attempts_tenant_id_membership_id_status_idx" ON "attempts"("tenant_id", "membership_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "attempts_tenant_id_idempotency_key_key" ON "attempts"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "attempt_answers_tenant_id_attempt_id_idx" ON "attempt_answers"("tenant_id", "attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_answers_tenant_id_idempotency_key_key" ON "attempt_answers"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_answers_tenant_id_attempt_id_assessment_item_id_key" ON "attempt_answers"("tenant_id", "attempt_id", "assessment_item_id");

-- CreateIndex
CREATE INDEX "grading_tasks_tenant_id_status_created_at_idx" ON "grading_tasks"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "grading_tasks_tenant_id_assigned_to_membership_id_status_idx" ON "grading_tasks"("tenant_id", "assigned_to_membership_id", "status");
