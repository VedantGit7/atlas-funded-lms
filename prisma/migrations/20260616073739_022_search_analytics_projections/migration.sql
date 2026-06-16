-- CreateTable
CREATE TABLE "search_index_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "source_context" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'TENANT',
    "access_json" JSONB,
    "vector_ref" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "search_index_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_rollups" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "rollup_key" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" TEXT,
    "period_start" TIMESTAMPTZ(6) NOT NULL,
    "period_end" TIMESTAMPTZ(6) NOT NULL,
    "metrics_json" JSONB NOT NULL,
    "calculated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_rollups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funnel_daily_rollups" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "funnel_key" TEXT NOT NULL,
    "stage_key" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "metrics_json" JSONB,
    "calculated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funnel_daily_rollups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_statistics" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "window_key" TEXT NOT NULL,
    "attempts_count" INTEGER NOT NULL DEFAULT 0,
    "correct_count" INTEGER NOT NULL DEFAULT 0,
    "avg_latency_ms" INTEGER,
    "metrics_json" JSONB,
    "calculated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materialized_view_registry" (
    "id" UUID NOT NULL,
    "view_name" TEXT NOT NULL,
    "owner_context" TEXT NOT NULL,
    "refresh_policy_json" JSONB NOT NULL,
    "last_refresh_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "materialized_view_registry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_index_entries_tenant_id_source_type_idx" ON "search_index_entries"("tenant_id", "source_type");

-- CreateIndex
CREATE UNIQUE INDEX "search_index_entries_tenant_id_source_context_source_type_s_key" ON "search_index_entries"("tenant_id", "source_context", "source_type", "source_id");

-- CreateIndex
CREATE INDEX "analytics_rollups_tenant_id_rollup_key_period_start_idx" ON "analytics_rollups"("tenant_id", "rollup_key", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_rollups_tenant_id_rollup_key_subject_type_subject_key" ON "analytics_rollups"("tenant_id", "rollup_key", "subject_type", "subject_id", "period_start");

-- CreateIndex
CREATE INDEX "funnel_daily_rollups_tenant_id_funnel_key_day_idx" ON "funnel_daily_rollups"("tenant_id", "funnel_key", "day");

-- CreateIndex
CREATE UNIQUE INDEX "funnel_daily_rollups_tenant_id_funnel_key_stage_key_day_key" ON "funnel_daily_rollups"("tenant_id", "funnel_key", "stage_key", "day");

-- CreateIndex
CREATE INDEX "item_statistics_tenant_id_calculated_at_idx" ON "item_statistics"("tenant_id", "calculated_at");

-- CreateIndex
CREATE UNIQUE INDEX "item_statistics_tenant_id_item_id_window_key_key" ON "item_statistics"("tenant_id", "item_id", "window_key");

-- CreateIndex
CREATE UNIQUE INDEX "materialized_view_registry_view_name_key" ON "materialized_view_registry"("view_name");
