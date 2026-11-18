-- Member erasure (launch plan 5.7, docs/engineering/member-erasure.md).
--
-- A processed deletion request now erases the member's personal data in one
-- academy instead of only removing their access. The membership row stays as
-- an anonymised tombstone (erased_at), so the records the academy keeps
-- (certificates, payments, agreement records, community posts) still point at
-- "Deleted member".
--
-- member_erasures is the durable log of erasures: what was erased, when, the
-- files still to delete, and the global account to delete if no other academy
-- uses it. An open row in the current transaction is also what lets
-- app.reject_update_delete() accept the erasure's own deletes and payload
-- redactions on append-only tables. Only app.erase_member() writes it.
--
-- audit_entry_redactions keeps the original payload hashes of audit entries
-- whose payloads an erasure redacted, so app.verify_audit_chain() still
-- verifies the chain.
--
-- Functions, the append-only trigger and grants are in backend/prisma/sql,
-- applied after the migrations on every release.

BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.memberships ADD COLUMN erased_at timestamptz;

CREATE TABLE public.member_erasures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL,
  deletion_request_id uuid REFERENCES public.deletion_requests(id) ON DELETE SET NULL,
  -- The global account at the time of erasure: deleted afterwards unless
  -- another academy uses it. Kept so a restored backup can be re-erased.
  principal_id uuid,
  txid bigint NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  database_completed_at timestamptz,
  completed_at timestamptz,
  -- [{"bucket": text | null, "key": text}] still to delete from storage.
  pending_objects jsonb NOT NULL DEFAULT '[]'::jsonb,
  outcome_json jsonb,
  CONSTRAINT member_erasures_membership_id_tenant_fkey
    FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships(tenant_id, id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT member_erasures_one_per_membership UNIQUE (tenant_id, membership_id)
);

CREATE INDEX member_erasures_txid_idx ON public.member_erasures (txid);
CREATE INDEX member_erasures_incomplete_idx
  ON public.member_erasures (tenant_id, started_at) WHERE completed_at IS NULL;

CREATE TABLE public.audit_entry_redactions (
  audit_entry_id uuid PRIMARY KEY REFERENCES public.audit_entries(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  member_erasure_id uuid NOT NULL REFERENCES public.member_erasures(id) ON DELETE RESTRICT,
  -- app.jsonb_sha256() of each payload before it was redacted; NULL when the
  -- payload itself was NULL, as the hash chain records it.
  before_sha256 text,
  after_sha256 text,
  metadata_sha256 text,
  redacted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_entry_redactions_tenant_idx ON public.audit_entry_redactions (tenant_id);

ALTER TABLE public.member_erasures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_erasures FORCE ROW LEVEL SECURITY;
CREATE POLICY member_erasures_tenant_isolation ON public.member_erasures
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
CREATE POLICY member_erasures_platform_scope ON public.member_erasures
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);

ALTER TABLE public.audit_entry_redactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_entry_redactions FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_entry_redactions_tenant_isolation ON public.audit_entry_redactions
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
CREATE POLICY audit_entry_redactions_platform_scope ON public.audit_entry_redactions
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);

COMMENT ON TABLE public.member_erasures IS
  'Launch plan 5.7: durable log of member erasures; written only by app.erase_member().';
COMMENT ON TABLE public.audit_entry_redactions IS
  'Launch plan 5.7: original payload hashes of audit entries redacted by a member erasure.';

COMMIT;
