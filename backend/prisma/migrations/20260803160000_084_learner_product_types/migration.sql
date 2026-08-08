-- Learnyst-style learner product types: Mock Test, Test Series, Bundle, Subscription.

CREATE TABLE IF NOT EXISTS "mock_tests" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "assessment_id" UUID NOT NULL,
  "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
  "metadata_json" JSONB,
  "created_by_membership_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "mock_tests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "mock_tests_tenant_id_slug_key" ON "mock_tests"("tenant_id", "slug");
CREATE INDEX IF NOT EXISTS "mock_tests_tenant_id_status_updated_at_idx" ON "mock_tests"("tenant_id", "status", "updated_at");
CREATE INDEX IF NOT EXISTS "mock_tests_tenant_id_assessment_id_idx" ON "mock_tests"("tenant_id", "assessment_id");

CREATE TABLE IF NOT EXISTS "mock_test_enrollments" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "mock_test_id" UUID NOT NULL,
  "membership_id" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "enrolled_type" TEXT NOT NULL DEFAULT 'free',
  "enrolled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  CONSTRAINT "mock_test_enrollments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mock_test_enrollments_mock_test_id_fkey"
    FOREIGN KEY ("mock_test_id") REFERENCES "mock_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "mock_test_enrollments_tenant_mock_membership_key"
  ON "mock_test_enrollments"("tenant_id", "mock_test_id", "membership_id");
CREATE INDEX IF NOT EXISTS "mock_test_enrollments_tenant_membership_status_idx"
  ON "mock_test_enrollments"("tenant_id", "membership_id", "status");
CREATE INDEX IF NOT EXISTS "mock_test_enrollments_tenant_enrolled_at_idx"
  ON "mock_test_enrollments"("tenant_id", "enrolled_at" DESC);

CREATE TABLE IF NOT EXISTS "test_series" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
  "metadata_json" JSONB,
  "created_by_membership_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "test_series_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "test_series_tenant_id_slug_key" ON "test_series"("tenant_id", "slug");
CREATE INDEX IF NOT EXISTS "test_series_tenant_id_status_updated_at_idx" ON "test_series"("tenant_id", "status", "updated_at");

CREATE TABLE IF NOT EXISTS "test_series_items" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "test_series_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "title" TEXT,
  "mock_test_id" UUID,
  "assessment_id" UUID,
  "config_json" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "test_series_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "test_series_items_test_series_id_fkey"
    FOREIGN KEY ("test_series_id") REFERENCES "test_series"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "test_series_items_tenant_series_position_key"
  ON "test_series_items"("tenant_id", "test_series_id", "position");
CREATE INDEX IF NOT EXISTS "test_series_items_tenant_series_idx" ON "test_series_items"("tenant_id", "test_series_id");
CREATE INDEX IF NOT EXISTS "test_series_items_tenant_mock_test_idx" ON "test_series_items"("tenant_id", "mock_test_id");
CREATE INDEX IF NOT EXISTS "test_series_items_tenant_assessment_idx" ON "test_series_items"("tenant_id", "assessment_id");

CREATE TABLE IF NOT EXISTS "test_series_enrollments" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "test_series_id" UUID NOT NULL,
  "membership_id" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "enrolled_type" TEXT NOT NULL DEFAULT 'free',
  "enrolled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  CONSTRAINT "test_series_enrollments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "test_series_enrollments_test_series_id_fkey"
    FOREIGN KEY ("test_series_id") REFERENCES "test_series"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "test_series_enrollments_tenant_series_membership_key"
  ON "test_series_enrollments"("tenant_id", "test_series_id", "membership_id");
CREATE INDEX IF NOT EXISTS "test_series_enrollments_tenant_membership_status_idx"
  ON "test_series_enrollments"("tenant_id", "membership_id", "status");
CREATE INDEX IF NOT EXISTS "test_series_enrollments_tenant_enrolled_at_idx"
  ON "test_series_enrollments"("tenant_id", "enrolled_at" DESC);

CREATE TABLE IF NOT EXISTS "test_series_item_progress" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "test_series_item_id" UUID NOT NULL,
  "membership_id" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'not_started',
  "score_pct" DECIMAL(8,4),
  "attempt_id" UUID,
  "completed_at" TIMESTAMPTZ(6),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "test_series_item_progress_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "test_series_item_progress_item_id_fkey"
    FOREIGN KEY ("test_series_item_id") REFERENCES "test_series_items"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "test_series_item_progress_tenant_item_membership_key"
  ON "test_series_item_progress"("tenant_id", "test_series_item_id", "membership_id");
CREATE INDEX IF NOT EXISTS "test_series_item_progress_tenant_membership_updated_idx"
  ON "test_series_item_progress"("tenant_id", "membership_id", "updated_at");

CREATE TABLE IF NOT EXISTS "bundles" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
  "metadata_json" JSONB,
  "created_by_membership_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "bundles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "bundles_tenant_id_slug_key" ON "bundles"("tenant_id", "slug");
