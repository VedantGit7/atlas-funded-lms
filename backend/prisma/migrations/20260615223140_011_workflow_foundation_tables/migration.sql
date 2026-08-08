-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "workflow_definitions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "definition_json" JSONB NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_transitions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "workflow_definition_id" UUID NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "from_state" TEXT NOT NULL,
    "to_state" TEXT NOT NULL,
    "actor_membership_id" UUID NOT NULL,
    "reason" TEXT,
    "metadata_json" JSONB,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workflow_definitions_tenant_id_key_key" ON "workflow_definitions"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "workflow_transitions_tenant_id_target_type_target_id_occurr_idx" ON "workflow_transitions"("tenant_id", "target_type", "target_id", "occurred_at");

-- CreateIndex
CREATE INDEX "workflow_transitions_tenant_id_actor_membership_id_occurred_idx" ON "workflow_transitions"("tenant_id", "actor_membership_id", "occurred_at");
