-- Learnyst-style Payments report: enrich payment_orders + learner instalment plans.

ALTER TABLE "payment_orders"
  ADD COLUMN IF NOT EXISTS "gateway_key" TEXT,
  ADD COLUMN IF NOT EXISTS "product_title" TEXT,
  ADD COLUMN IF NOT EXISTS "product_type" TEXT,
  ADD COLUMN IF NOT EXISTS "coupon_amount_cents" INTEGER,
  ADD COLUMN IF NOT EXISTS "tax_amount_cents" INTEGER,
  ADD COLUMN IF NOT EXISTS "invoice_number" TEXT,
  ADD COLUMN IF NOT EXISTS "billing_name" TEXT;

CREATE INDEX IF NOT EXISTS "payment_orders_tenant_id_paid_at_idx"
  ON "payment_orders" ("tenant_id", "paid_at" DESC);

CREATE INDEX IF NOT EXISTS "payment_orders_tenant_id_gateway_key_idx"
  ON "payment_orders" ("tenant_id", "gateway_key");

CREATE INDEX IF NOT EXISTS "payment_orders_tenant_id_invoice_number_idx"
  ON "payment_orders" ("tenant_id", "invoice_number");

-- Backfill report fields from existing checkout metadata where present.
UPDATE "payment_orders" po
SET
  "coupon_amount_cents" = COALESCE(
    po."coupon_amount_cents",
    NULLIF(po."metadata_json"->>'discountCents', '')::integer
  ),
  "product_type" = COALESCE(
    po."product_type",
    NULLIF(po."metadata_json"->>'productType', ''),
    CASE WHEN po."metadata_json"->>'kind' = 'course_checkout' THEN 'course' ELSE NULL END
  ),
  "gateway_key" = COALESCE(
    po."gateway_key",
    NULLIF(po."metadata_json"->>'gatewayKey', ''),
    NULLIF(po."metadata_json"->>'gateway_key', '')
  ),
  "product_title" = COALESCE(
    po."product_title",
    NULLIF(po."metadata_json"->>'productTitle', ''),
    NULLIF(po."metadata_json"->>'courseTitle', '')
  )
WHERE po."metadata_json" IS NOT NULL;

UPDATE "payment_orders" po
SET "product_title" = c."title"
FROM "courses" c
WHERE po."product_title" IS NULL
  AND c."tenant_id" = po."tenant_id"
  AND po."metadata_json"->>'courseId' IS NOT NULL
  AND c."id" = (po."metadata_json"->>'courseId')::uuid;

-- Learner instalment plans (not tenant SaaS subscriptions).
CREATE TABLE IF NOT EXISTS "payment_instalment_plans" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "membership_id" UUID NOT NULL,
  "product_title" TEXT NOT NULL,
  "product_type" TEXT NOT NULL DEFAULT 'course',
  "pricing_plan_label" TEXT,
  "total_amount_cents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "remaining_amount_cents" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "metadata_json" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_instalment_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payment_instalment_plans_tenant_status_created_idx"
  ON "payment_instalment_plans" ("tenant_id", "status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "payment_instalment_plans_tenant_membership_idx"
  ON "payment_instalment_plans" ("tenant_id", "membership_id");

CREATE TABLE IF NOT EXISTS "payment_instalments" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "sequence_no" INTEGER NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "due_at" TIMESTAMPTZ(6) NOT NULL,
  "paid_at" TIMESTAMPTZ(6),
  "status" TEXT NOT NULL DEFAULT 'scheduled',
  "payment_order_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_instalments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_instalments_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "payment_instalment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_instalments_tenant_plan_sequence_uidx"
  ON "payment_instalments" ("tenant_id", "plan_id", "sequence_no");

CREATE INDEX IF NOT EXISTS "payment_instalments_tenant_plan_due_idx"
  ON "payment_instalments" ("tenant_id", "plan_id", "due_at");

CREATE INDEX IF NOT EXISTS "payment_instalments_tenant_status_due_idx"
  ON "payment_instalments" ("tenant_id", "status", "due_at");

GRANT SELECT, INSERT, UPDATE, DELETE ON payment_instalment_plans TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON payment_instalments TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE payment_instalment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_instalment_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE payment_instalments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_instalments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_instalment_plans_tenant_isolation ON payment_instalment_plans;
CREATE POLICY payment_instalment_plans_tenant_isolation ON payment_instalment_plans
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS payment_instalment_plans_platform_scope ON payment_instalment_plans;
CREATE POLICY payment_instalment_plans_platform_scope ON payment_instalment_plans
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS payment_instalments_tenant_isolation ON payment_instalments;
CREATE POLICY payment_instalments_tenant_isolation ON payment_instalments
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS payment_instalments_platform_scope ON payment_instalments;
CREATE POLICY payment_instalments_platform_scope ON payment_instalments
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
