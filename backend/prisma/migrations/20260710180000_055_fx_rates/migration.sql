-- Migration 055: tenant-scoped FX rate cache for global multi-currency conversion.

-- CreateTable
CREATE TABLE "fx_rates" (
    "tenant_id" UUID NOT NULL,
    "base_currency" TEXT NOT NULL,
    "quote_currency" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "as_of" DATE NOT NULL,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("tenant_id", "base_currency", "quote_currency")
);

-- CreateIndex
CREATE INDEX "fx_rates_tenant_id_idx" ON "fx_rates"("tenant_id");

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON fx_rates TO atlas_app, atlas_worker, atlas_platform;

-- Row level security (tenant isolation + platform scope), mirroring migration 045/052.
ALTER TABLE fx_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE fx_rates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fx_rates_tenant_isolation ON fx_rates;
CREATE POLICY fx_rates_tenant_isolation ON fx_rates
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS fx_rates_platform_scope ON fx_rates;
CREATE POLICY fx_rates_platform_scope ON fx_rates
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
