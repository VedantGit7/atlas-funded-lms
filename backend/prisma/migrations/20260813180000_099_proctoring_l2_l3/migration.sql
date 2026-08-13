-- L2/L3 proctoring: session level + consent, identity verifications, media artifacts.

ALTER TABLE "proctoring_sessions"
  ADD COLUMN IF NOT EXISTS "level" INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "consent_json" JSONB;

CREATE TABLE IF NOT EXISTS "identity_verifications" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "proctoring_session_id" UUID NOT NULL,
  "membership_id" UUID NOT NULL,
  "status" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "score" DECIMAL(8, 4),
  "metadata_json" JSONB,
  "verified_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "identity_verifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "identity_verifications_proctoring_session_id_key"
  ON "identity_verifications" ("proctoring_session_id");

CREATE INDEX IF NOT EXISTS "identity_verifications_tenant_id_membership_id_created_at_idx"
  ON "identity_verifications" ("tenant_id", "membership_id", "created_at");

GRANT SELECT, INSERT, UPDATE, DELETE ON identity_verifications TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE identity_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_verifications FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS identity_verifications_tenant_isolation ON identity_verifications;
CREATE POLICY identity_verifications_tenant_isolation
  ON identity_verifications
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS identity_verifications_platform_scope ON identity_verifications;
CREATE POLICY identity_verifications_platform_scope
  ON identity_verifications
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS "proctoring_media_artifacts" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "proctoring_session_id" UUID NOT NULL,
  "proctoring_event_id" UUID,
  "kind" TEXT NOT NULL,
  "r2_object_key" TEXT,
  "content_type" TEXT NOT NULL,
  "retention_expires_at" TIMESTAMPTZ(6) NOT NULL,
  "metadata_json" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "proctoring_media_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "proctoring_media_artifacts_tenant_id_session_created_at_idx"
  ON "proctoring_media_artifacts" ("tenant_id", "proctoring_session_id", "created_at");

CREATE INDEX IF NOT EXISTS "proctoring_media_artifacts_tenant_id_retention_expires_at_idx"
  ON "proctoring_media_artifacts" ("tenant_id", "retention_expires_at");

GRANT SELECT, INSERT, UPDATE, DELETE ON proctoring_media_artifacts TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE proctoring_media_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE proctoring_media_artifacts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS proctoring_media_artifacts_tenant_isolation ON proctoring_media_artifacts;
CREATE POLICY proctoring_media_artifacts_tenant_isolation
  ON proctoring_media_artifacts
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS proctoring_media_artifacts_platform_scope ON proctoring_media_artifacts;
CREATE POLICY proctoring_media_artifacts_platform_scope
  ON proctoring_media_artifacts
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
