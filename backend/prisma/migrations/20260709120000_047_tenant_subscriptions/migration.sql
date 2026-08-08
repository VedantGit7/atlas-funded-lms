-- Migration 047: tenant subscriptions (academy plan/billing summary rows).

-- CreateTable
CREATE TABLE "tenant_subscriptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_name" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" TEXT NOT NULL,
    "duration_type" TEXT NOT NULL,
    "next_billing_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenant_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_subscriptions_tenant_id_status_idx" ON "tenant_subscriptions"("tenant_id", "status");

-- Demo data: seed a subscription row for the FundedBeyond demo tenant only.
-- Runs before RLS is forced; safe no-op on databases without that tenant.
INSERT INTO "tenant_subscriptions" (
    "id", "tenant_id", "plan_name", "currency", "status", "duration_type", "next_billing_at", "created_at", "updated_at"
)
SELECT
    'a5b1c2d3-4e5f-4a6b-8c7d-0000000047ab',
    t."id",
    'Professional Plan',
    'INR',
    'trial',
    'monthly',
    now() + interval '7 days',
    now(),
    now()
FROM "tenants" t
WHERE t."slug" = 'fundedbeyond'
ON CONFLICT ("id") DO NOTHING;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_subscriptions TO atlas_app, atlas_worker, atlas_platform;

-- Row level security (tenant isolation + platform scope), mirroring migration 045.
ALTER TABLE tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_subscriptions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_subscriptions_tenant_isolation ON tenant_subscriptions;
CREATE POLICY tenant_subscriptions_tenant_isolation ON tenant_subscriptions
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS tenant_subscriptions_platform_scope ON tenant_subscriptions;
CREATE POLICY tenant_subscriptions_platform_scope ON tenant_subscriptions
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
