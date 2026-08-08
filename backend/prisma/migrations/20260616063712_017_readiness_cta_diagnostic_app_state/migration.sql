-- CreateTable
CREATE TABLE "diagnostic_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "anonymous_id" TEXT,
    "membership_id" UUID,
    "assessment_id" UUID,
    "attempt_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'started',
    "ip_hash" TEXT,
    "user_agent_hash" TEXT,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "merge_json" JSONB,
    "metadata_json" JSONB,

    CONSTRAINT "diagnostic_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "readiness_policies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "scoring_profile_id" UUID NOT NULL,
    "cta_policy_json" JSONB NOT NULL,
    "legal_copy_json" JSONB,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "readiness_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribution_tokens" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID,
    "anonymous_id" TEXT,
    "token_hash" TEXT NOT NULL,
    "destination_url" TEXT NOT NULL,
    "source_surface" TEXT NOT NULL,
    "readiness_band_key" TEXT,
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),

    CONSTRAINT "attribution_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "diagnostic_sessions_tenant_id_anonymous_id_started_at_idx" ON "diagnostic_sessions"("tenant_id", "anonymous_id", "started_at");

-- CreateIndex
CREATE INDEX "diagnostic_sessions_tenant_id_membership_id_started_at_idx" ON "diagnostic_sessions"("tenant_id", "membership_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "readiness_policies_tenant_id_key_key" ON "readiness_policies"("tenant_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "attribution_tokens_token_hash_key" ON "attribution_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "attribution_tokens_tenant_id_membership_id_created_at_idx" ON "attribution_tokens"("tenant_id", "membership_id", "created_at");

-- CreateIndex
CREATE INDEX "attribution_tokens_tenant_id_anonymous_id_created_at_idx" ON "attribution_tokens"("tenant_id", "anonymous_id", "created_at");
