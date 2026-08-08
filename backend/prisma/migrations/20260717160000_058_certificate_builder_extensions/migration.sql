-- Migration 058: certificate builder extensions (design snapshots, brand kits, render jobs, wallet passes).

-- Extend issued certificates with builder / verifiable-credential metadata.
ALTER TABLE "certificates"
  ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "suspended_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "serial_number" TEXT,
  ADD COLUMN IF NOT EXISTS "design_snapshot_json" JSONB,
  ADD COLUMN IF NOT EXISTS "design_snapshot_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "recipient_name" TEXT,
  ADD COLUMN IF NOT EXISTS "course_title" TEXT,
  ADD COLUMN IF NOT EXISTS "status_list_index" INTEGER,
  ADD COLUMN IF NOT EXISTS "vc_json" JSONB,
  ADD COLUMN IF NOT EXISTS "vc_object_key" TEXT,
  ADD COLUMN IF NOT EXISTS "blockchain_anchor" TEXT,
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(6);

UPDATE "certificates"
SET
  "created_at" = COALESCE("created_at", "issued_at"),
  "updated_at" = COALESCE("updated_at", "issued_at")
WHERE "created_at" IS NULL OR "updated_at" IS NULL;

ALTER TABLE "certificates"
  ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "certificates"
  ALTER COLUMN "created_at" SET NOT NULL,
  ALTER COLUMN "updated_at" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "certificates_tenant_serial_number_idx"
  ON "certificates"("tenant_id", "serial_number");

CREATE INDEX IF NOT EXISTS "certificates_tenant_status_expires_at_idx"
  ON "certificates"("tenant_id", "status", "expires_at");

-- CreateTable
CREATE TABLE IF NOT EXISTS "certificate_brand_kits" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "logo_url" TEXT,
    "colors_json" JSONB,
    "fonts_json" JSONB,
    "assets_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "certificate_brand_kits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "certificate_status_lists" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "encoded_list" TEXT NOT NULL,
    "bit_length" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "certificate_status_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "certificate_render_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "certificate_id" UUID,
    "template_id" UUID,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "error_message" TEXT,
    "r2_object_key" TEXT,
    "format" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "certificate_render_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "certificate_wallet_passes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "certificate_id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "pass_object_key" TEXT,
    "external_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "certificate_wallet_passes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "certificate_brand_kits_tenant_name_idx"
  ON "certificate_brand_kits"("tenant_id", "name");

CREATE INDEX IF NOT EXISTS "certificate_status_lists_tenant_purpose_idx"
  ON "certificate_status_lists"("tenant_id", "purpose");

CREATE INDEX IF NOT EXISTS "certificate_render_jobs_tenant_status_created_at_idx"
  ON "certificate_render_jobs"("tenant_id", "status", "created_at");

CREATE INDEX IF NOT EXISTS "certificate_render_jobs_tenant_certificate_id_idx"
  ON "certificate_render_jobs"("tenant_id", "certificate_id");

CREATE INDEX IF NOT EXISTS "certificate_wallet_passes_tenant_certificate_id_idx"
  ON "certificate_wallet_passes"("tenant_id", "certificate_id");

CREATE UNIQUE INDEX IF NOT EXISTS "certificate_wallet_passes_tenant_certificate_platform_key"
  ON "certificate_wallet_passes"("tenant_id", "certificate_id", "platform");

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON certificate_brand_kits TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON certificate_status_lists TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON certificate_render_jobs TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON certificate_wallet_passes TO atlas_app, atlas_worker, atlas_platform;

-- Row level security (tenant isolation + platform scope), mirroring migration 056.
ALTER TABLE certificate_brand_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_brand_kits FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS certificate_brand_kits_tenant_isolation ON certificate_brand_kits;
CREATE POLICY certificate_brand_kits_tenant_isolation ON certificate_brand_kits
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS certificate_brand_kits_platform_scope ON certificate_brand_kits;
CREATE POLICY certificate_brand_kits_platform_scope ON certificate_brand_kits
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);

ALTER TABLE certificate_status_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_status_lists FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS certificate_status_lists_tenant_isolation ON certificate_status_lists;
CREATE POLICY certificate_status_lists_tenant_isolation ON certificate_status_lists
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS certificate_status_lists_platform_scope ON certificate_status_lists;
CREATE POLICY certificate_status_lists_platform_scope ON certificate_status_lists
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);

ALTER TABLE certificate_render_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_render_jobs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS certificate_render_jobs_tenant_isolation ON certificate_render_jobs;
CREATE POLICY certificate_render_jobs_tenant_isolation ON certificate_render_jobs
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS certificate_render_jobs_platform_scope ON certificate_render_jobs;
CREATE POLICY certificate_render_jobs_platform_scope ON certificate_render_jobs
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);

ALTER TABLE certificate_wallet_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_wallet_passes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS certificate_wallet_passes_tenant_isolation ON certificate_wallet_passes;
CREATE POLICY certificate_wallet_passes_tenant_isolation ON certificate_wallet_passes
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS certificate_wallet_passes_platform_scope ON certificate_wallet_passes;
CREATE POLICY certificate_wallet_passes_platform_scope ON certificate_wallet_passes
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
