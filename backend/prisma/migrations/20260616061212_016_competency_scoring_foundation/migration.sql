-- CreateTable
CREATE TABLE "competency_dimensions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "competency_dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_profiles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "active_config_version_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "scoring_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_config_versions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "scoring_profile_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "config_json" JSONB NOT NULL,
    "activated_at" TIMESTAMPTZ(6),
    "created_by_membership_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scoring_config_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_bands" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "scoring_profile_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "min_score" DECIMAL(8,4) NOT NULL,
    "max_score" DECIMAL(8,4) NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "competency_bands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signal_sources" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "source_context" TEXT NOT NULL,
    "config_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "signal_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_signals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "dimension_id" UUID NOT NULL,
    "signal_source_key" TEXT NOT NULL,
    "source_event_id" UUID,
    "raw_score" DECIMAL(10,4) NOT NULL,
    "weight" DECIMAL(10,4) NOT NULL,
    "metadata_json" JSONB,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotency_key" TEXT NOT NULL,

    CONSTRAINT "competency_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_scores" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "dimension_id" UUID NOT NULL,
    "scoring_profile_id" UUID NOT NULL,
    "score" DECIMAL(10,4) NOT NULL,
    "band_key" TEXT,
    "calculated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "config_version_id" UUID NOT NULL,

    CONSTRAINT "competency_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "composite_readiness_state" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "scoring_profile_id" UUID NOT NULL,
    "composite_key" TEXT NOT NULL,
    "score" DECIMAL(10,4) NOT NULL,
    "band_key" TEXT NOT NULL,
    "hard_gates_json" JSONB,
    "calculated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "config_version_id" UUID NOT NULL,

    CONSTRAINT "composite_readiness_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_score_snapshots" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "scoring_profile_id" UUID NOT NULL,
    "snapshot_json" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competency_score_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "competency_dimensions_tenant_id_key_key" ON "competency_dimensions"("tenant_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_profiles_tenant_id_key_key" ON "scoring_profiles"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "scoring_config_versions_tenant_id_scoring_profile_id_activa_idx" ON "scoring_config_versions"("tenant_id", "scoring_profile_id", "activated_at");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_config_versions_tenant_id_scoring_profile_id_versio_key" ON "scoring_config_versions"("tenant_id", "scoring_profile_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "competency_bands_tenant_id_scoring_profile_id_key_key" ON "competency_bands"("tenant_id", "scoring_profile_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "signal_sources_tenant_id_key_key" ON "signal_sources"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "competency_signals_tenant_id_membership_id_dimension_id_occ_idx" ON "competency_signals"("tenant_id", "membership_id", "dimension_id", "occurred_at");

-- CreateIndex
CREATE INDEX "competency_signals_tenant_id_signal_source_key_occurred_at_idx" ON "competency_signals"("tenant_id", "signal_source_key", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "competency_signals_tenant_id_idempotency_key_key" ON "competency_signals"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "competency_scores_tenant_id_dimension_id_band_key_idx" ON "competency_scores"("tenant_id", "dimension_id", "band_key");

-- CreateIndex
CREATE UNIQUE INDEX "competency_scores_tenant_id_membership_id_dimension_id_scor_key" ON "competency_scores"("tenant_id", "membership_id", "dimension_id", "scoring_profile_id");

-- CreateIndex
CREATE INDEX "composite_readiness_state_tenant_id_composite_key_band_key_idx" ON "composite_readiness_state"("tenant_id", "composite_key", "band_key");

-- CreateIndex
CREATE UNIQUE INDEX "composite_readiness_state_tenant_id_membership_id_scoring_p_key" ON "composite_readiness_state"("tenant_id", "membership_id", "scoring_profile_id", "composite_key");

-- CreateIndex
CREATE INDEX "competency_score_snapshots_tenant_id_membership_id_occurred_idx" ON "competency_score_snapshots"("tenant_id", "membership_id", "occurred_at");
