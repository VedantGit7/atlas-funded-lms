-- Migration 072: Marketing Promo Slider (Learnyst Marketing → Promo Slider).

CREATE TABLE "marketing_promo_sliders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_by_membership_id" UUID NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_promo_sliders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "marketing_promo_sliders_tenant_status_created_idx"
  ON "marketing_promo_sliders"("tenant_id", "status", "created_at");

CREATE TABLE "marketing_promo_slides" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "slider_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "image_url" TEXT,
    "image_fit" TEXT NOT NULL DEFAULT 'COVER',
    "link_url" TEXT,
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_promo_slides_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "marketing_promo_slides_tenant_slider_sort_idx"
  ON "marketing_promo_slides"("tenant_id", "slider_id", "sort_order");
CREATE INDEX "marketing_promo_slides_tenant_ends_idx"
  ON "marketing_promo_slides"("tenant_id", "ends_at");

GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_promo_sliders TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_promo_slides TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE marketing_promo_sliders ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_promo_sliders FORCE ROW LEVEL SECURITY;
ALTER TABLE marketing_promo_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_promo_slides FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_promo_sliders_tenant_isolation ON marketing_promo_sliders;
CREATE POLICY marketing_promo_sliders_tenant_isolation ON marketing_promo_sliders
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS marketing_promo_sliders_platform_scope ON marketing_promo_sliders;
CREATE POLICY marketing_promo_sliders_platform_scope ON marketing_promo_sliders
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS marketing_promo_slides_tenant_isolation ON marketing_promo_slides;
CREATE POLICY marketing_promo_slides_tenant_isolation ON marketing_promo_slides
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS marketing_promo_slides_platform_scope ON marketing_promo_slides;
CREATE POLICY marketing_promo_slides_platform_scope ON marketing_promo_slides
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);
