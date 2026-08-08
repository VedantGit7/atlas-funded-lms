-- Migration 041: rewards shop — currencies, member balances, reward catalog, redemptions (gamification Phase 4).

-- CreateTable
CREATE TABLE "gamification_currencies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "earn_rules_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gamification_currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_balances" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "currency_key" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "member_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cost_currency_key" TEXT NOT NULL,
    "cost_amount" INTEGER NOT NULL,
    "reward_type" TEXT NOT NULL,
    "reward_payload_json" JSONB NOT NULL,
    "stock" INTEGER,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reward_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_redemptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "reward_item_id" UUID NOT NULL,
    "cost_amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "redeemed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gamification_currencies_tenant_id_key_key" ON "gamification_currencies"("tenant_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "member_balances_tenant_id_membership_id_currency_key_key" ON "member_balances"("tenant_id", "membership_id", "currency_key");

-- CreateIndex
CREATE UNIQUE INDEX "reward_items_tenant_id_key_key" ON "reward_items"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "reward_items_tenant_id_status_idx" ON "reward_items"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "reward_redemptions_tenant_id_membership_id_redeemed_at_idx" ON "reward_redemptions"("tenant_id", "membership_id", "redeemed_at");

-- CreateIndex
CREATE INDEX "reward_redemptions_tenant_id_redeemed_at_idx" ON "reward_redemptions"("tenant_id", "redeemed_at");

-- Grants + tenant RLS (same pattern as migrations 039/040).
GRANT SELECT, INSERT, UPDATE, DELETE ON gamification_currencies TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON member_balances TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON reward_items TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON reward_redemptions TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE gamification_currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification_currencies FORCE ROW LEVEL SECURITY;
ALTER TABLE member_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_balances FORCE ROW LEVEL SECURITY;
ALTER TABLE reward_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_items FORCE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gamification_currencies_tenant_isolation ON gamification_currencies;
CREATE POLICY gamification_currencies_tenant_isolation ON gamification_currencies
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS gamification_currencies_platform_scope ON gamification_currencies;
CREATE POLICY gamification_currencies_platform_scope ON gamification_currencies
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS member_balances_tenant_isolation ON member_balances;
CREATE POLICY member_balances_tenant_isolation ON member_balances
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS member_balances_platform_scope ON member_balances;
CREATE POLICY member_balances_platform_scope ON member_balances
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS reward_items_tenant_isolation ON reward_items;
CREATE POLICY reward_items_tenant_isolation ON reward_items
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS reward_items_platform_scope ON reward_items;
CREATE POLICY reward_items_platform_scope ON reward_items
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS reward_redemptions_tenant_isolation ON reward_redemptions;
CREATE POLICY reward_redemptions_tenant_isolation ON reward_redemptions
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS reward_redemptions_platform_scope ON reward_redemptions;
CREATE POLICY reward_redemptions_platform_scope ON reward_redemptions
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
