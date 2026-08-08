-- Migration 075: Marketing Newsfeed (Learnyst Marketing → Newsfeed).

CREATE TABLE "marketing_newsfeed_settings" (
    "tenant_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_newsfeed_settings_pkey" PRIMARY KEY ("tenant_id")
);

CREATE TABLE "marketing_newsfeed_posts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "post_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "body_html" TEXT,
    "cover_image_url" TEXT,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "author_name" TEXT,
    "tags_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "categories_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "product_id" UUID,
    "product_title" TEXT,
    "created_by_membership_id" UUID NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_newsfeed_posts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketing_newsfeed_posts_tenant_slug_uidx"
  ON "marketing_newsfeed_posts"("tenant_id", "slug");
CREATE INDEX "marketing_newsfeed_posts_tenant_status_created_idx"
  ON "marketing_newsfeed_posts"("tenant_id", "status", "created_at");
CREATE INDEX "marketing_newsfeed_posts_tenant_type_status_idx"
  ON "marketing_newsfeed_posts"("tenant_id", "post_type", "status");
CREATE INDEX "marketing_newsfeed_posts_tenant_product_idx"
  ON "marketing_newsfeed_posts"("tenant_id", "product_id");
CREATE INDEX "marketing_newsfeed_posts_tenant_pinned_published_idx"
  ON "marketing_newsfeed_posts"("tenant_id", "pinned", "published_at");

CREATE TABLE "marketing_newsfeed_saves" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_newsfeed_saves_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketing_newsfeed_saves_tenant_post_membership_uidx"
  ON "marketing_newsfeed_saves"("tenant_id", "post_id", "membership_id");
CREATE INDEX "marketing_newsfeed_saves_tenant_membership_created_idx"
  ON "marketing_newsfeed_saves"("tenant_id", "membership_id", "created_at");

GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_newsfeed_settings TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_newsfeed_posts TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_newsfeed_saves TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE marketing_newsfeed_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_newsfeed_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE marketing_newsfeed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_newsfeed_posts FORCE ROW LEVEL SECURITY;
ALTER TABLE marketing_newsfeed_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_newsfeed_saves FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_newsfeed_settings_tenant_isolation ON marketing_newsfeed_settings;
CREATE POLICY marketing_newsfeed_settings_tenant_isolation ON marketing_newsfeed_settings
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS marketing_newsfeed_settings_platform_scope ON marketing_newsfeed_settings;
CREATE POLICY marketing_newsfeed_settings_platform_scope ON marketing_newsfeed_settings
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS marketing_newsfeed_posts_tenant_isolation ON marketing_newsfeed_posts;
CREATE POLICY marketing_newsfeed_posts_tenant_isolation ON marketing_newsfeed_posts
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS marketing_newsfeed_posts_platform_scope ON marketing_newsfeed_posts;
CREATE POLICY marketing_newsfeed_posts_platform_scope ON marketing_newsfeed_posts
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS marketing_newsfeed_saves_tenant_isolation ON marketing_newsfeed_saves;
CREATE POLICY marketing_newsfeed_saves_tenant_isolation ON marketing_newsfeed_saves
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS marketing_newsfeed_saves_platform_scope ON marketing_newsfeed_saves;
CREATE POLICY marketing_newsfeed_saves_platform_scope ON marketing_newsfeed_saves
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);
