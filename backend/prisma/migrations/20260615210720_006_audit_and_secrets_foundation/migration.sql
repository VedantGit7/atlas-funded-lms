-- CreateTable
CREATE TABLE "audit_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "actor_membership_id" UUID,
    "actor_principal_id" UUID,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "request_id" TEXT,
    "ip_hash" TEXT,
    "user_agent_hash" TEXT,
    "before_json" JSONB,
    "after_json" JSONB,
    "metadata_json" JSONB,
    "previous_hash" TEXT,
    "entry_hash" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secret_refs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "external_ref" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "rotation_due_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "secret_refs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_entries_tenant_id_occurred_at_idx" ON "audit_entries"("tenant_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_entries_tenant_id_action_occurred_at_idx" ON "audit_entries"("tenant_id", "action", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "secret_refs_tenant_id_key_key" ON "secret_refs"("tenant_id", "key");
