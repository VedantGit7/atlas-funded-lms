-- Migration 052: learner billing GST + invoice config columns and billing locations.

ALTER TABLE "learner_billing_config"
  ADD COLUMN "gst_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "gst_number" TEXT,
  ADD COLUMN "gst_percentage" DECIMAL(6,3),
  ADD COLUMN "invoice_prefix" TEXT,
  ADD COLUMN "invoice_next_number" INTEGER,
  ADD COLUMN "invoice_business_name" TEXT;

-- CreateTable
CREATE TABLE "learner_billing_locations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learner_billing_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "learner_billing_locations_tenant_id_idx" ON "learner_billing_locations"("tenant_id");

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON learner_billing_locations TO atlas_app, atlas_worker, atlas_platform;

-- Row level security (tenant isolation + platform scope), mirroring migration 045/047-051.
ALTER TABLE learner_billing_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE learner_billing_locations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS learner_billing_locations_tenant_isolation ON learner_billing_locations;
CREATE POLICY learner_billing_locations_tenant_isolation ON learner_billing_locations
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS learner_billing_locations_platform_scope ON learner_billing_locations;
CREATE POLICY learner_billing_locations_platform_scope ON learner_billing_locations
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
