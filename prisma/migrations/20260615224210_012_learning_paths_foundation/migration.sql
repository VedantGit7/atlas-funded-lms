-- CreateTable
CREATE TABLE "learning_paths" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "learning_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "path_steps" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "path_id" UUID NOT NULL,
    "step_type" TEXT NOT NULL,
    "ref_id" TEXT,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "path_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "path_step_gates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "path_step_id" UUID NOT NULL,
    "gate_type" TEXT NOT NULL,
    "config_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "path_step_gates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "path_enrollments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "path_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "enrolled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "path_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "path_step_progress" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "path_step_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'locked',
    "completed_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "path_step_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "learning_paths_tenant_id_status_idx" ON "learning_paths"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "learning_paths_tenant_id_slug_key" ON "learning_paths"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "path_steps_tenant_id_path_id_idx" ON "path_steps"("tenant_id", "path_id");

-- CreateIndex
CREATE UNIQUE INDEX "path_steps_tenant_id_path_id_position_key" ON "path_steps"("tenant_id", "path_id", "position");

-- CreateIndex
CREATE INDEX "path_step_gates_tenant_id_path_step_id_idx" ON "path_step_gates"("tenant_id", "path_step_id");

-- CreateIndex
CREATE INDEX "path_enrollments_tenant_id_membership_id_status_idx" ON "path_enrollments"("tenant_id", "membership_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "path_enrollments_tenant_id_path_id_membership_id_key" ON "path_enrollments"("tenant_id", "path_id", "membership_id");

-- CreateIndex
CREATE INDEX "path_step_progress_tenant_id_membership_id_updated_at_idx" ON "path_step_progress"("tenant_id", "membership_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "path_step_progress_tenant_id_path_step_id_membership_id_key" ON "path_step_progress"("tenant_id", "path_step_id", "membership_id");
