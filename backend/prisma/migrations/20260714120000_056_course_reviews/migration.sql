-- Migration 056: learner course reviews (ratings + comments) powering catalog aggregates.

-- CreateTable
CREATE TABLE "course_reviews" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "rating" SMALLINT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "course_reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "course_reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5)
);

-- CreateIndex
CREATE UNIQUE INDEX "course_reviews_tenant_course_member_key" ON "course_reviews"("tenant_id", "course_id", "membership_id");
CREATE INDEX "course_reviews_tenant_course_idx" ON "course_reviews"("tenant_id", "course_id");
CREATE INDEX "course_reviews_tenant_member_idx" ON "course_reviews"("tenant_id", "membership_id");

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON course_reviews TO atlas_app, atlas_worker, atlas_platform;

-- Row level security (tenant isolation + platform scope), mirroring migration 055.
ALTER TABLE course_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_reviews FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_reviews_tenant_isolation ON course_reviews;
CREATE POLICY course_reviews_tenant_isolation ON course_reviews
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS course_reviews_platform_scope ON course_reviews;
CREATE POLICY course_reviews_platform_scope ON course_reviews
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
