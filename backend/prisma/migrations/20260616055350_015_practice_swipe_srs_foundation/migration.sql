-- CreateTable
CREATE TABLE "practice_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "collection_id" UUID,
    "session_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'started',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "summary_json" JSONB,
    "idempotency_key" TEXT,

    CONSTRAINT "practice_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_responses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "practice_session_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "response_json" JSONB NOT NULL,
    "is_correct" BOOLEAN,
    "latency_ms" INTEGER,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotency_key" TEXT NOT NULL,

    CONSTRAINT "practice_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "srs_state" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "ease_factor" DECIMAL(8,4) NOT NULL,
    "interval_days" INTEGER NOT NULL,
    "due_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "srs_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "practice_sessions_tenant_id_membership_id_started_at_idx" ON "practice_sessions"("tenant_id", "membership_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "practice_sessions_tenant_id_idempotency_key_key" ON "practice_sessions"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "practice_responses_tenant_id_membership_id_occurred_at_idx" ON "practice_responses"("tenant_id", "membership_id", "occurred_at");

-- CreateIndex
CREATE INDEX "practice_responses_tenant_id_item_id_occurred_at_idx" ON "practice_responses"("tenant_id", "item_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "practice_responses_tenant_id_idempotency_key_key" ON "practice_responses"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "srs_state_tenant_id_membership_id_due_at_idx" ON "srs_state"("tenant_id", "membership_id", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "srs_state_tenant_id_membership_id_item_id_key" ON "srs_state"("tenant_id", "membership_id", "item_id");
