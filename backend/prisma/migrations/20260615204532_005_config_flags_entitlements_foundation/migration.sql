-- CreateTable
CREATE TABLE "tenant_config" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "config_json" JSONB NOT NULL,
    "current_version_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenant_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_config_version" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot_json" JSONB NOT NULL,
    "created_by_membership_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_config_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "default_value" JSONB NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flag_overrides" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "feature_flag_id" UUID NOT NULL,
    "value_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "feature_flag_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value_json" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlement_grant_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entitlement_key" TEXT NOT NULL,
    "old_value_json" JSONB,
    "new_value_json" JSONB NOT NULL,
    "changed_by_membership_id" UUID,
    "reason" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entitlement_grant_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_config_tenant_id_key" ON "tenant_config"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_config_version_tenant_id_created_at_idx" ON "tenant_config_version"("tenant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_config_version_tenant_id_version_key" ON "tenant_config_version"("tenant_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flag_overrides_tenant_id_feature_flag_id_key" ON "feature_flag_overrides"("tenant_id", "feature_flag_id");

-- CreateIndex
CREATE INDEX "entitlements_tenant_id_key_expires_at_idx" ON "entitlements"("tenant_id", "key", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "entitlements_tenant_id_key_key" ON "entitlements"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "entitlement_grant_history_tenant_id_entitlement_key_occurre_idx" ON "entitlement_grant_history"("tenant_id", "entitlement_key", "occurred_at");
