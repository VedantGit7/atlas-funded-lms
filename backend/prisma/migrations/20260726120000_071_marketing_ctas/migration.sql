-- Migration 071: Marketing CTAs (Learnyst Marketing → CTA).

CREATE TABLE "marketing_ctas" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cta_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "headline" TEXT NOT NULL DEFAULT '',
    "body_html" TEXT,
    "image_url" TEXT,
    "button_text" TEXT NOT NULL DEFAULT 'Learn more',
    "button_color" TEXT NOT NULL DEFAULT '#5B5BD6',
    "button_text_color" TEXT NOT NULL DEFAULT '#FFFFFF',
    "background_color" TEXT NOT NULL DEFAULT '#FFFFFF',
    "link_url" TEXT,
    "form_id" UUID,
    "linked_popup_cta_id" UUID,
    "targeting_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_membership_id" UUID NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_ctas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "marketing_ctas_tenant_status_created_idx"
  ON "marketing_ctas"("tenant_id", "status", "created_at");
CREATE INDEX "marketing_ctas_tenant_type_status_idx"
  ON "marketing_ctas"("tenant_id", "cta_type", "status");
CREATE INDEX "marketing_ctas_tenant_form_idx"
  ON "marketing_ctas"("tenant_id", "form_id");

GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_ctas TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE marketing_ctas ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_ctas FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_ctas_tenant_isolation ON marketing_ctas;
CREATE POLICY marketing_ctas_tenant_isolation ON marketing_ctas
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS marketing_ctas_platform_scope ON marketing_ctas;
CREATE POLICY marketing_ctas_platform_scope ON marketing_ctas
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);