CREATE INDEX IF NOT EXISTS "bundles_tenant_id_status_updated_at_idx" ON "bundles"("tenant_id", "status", "updated_at");

CREATE TABLE IF NOT EXISTS "bundle_items" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "bundle_id" UUID NOT NULL,
  "item_kind" TEXT NOT NULL,
  "ref_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bundle_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bundle_items_bundle_id_fkey"
    FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "bundle_items_tenant_bundle_position_key" ON "bundle_items"("tenant_id", "bundle_id", "position");
CREATE UNIQUE INDEX IF NOT EXISTS "bundle_items_tenant_bundle_kind_ref_key" ON "bundle_items"("tenant_id", "bundle_id", "item_kind", "ref_id");
CREATE INDEX IF NOT EXISTS "bundle_items_tenant_bundle_idx" ON "bundle_items"("tenant_id", "bundle_id");

CREATE TABLE IF NOT EXISTS "bundle_enrollments" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "bundle_id" UUID NOT NULL,
  "membership_id" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "enrolled_type" TEXT NOT NULL DEFAULT 'free',
  "enrolled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  CONSTRAINT "bundle_enrollments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bundle_enrollments_bundle_id_fkey"
    FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "bundle_enrollments_tenant_bundle_membership_key"
  ON "bundle_enrollments"("tenant_id", "bundle_id", "membership_id");
CREATE INDEX IF NOT EXISTS "bundle_enrollments_tenant_membership_status_idx"
  ON "bundle_enrollments"("tenant_id", "membership_id", "status");
CREATE INDEX IF NOT EXISTS "bundle_enrollments_tenant_enrolled_at_idx"
  ON "bundle_enrollments"("tenant_id", "enrolled_at" DESC);

CREATE TABLE IF NOT EXISTS "learner_subscription_plans" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "billing_interval" TEXT NOT NULL DEFAULT 'monthly',
  "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
  "metadata_json" JSONB,
  "created_by_membership_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "learner_subscription_plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "learner_subscription_plans_tenant_id_slug_key" ON "learner_subscription_plans"("tenant_id", "slug");
CREATE INDEX IF NOT EXISTS "learner_subscription_plans_tenant_status_updated_idx"
  ON "learner_subscription_plans"("tenant_id", "status", "updated_at");

CREATE TABLE IF NOT EXISTS "learner_subscription_plan_items" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "item_kind" TEXT NOT NULL,
  "ref_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "learner_subscription_plan_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "learner_subscription_plan_items_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "learner_subscription_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "learner_subscription_plan_items_tenant_plan_position_key"
  ON "learner_subscription_plan_items"("tenant_id", "plan_id", "position");
CREATE UNIQUE INDEX IF NOT EXISTS "learner_subscription_plan_items_tenant_plan_kind_ref_key"
  ON "learner_subscription_plan_items"("tenant_id", "plan_id", "item_kind", "ref_id");
CREATE INDEX IF NOT EXISTS "learner_subscription_plan_items_tenant_plan_idx"
  ON "learner_subscription_plan_items"("tenant_id", "plan_id");

CREATE TABLE IF NOT EXISTS "learner_subscription_enrollments" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "membership_id" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "enrolled_type" TEXT NOT NULL DEFAULT 'free',
  "enrolled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "current_period_start" TIMESTAMPTZ(6),
  "current_period_end" TIMESTAMPTZ(6),
  "expires_at" TIMESTAMPTZ(6),
  "cancelled_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  CONSTRAINT "learner_subscription_enrollments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "learner_subscription_enrollments_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "learner_subscription_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "learner_subscription_enrollments_tenant_plan_membership_key"
  ON "learner_subscription_enrollments"("tenant_id", "plan_id", "membership_id");
CREATE INDEX IF NOT EXISTS "learner_subscription_enrollments_tenant_membership_status_idx"
  ON "learner_subscription_enrollments"("tenant_id", "membership_id", "status");
CREATE INDEX IF NOT EXISTS "learner_subscription_enrollments_tenant_enrolled_at_idx"
  ON "learner_subscription_enrollments"("tenant_id", "enrolled_at" DESC);

-- Grants + RLS for all new tables
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'mock_tests',
    'mock_test_enrollments',
    'test_series',
    'test_series_items',
    'test_series_enrollments',
    'test_series_item_progress',
    'bundles',
    'bundle_items',
    'bundle_enrollments',
    'learner_subscription_plans',
    'learner_subscription_plan_items',
    'learner_subscription_enrollments'
  ]
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO atlas_app, atlas_worker, atlas_platform', t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_isolation', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO atlas_app, atlas_worker USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id())',
      t || '_tenant_isolation', t
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_platform_scope', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO atlas_platform USING (true) WITH CHECK (true)',
      t || '_platform_scope', t
    );
  END LOOP;
END $$;
