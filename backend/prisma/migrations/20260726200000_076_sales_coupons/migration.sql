-- Migration 076: Sales Coupons (Learnyst Sales → Coupons).

CREATE TABLE "sales_coupons" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "discount_type" TEXT NOT NULL,
    "discount_value" INTEGER NOT NULL,
    "max_discount_cents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "total_usage_limit" INTEGER,
    "per_learner_limit" INTEGER NOT NULL DEFAULT 1,
    "min_purchase_cents" INTEGER,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "device_type" TEXT NOT NULL DEFAULT 'ALL',
    "applies_to_all_courses" BOOLEAN NOT NULL DEFAULT true,
    "created_by_membership_id" UUID NOT NULL,
    "activated_at" TIMESTAMPTZ(6),
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_coupons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_coupons_tenant_code_key" ON "sales_coupons"("tenant_id", "code");
CREATE INDEX "sales_coupons_tenant_status_created_idx" ON "sales_coupons"("tenant_id", "status", "created_at");
CREATE INDEX "sales_coupons_tenant_visibility_status_idx" ON "sales_coupons"("tenant_id", "visibility", "status");

CREATE TABLE "sales_coupon_courses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_coupon_courses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_coupon_courses_tenant_coupon_course_key"
  ON "sales_coupon_courses"("tenant_id", "coupon_id", "course_id");
CREATE INDEX "sales_coupon_courses_tenant_course_idx" ON "sales_coupon_courses"("tenant_id", "course_id");
CREATE INDEX "sales_coupon_courses_tenant_coupon_idx" ON "sales_coupon_courses"("tenant_id", "coupon_id");

CREATE TABLE "sales_coupon_redemptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "course_id" UUID,
    "payment_order_id" UUID,
    "discount_cents" INTEGER NOT NULL,
    "original_amount_cents" INTEGER NOT NULL,
    "final_amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "code_snapshot" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_coupon_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sales_coupon_redemptions_tenant_coupon_created_idx"
  ON "sales_coupon_redemptions"("tenant_id", "coupon_id", "created_at");
CREATE INDEX "sales_coupon_redemptions_tenant_membership_coupon_idx"
  ON "sales_coupon_redemptions"("tenant_id", "membership_id", "coupon_id");
CREATE INDEX "sales_coupon_redemptions_tenant_payment_order_idx"
  ON "sales_coupon_redemptions"("tenant_id", "payment_order_id");

GRANT SELECT, INSERT, UPDATE, DELETE ON sales_coupons TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_coupon_courses TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_coupon_redemptions TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE sales_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_coupons FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_coupon_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_coupon_courses FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_coupon_redemptions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sales_coupons_tenant_isolation ON sales_coupons;
CREATE POLICY sales_coupons_tenant_isolation ON sales_coupons
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS sales_coupons_platform_scope ON sales_coupons;
CREATE POLICY sales_coupons_platform_scope ON sales_coupons
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sales_coupon_courses_tenant_isolation ON sales_coupon_courses;
CREATE POLICY sales_coupon_courses_tenant_isolation ON sales_coupon_courses
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS sales_coupon_courses_platform_scope ON sales_coupon_courses;
CREATE POLICY sales_coupon_courses_platform_scope ON sales_coupon_courses
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sales_coupon_redemptions_tenant_isolation ON sales_coupon_redemptions;
CREATE POLICY sales_coupon_redemptions_tenant_isolation ON sales_coupon_redemptions
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS sales_coupon_redemptions_platform_scope ON sales_coupon_redemptions;
CREATE POLICY sales_coupon_redemptions_platform_scope ON sales_coupon_redemptions
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);
