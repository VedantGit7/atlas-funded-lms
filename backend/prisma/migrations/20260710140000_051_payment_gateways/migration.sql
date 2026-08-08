-- Migration 051: tenant payment gateways (learner billing).
-- Secret keys are stored encrypted (AES-256-GCM) in secret_ciphertext and are
-- never returned to clients; secret_last4 is a masked hint for the UI.

-- CreateTable
CREATE TABLE "payment_gateways" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "gateway_key" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "user_id" TEXT,
    "publishable_key" TEXT,
    "secret_ciphertext" TEXT,
    "secret_last4" TEXT,
    "billing_location_id" UUID,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_configured" BOOLEAN NOT NULL DEFAULT false,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_gateways_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_gateways_tenant_id_gateway_key_key" ON "payment_gateways"("tenant_id", "gateway_key");
CREATE INDEX "payment_gateways_tenant_id_idx" ON "payment_gateways"("tenant_id");

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON payment_gateways TO atlas_app, atlas_worker, atlas_platform;

-- Row level security (tenant isolation + platform scope), mirroring migration 045/047-050.
ALTER TABLE payment_gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_gateways FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_gateways_tenant_isolation ON payment_gateways;
CREATE POLICY payment_gateways_tenant_isolation ON payment_gateways
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS payment_gateways_platform_scope ON payment_gateways;
CREATE POLICY payment_gateways_platform_scope ON payment_gateways
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
