-- Migration 077: Sales Wallets (Learnyst Sales → Wallets).

CREATE TABLE "sales_wallet_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "credit_value_cents" INTEGER NOT NULL DEFAULT 100,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "max_balance_credits" INTEGER,
    "max_credits_per_order" INTEGER,
    "updated_by_membership_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_wallet_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_wallet_configs_tenant_id_key" ON "sales_wallet_configs"("tenant_id");

CREATE TABLE "sales_wallets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "balance_credits" INTEGER NOT NULL DEFAULT 0,
    "earned_credits" INTEGER NOT NULL DEFAULT 0,
    "used_credits" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_wallets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_wallets_tenant_membership_key" ON "sales_wallets"("tenant_id", "membership_id");
CREATE INDEX "sales_wallets_tenant_balance_idx" ON "sales_wallets"("tenant_id", "balance_credits");

CREATE TABLE "sales_wallet_transactions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "direction" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "money_cents" INTEGER,
    "currency" TEXT,
    "payment_order_id" UUID,
    "course_id" UUID,
    "note" TEXT,
    "created_by_membership_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_wallet_transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sales_wallet_transactions_tenant_membership_created_idx"
  ON "sales_wallet_transactions"("tenant_id", "membership_id", "created_at");
CREATE INDEX "sales_wallet_transactions_tenant_wallet_created_idx"
  ON "sales_wallet_transactions"("tenant_id", "wallet_id", "created_at");
CREATE INDEX "sales_wallet_transactions_tenant_reason_created_idx"
  ON "sales_wallet_transactions"("tenant_id", "reason", "created_at");

GRANT SELECT, INSERT, UPDATE, DELETE ON sales_wallet_configs TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_wallets TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_wallet_transactions TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE sales_wallet_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_wallet_configs FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_wallets FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_wallet_transactions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sales_wallet_configs_tenant_isolation ON sales_wallet_configs;
CREATE POLICY sales_wallet_configs_tenant_isolation ON sales_wallet_configs
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS sales_wallet_configs_platform_scope ON sales_wallet_configs;
CREATE POLICY sales_wallet_configs_platform_scope ON sales_wallet_configs
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sales_wallets_tenant_isolation ON sales_wallets;
CREATE POLICY sales_wallets_tenant_isolation ON sales_wallets
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS sales_wallets_platform_scope ON sales_wallets;
CREATE POLICY sales_wallets_platform_scope ON sales_wallets
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sales_wallet_transactions_tenant_isolation ON sales_wallet_transactions;
CREATE POLICY sales_wallet_transactions_tenant_isolation ON sales_wallet_transactions
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS sales_wallet_transactions_platform_scope ON sales_wallet_transactions;
CREATE POLICY sales_wallet_transactions_platform_scope ON sales_wallet_transactions
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);
