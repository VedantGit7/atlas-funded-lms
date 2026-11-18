-- Agreement to an academy's Terms and Privacy Policy (launch plan task 5.7).
--
-- A membership is only opened once its person has ticked "I agree", and this
-- records that they did: when, how (the sign-up form, Google sign-up, the join
-- page or an invitation) and which published versions they saw. The versions
-- are each document's "last updated" date, or NULL when the academy had not
-- published that document yet.
--
-- Rows are evidence, so they are only ever inserted. They are keyed to the
-- membership, which survives a data-erasure request as an anonymised record,
-- so the proof of consent outlives the personal data it covered.

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE public.tenant_legal_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL,
  source text NOT NULL CHECK (source IN ('signup', 'google_signup', 'join', 'invitation')),
  terms_version text CHECK (terms_version IS NULL OR length(terms_version) BETWEEN 1 AND 100),
  privacy_version text CHECK (privacy_version IS NULL OR length(privacy_version) BETWEEN 1 AND 100),
  accepted_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_legal_acceptances_membership_id_tenant_fkey
    FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships(tenant_id, id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE INDEX tenant_legal_acceptances_membership_idx
  ON public.tenant_legal_acceptances (tenant_id, membership_id, accepted_at DESC);

ALTER TABLE public.tenant_legal_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_legal_acceptances FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_legal_acceptances_tenant_isolation ON public.tenant_legal_acceptances
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
CREATE POLICY tenant_legal_acceptances_platform_scope ON public.tenant_legal_acceptances
  FOR SELECT TO atlas_platform USING (true);
GRANT SELECT, INSERT ON public.tenant_legal_acceptances TO atlas_app;
GRANT SELECT ON public.tenant_legal_acceptances TO atlas_worker, atlas_platform;

COMMENT ON TABLE public.tenant_legal_acceptances IS
  'Launch plan 5.7: insert-only record of each member agreeing to the academy''s Terms and Privacy Policy before their membership was opened.';

COMMIT;
