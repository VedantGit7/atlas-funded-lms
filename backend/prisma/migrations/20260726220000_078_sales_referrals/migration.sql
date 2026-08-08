-- Migration 078: Sales Referral Codes (Learnyst Sales → Referral Code / Refer & Earn).

CREATE TABLE "sales_referral_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "referrer_signup_credits" INTEGER NOT NULL DEFAULT 0,
    "referee_signup_credits" INTEGER NOT NULL DEFAULT 0,
    "referrer_purchase_credits" INTEGER NOT NULL DEFAULT 0,
    "max_referrals" INTEGER,
    "updated_by_membership_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_referral_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_referral_configs_tenant_id_key" ON "sales_referral_configs"("tenant_id");

CREATE TABLE "sales_referral_codes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_referral_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_referral_codes_tenant_membership_key"
  ON "sales_referral_codes"("tenant_id", "membership_id");
CREATE UNIQUE INDEX "sales_referral_codes_tenant_code_key"
  ON "sales_referral_codes"("tenant_id", "code");
CREATE INDEX "sales_referral_codes_tenant_created_idx"
  ON "sales_referral_codes"("tenant_id", "created_at");

CREATE TABLE "sales_referral_attributions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "referral_code_id" UUID NOT NULL,
    "referrer_membership_id" UUID NOT NULL,
    "referee_membership_id" UUID NOT NULL,
    "code_snapshot" TEXT NOT NULL,
    "signup_credited_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_referral_attributions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_referral_attributions_tenant_referee_key"
  ON "sales_referral_attributions"("tenant_id", "referee_membership_id");
CREATE INDEX "sales_referral_attributions_tenant_referrer_created_idx"
  ON "sales_referral_attributions"("tenant_id", "referrer_membership_id", "created_at");
CREATE INDEX "sales_referral_attributions_tenant_code_created_idx"
  ON "sales_referral_attributions"("tenant_id", "referral_code_id", "created_at");

CREATE TABLE "sales_referral_purchase_credits" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "attribution_id" UUID NOT NULL,
    "payment_order_id" UUID NOT NULL,
    "referrer_membership_id" UUID NOT NULL,
    "referee_membership_id" UUID NOT NULL,
    "credits_applied" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_referral_purchase_credits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_referral_purchase_credits_tenant_order_key"
  ON "sales_referral_purchase_credits"("tenant_id", "payment_order_id");
CREATE INDEX "sales_referral_purchase_credits_tenant_referrer_created_idx"
  ON "sales_referral_purchase_credits"("tenant_id", "referrer_membership_id", "created_at");

CREATE TABLE "sales_referral_pending" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email_normalized" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_referral_pending_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_referral_pending_tenant_email_key"
  ON "sales_referral_pending"("tenant_id", "email_normalized");
CREATE INDEX "sales_referral_pending_tenant_expires_idx"
  ON "sales_referral_pending"("tenant_id", "expires_at");

GRANT SELECT, INSERT, UPDATE, DELETE ON sales_referral_configs TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_referral_codes TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_referral_attributions TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_referral_purchase_credits TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_referral_pending TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE sales_referral_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_referral_configs FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_referral_codes FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_referral_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_referral_attributions FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_referral_purchase_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_referral_purchase_credits FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_referral_pending ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_referral_pending FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sales_referral_configs_tenant_isolation ON sales_referral_configs;
CREATE POLICY sales_referral_configs_tenant_isolation ON sales_referral_configs
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS sales_referral_configs_platform_scope ON sales_referral_configs;
CREATE POLICY sales_referral_configs_platform_scope ON sales_referral_configs
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sales_referral_codes_tenant_isolation ON sales_referral_codes;
CREATE POLICY sales_referral_codes_tenant_isolation ON sales_referral_codes
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS sales_referral_codes_platform_scope ON sales_referral_codes;
CREATE POLICY sales_referral_codes_platform_scope ON sales_referral_codes
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sales_referral_attributions_tenant_isolation ON sales_referral_attributions;
CREATE POLICY sales_referral_attributions_tenant_isolation ON sales_referral_attributions
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS sales_referral_attributions_platform_scope ON sales_referral_attributions;
CREATE POLICY sales_referral_attributions_platform_scope ON sales_referral_attributions
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sales_referral_purchase_credits_tenant_isolation ON sales_referral_purchase_credits;
CREATE POLICY sales_referral_purchase_credits_tenant_isolation ON sales_referral_purchase_credits
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS sales_referral_purchase_credits_platform_scope ON sales_referral_purchase_credits;
CREATE POLICY sales_referral_purchase_credits_platform_scope ON sales_referral_purchase_credits
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sales_referral_pending_tenant_isolation ON sales_referral_pending;
CREATE POLICY sales_referral_pending_tenant_isolation ON sales_referral_pending
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS sales_referral_pending_platform_scope ON sales_referral_pending;
CREATE POLICY sales_referral_pending_platform_scope ON sales_referral_pending
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);
