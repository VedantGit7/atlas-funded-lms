-- CreateTable
CREATE TABLE "automation_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "trigger_event_type" TEXT NOT NULL,
    "condition_json" JSONB,
    "action_json" JSONB NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "automation_rule_id" UUID NOT NULL,
    "source_event_id" UUID NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "result_json" JSONB,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locale_resources" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "locale_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extension_points" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "point_type" TEXT NOT NULL,
    "schema_json" JSONB NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "extension_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extension_registrations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "extension_point_key" TEXT NOT NULL,
    "registration_key" TEXT NOT NULL,
    "config_json" JSONB NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "extension_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "automation_rules_tenant_id_trigger_event_type_status_idx" ON "automation_rules"("tenant_id", "trigger_event_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "automation_rules_tenant_id_key_key" ON "automation_rules"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "automation_runs_tenant_id_status_occurred_at_idx" ON "automation_runs"("tenant_id", "status", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "automation_runs_tenant_id_automation_rule_id_source_event_i_key" ON "automation_runs"("tenant_id", "automation_rule_id", "source_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "locale_resources_tenant_id_locale_key_key" ON "locale_resources"("tenant_id", "locale", "key");

-- CreateIndex
CREATE UNIQUE INDEX "extension_points_key_key" ON "extension_points"("key");

-- CreateIndex
CREATE UNIQUE INDEX "extension_registrations_tenant_id_extension_point_key_regis_key" ON "extension_registrations"("tenant_id", "extension_point_key", "registration_key");
