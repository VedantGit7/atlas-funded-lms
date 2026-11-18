-- Atlas LMS Migration 006 supplement
-- Verifies audit hash chain integrity for a tenant stream.

CREATE OR REPLACE FUNCTION app.verify_audit_chain(
  p_tenant_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 1000
)
RETURNS TABLE (
  checked integer,
  valid boolean,
  first_broken_audit_entry_id uuid
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  rec record;
  previous_entry_hash text := '';
  expected_hash text;
  checked_count integer := 0;
BEGIN
  FOR rec IN
    SELECT
      ae.id,
      ae.tenant_id,
      ae.actor_membership_id,
      ae.actor_principal_id,
      ae.action,
      ae.target_type,
      ae.target_id,
      ae.request_id,
      ae.ip_hash,
      ae.user_agent_hash,
      ae.before_json,
      ae.after_json,
      ae.metadata_json,
      ae.occurred_at,
      ae.entry_hash,
      -- A member erasure redacted this entry's payloads (member-erasure.md):
      -- the chain is checked against the hashes of the originals.
      (r.audit_entry_id IS NOT NULL) AS redacted,
      r.before_sha256,
      r.after_sha256,
      r.metadata_sha256
    FROM audit_entries ae
    LEFT JOIN audit_entry_redactions r ON r.audit_entry_id = ae.id
    WHERE ae.tenant_id IS NOT DISTINCT FROM p_tenant_id
    ORDER BY ae.occurred_at ASC, ae.id ASC
    LIMIT GREATEST(p_limit, 0)
  LOOP
    checked_count := checked_count + 1;

    expected_hash := app.sha256_hex(
      concat_ws(
        '|',
        coalesce(previous_entry_hash, ''),
        coalesce(rec.tenant_id::text, ''),
        coalesce(rec.actor_membership_id::text, ''),
        coalesce(rec.actor_principal_id::text, ''),
        coalesce(rec.action, ''),
        coalesce(rec.target_type, ''),
        coalesce(rec.target_id, ''),
        coalesce(rec.request_id, ''),
        coalesce(rec.ip_hash, ''),
        coalesce(rec.user_agent_hash, ''),
        coalesce(CASE WHEN rec.redacted THEN rec.before_sha256 ELSE app.jsonb_sha256(rec.before_json) END, ''),
        coalesce(CASE WHEN rec.redacted THEN rec.after_sha256 ELSE app.jsonb_sha256(rec.after_json) END, ''),
        coalesce(CASE WHEN rec.redacted THEN rec.metadata_sha256 ELSE app.jsonb_sha256(rec.metadata_json) END, ''),
        coalesce(rec.occurred_at::text, '')
      )
    );

    IF rec.entry_hash IS DISTINCT FROM expected_hash THEN
      RETURN QUERY SELECT checked_count, false, rec.id;
      RETURN;
    END IF;

    previous_entry_hash := rec.entry_hash;
  END LOOP;

  RETURN QUERY SELECT checked_count, true, NULL::uuid;
END;
$$;
