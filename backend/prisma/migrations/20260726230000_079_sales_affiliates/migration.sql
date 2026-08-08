-- Migration 079: Sales Affiliates (Learnyst Sales → Affiliates).

CREATE TABLE "sales_affiliate_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "access_mode" TEXT NOT NULL DEFAULT 'PRIVATE',
    "ask_admin" BOOLEAN NOT NULL DEFAULT true,
    "standard_discount_pct" INTEGER NOT NULL DEFAULT 0,
    "standard_commission_pct" INTEGER NOT NULL DEFAULT 10,
    "premium_discount_pct" INTEGER NOT NULL DEFAULT 0,
    "premium_commission_pct" INTEGER NOT NULL DEFAULT 20,
    "updated_by_membership_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_affiliate_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_affiliate_configs_tenant_id_key" ON "sales_affiliate_configs"("tenant_id");

CREATE TABLE "sales_affiliates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'STANDARD',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "coupon_code" TEXT NOT NULL,
    "payout_upi" TEXT,
    "payout_bank_account" TEXT,
    "payout_ifsc" TEXT,
    "payout_account_name" TEXT,
    "created_by_membership_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_affiliates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_affiliates_tenant_membership_key" ON "sales_affiliates"("tenant_id", "membership_id");
CREATE UNIQUE INDEX "sales_affiliates_tenant_coupon_key" ON "sales_affiliates"("tenant_id", "coupon_code");
CREATE INDEX "sales_affiliates_tenant_status_idx" ON "sales_affiliates"("tenant_id", "status");

CREATE TABLE "sales_affiliate_products" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "standard_discount_pct" INTEGER,
    "standard_commission_pct" INTEGER,
    "premium_discount_pct" INTEGER,
    "premium_commission_pct" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_affiliate_products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_affiliate_products_tenant_course_key"
  ON "sales_affiliate_products"("tenant_id", "course_id");
CREATE INDEX "sales_affiliate_products_tenant_enabled_idx"
  ON "sales_affiliate_products"("tenant_id", "enabled");

CREATE TABLE "sales_affiliate_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "reviewed_by_membership_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_affiliate_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sales_affiliate_requests_tenant_status_idx"
  ON "sales_affiliate_requests"("tenant_id", "status", "created_at");
CREATE UNIQUE INDEX "sales_affiliate_requests_tenant_membership_pending_key"
  ON "sales_affiliate_requests"("tenant_id", "membership_id")
  WHERE status = 'PENDING';

CREATE TABLE "sales_affiliate_commissions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "affiliate_id" UUID NOT NULL,
    "affiliate_membership_id" UUID NOT NULL,
    "buyer_membership_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "payment_order_id" UUID NOT NULL,
    "coupon_code_snapshot" TEXT NOT NULL,
    "tier_snapshot" TEXT NOT NULL,
    "order_amount_cents" INTEGER NOT NULL,
    "discount_cents" INTEGER NOT NULL,
    "commission_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "payout_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_affiliate_commissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_affiliate_commissions_tenant_order_key"
  ON "sales_affiliate_commissions"("tenant_id", "payment_order_id");
CREATE INDEX "sales_affiliate_commissions_tenant_affiliate_status_idx"
  ON "sales_affiliate_commissions"("tenant_id", "affiliate_id", "status");

CREATE TABLE "sales_affiliate_payouts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "affiliate_id" UUID NOT NULL,
    "affiliate_membership_id" UUID NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "note" TEXT,
    "marked_by_membership_id" UUID,
    "paid_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_affiliate_payouts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sales_affiliate_payouts_tenant_affiliate_paid_idx"
  ON "sales_affiliate_payouts"("tenant_id", "affiliate_id", "paid_at");

GRANT SELECT, INSERT, UPDATE, DELETE ON sales_affiliate_configs TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_affiliates TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_affiliate_products TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_affiliate_requests TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_affiliate_commissions TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_affiliate_payouts TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE sales_affiliate_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_affiliate_configs FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_affiliates FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_affiliate_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_affiliate_products FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_affiliate_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_affiliate_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_affiliate_commissions FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_affiliate_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_affiliate_payouts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sales_affiliate_configs_tenant_isolation ON sales_affiliate_configs;
CREATE POLICY sales_affiliate_configs_tenant_isolation ON sales_affiliate_configs
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS sales_affiliate_configs_platform_scope ON sales_affiliate_configs;
CREATE POLICY sales_affiliate_configs_platform_scope ON sales_affiliate_configs
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sales_affiliates_tenant_isolation ON sales_affiliates;
CREATE POLICY sales_affiliates_tenant_isolation ON sales_affiliates
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS sales_affiliates_platform_scope ON sales_affiliates;
CREATE POLICY sales_affiliates_platform_scope ON sales_affiliates
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sales_affiliate_products_tenant_isolation ON sales_affiliate_products;
CREATE POLICY sales_affiliate_products_tenant_isolation ON sales_affiliate_products
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS sales_affiliate_products_platform_scope ON sales_affiliate_products;
CREATE POLICY sales_affiliate_products_platform_scope ON sales_affiliate_products
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sales_affiliate_requests_tenant_isolation ON sales_affiliate_requests;
CREATE POLICY sales_affiliate_requests_tenant_isolation ON sales_affiliate_requests
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS sales_affiliate_requests_platform_scope ON sales_affiliate_requests;
CREATE POLICY sales_affiliate_requests_platform_scope ON sales_affiliate_requests
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sales_affiliate_commissions_tenant_isolation ON sales_affiliate_commissions;
CREATE POLICY sales_affiliate_commissions_tenant_isolation ON sales_affiliate_commissions
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS sales_affiliate_commissions_platform_scope ON sales_affiliate_commissions;
CREATE POLICY sales_affiliate_commissions_platform_scope ON sales_affiliate_commissions
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sales_affiliate_payouts_tenant_isolation ON sales_affiliate_payouts;
CREATE POLICY sales_affiliate_payouts_tenant_isolation ON sales_affiliate_payouts
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS sales_affiliate_payouts_platform_scope ON sales_affiliate_payouts;
CREATE POLICY sales_affiliate_payouts_platform_scope ON sales_affiliate_payouts
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);
