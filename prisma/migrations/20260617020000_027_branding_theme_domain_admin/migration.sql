-- Sprint 2 branding/theme/domain admin columns used by @atlas/domain-branding

ALTER TABLE tenant_branding
  ADD COLUMN IF NOT EXISTS public_name TEXT,
  ADD COLUMN IF NOT EXISTS logo_light_ref_id UUID,
  ADD COLUMN IF NOT EXISTS logo_dark_ref_id UUID,
  ADD COLUMN IF NOT EXISTS favicon_ref_id UUID,
  ADD COLUMN IF NOT EXISTS issuer_name TEXT,
  ADD COLUMN IF NOT EXISTS public_landing_copy_json JSONB,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ(6);

ALTER TABLE tenant_theme
  ADD COLUMN IF NOT EXISTS tokens_json JSONB,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ(6);

UPDATE tenant_theme
SET tokens_json = COALESCE(tokens_json, token_json, '{"primary":"#112233"}'::jsonb)
WHERE tokens_json IS NULL;

ALTER TABLE tenant_branding_version
  ADD COLUMN IF NOT EXISTS published_by_membership_id UUID,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ(6);

UPDATE tenant_branding_version
SET
  published_by_membership_id = COALESCE(published_by_membership_id, created_by_membership_id),
  published_at = COALESCE(published_at, created_at)
WHERE published_by_membership_id IS NULL OR published_at IS NULL;

ALTER TABLE tenant_theme_version
  ADD COLUMN IF NOT EXISTS published_by_membership_id UUID,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ(6);

UPDATE tenant_theme_version
SET
  published_by_membership_id = COALESCE(published_by_membership_id, created_by_membership_id),
  published_at = COALESCE(published_at, created_at)
WHERE published_by_membership_id IS NULL OR published_at IS NULL;

ALTER TABLE tenant_domains
  ADD COLUMN IF NOT EXISTS verification_txt_name TEXT,
  ADD COLUMN IF NOT EXISTS verification_txt_value TEXT,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;
