-- Migration 070: Marketing Forms (Learnyst Marketing → Forms).

CREATE TABLE "marketing_forms" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "kind" TEXT NOT NULL DEFAULT 'LEAD',
    "share_token" TEXT NOT NULL,
    "google_signup_enabled" BOOLEAN NOT NULL DEFAULT false,
    "button_text" TEXT NOT NULL DEFAULT 'Submit',
    "button_color" TEXT NOT NULL DEFAULT '#5B5BD6',
    "button_text_color" TEXT NOT NULL DEFAULT '#FFFFFF',
    "thank_you_html" TEXT,
    "redirect_enabled" BOOLEAN NOT NULL DEFAULT false,
    "redirect_url" TEXT,
    "fields_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "created_by_membership_id" UUID NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_forms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketing_forms_tenant_share_token_key"
  ON "marketing_forms"("tenant_id", "share_token");
CREATE INDEX "marketing_forms_tenant_status_created_idx"
  ON "marketing_forms"("tenant_id", "status", "created_at");

CREATE TABLE "marketing_contacts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "phone" TEXT,
    "password_hash" TEXT,
    "source_form_id" UUID,
    "source" TEXT NOT NULL DEFAULT 'FORM',
    "metadata_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_contacts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketing_contacts_tenant_email_key"
  ON "marketing_contacts"("tenant_id", "email");
CREATE INDEX "marketing_contacts_tenant_created_idx"
  ON "marketing_contacts"("tenant_id", "created_at");
CREATE INDEX "marketing_contacts_tenant_source_form_idx"
  ON "marketing_contacts"("tenant_id", "source_form_id");

CREATE TABLE "marketing_form_submissions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "form_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "answers_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "source" TEXT NOT NULL DEFAULT 'LINK',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_form_submissions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "marketing_form_submissions_tenant_form_created_idx"
  ON "marketing_form_submissions"("tenant_id", "form_id", "created_at");
CREATE INDEX "marketing_form_submissions_tenant_contact_created_idx"
  ON "marketing_form_submissions"("tenant_id", "contact_id", "created_at");

-- Allow workflow runs for form leads without a membership yet.
ALTER TABLE "marketing_workflow_runs" ALTER COLUMN "membership_id" DROP NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_forms TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_contacts TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_form_submissions TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE marketing_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_forms FORCE ROW LEVEL SECURITY;
ALTER TABLE marketing_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE marketing_form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_form_submissions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_forms_tenant_isolation ON marketing_forms;
CREATE POLICY marketing_forms_tenant_isolation ON marketing_forms
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS marketing_forms_platform_scope ON marketing_forms;
CREATE POLICY marketing_forms_platform_scope ON marketing_forms
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS marketing_contacts_tenant_isolation ON marketing_contacts;
CREATE POLICY marketing_contacts_tenant_isolation ON marketing_contacts
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS marketing_contacts_platform_scope ON marketing_contacts;
CREATE POLICY marketing_contacts_platform_scope ON marketing_contacts
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS marketing_form_submissions_tenant_isolation ON marketing_form_submissions;
CREATE POLICY marketing_form_submissions_tenant_isolation ON marketing_form_submissions
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS marketing_form_submissions_platform_scope ON marketing_form_submissions;
CREATE POLICY marketing_form_submissions_platform_scope ON marketing_form_submissions
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);
