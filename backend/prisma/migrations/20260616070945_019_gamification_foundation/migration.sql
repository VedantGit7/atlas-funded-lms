-- CreateTable
CREATE TABLE "gamification_profiles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "xp_total" INTEGER NOT NULL DEFAULT 0,
    "level_key" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gamification_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_ledger" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "points" INTEGER NOT NULL,
    "reason_key" TEXT NOT NULL,
    "source_event_id" UUID,
    "idempotency_key" TEXT NOT NULL,
    "metadata_json" JSONB,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon_key" TEXT,
    "criteria_json" JSONB NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badge_awards" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "badge_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "awarded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_event_id" UUID,

    CONSTRAINT "badge_awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "streak_states" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "streak_key" TEXT NOT NULL,
    "current_count" INTEGER NOT NULL DEFAULT 0,
    "longest_count" INTEGER NOT NULL DEFAULT 0,
    "last_activity_date" DATE,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "streak_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "streak_freezes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "streak_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "used_for_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "streak_freezes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_definitions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metric_key" TEXT NOT NULL,
    "window_key" TEXT NOT NULL,
    "config_json" JSONB,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "leaderboard_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_snapshots" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "leaderboard_id" UUID NOT NULL,
    "period_key" TEXT NOT NULL,
    "snapshot_json" JSONB NOT NULL,
    "calculated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gamification_profiles_tenant_id_xp_total_idx" ON "gamification_profiles"("tenant_id", "xp_total");

-- CreateIndex
CREATE UNIQUE INDEX "gamification_profiles_tenant_id_membership_id_key" ON "gamification_profiles"("tenant_id", "membership_id");

-- CreateIndex
CREATE INDEX "point_ledger_tenant_id_membership_id_occurred_at_idx" ON "point_ledger"("tenant_id", "membership_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "point_ledger_tenant_id_idempotency_key_key" ON "point_ledger"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "badges_tenant_id_key_key" ON "badges"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "badge_awards_tenant_id_membership_id_awarded_at_idx" ON "badge_awards"("tenant_id", "membership_id", "awarded_at");

-- CreateIndex
CREATE UNIQUE INDEX "badge_awards_tenant_id_badge_id_membership_id_key" ON "badge_awards"("tenant_id", "badge_id", "membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "streak_states_tenant_id_membership_id_streak_key_key" ON "streak_states"("tenant_id", "membership_id", "streak_key");

-- CreateIndex
CREATE INDEX "streak_freezes_tenant_id_membership_id_streak_key_status_idx" ON "streak_freezes"("tenant_id", "membership_id", "streak_key", "status");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_definitions_tenant_id_key_key" ON "leaderboard_definitions"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "leaderboard_snapshots_tenant_id_leaderboard_id_calculated_a_idx" ON "leaderboard_snapshots"("tenant_id", "leaderboard_id", "calculated_at");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_snapshots_tenant_id_leaderboard_id_period_key_key" ON "leaderboard_snapshots"("tenant_id", "leaderboard_id", "period_key");
