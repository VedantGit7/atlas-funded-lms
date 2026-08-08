-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "provisioning_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "step_key" TEXT,
    "request_json" JSONB NOT NULL,
    "result_json" JSONB,
    "error_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "provisioning_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_branding" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "logo_light_key" TEXT,
    "logo_dark_key" TEXT,
    "favicon_key" TEXT,
    "support_email" TEXT,
    "social_links_json" JSONB,
    "legal_footer_text" TEXT,
    "current_version_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenant_branding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_theme" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "primary_color" TEXT NOT NULL,
    "secondary_color" TEXT,
    "accent_color" TEXT,
    "font_family" TEXT,
    "token_json" JSONB NOT NULL,
    "current_version_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenant_theme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_branding_version" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot_json" JSONB NOT NULL,
    "created_by_membership_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_branding_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_theme_version" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot_json" JSONB NOT NULL,
    "created_by_membership_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_theme_version_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "provisioning_jobs_tenant_id_status_created_at_idx" ON "provisioning_jobs"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "provisioning_jobs_tenant_id_idempotency_key_key" ON "provisioning_jobs"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_branding_tenant_id_key" ON "tenant_branding"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_theme_tenant_id_key" ON "tenant_theme"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_branding_version_tenant_id_created_at_idx" ON "tenant_branding_version"("tenant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_branding_version_tenant_id_version_key" ON "tenant_branding_version"("tenant_id", "version");

-- CreateIndex
CREATE INDEX "tenant_theme_version_tenant_id_created_at_idx" ON "tenant_theme_version"("tenant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_theme_version_tenant_id_version_key" ON "tenant_theme_version"("tenant_id", "version");
