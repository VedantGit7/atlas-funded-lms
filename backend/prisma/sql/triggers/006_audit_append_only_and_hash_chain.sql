CREATE OR REPLACE FUNCTION app.reject_update_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  row_tenant uuid;
  erasure_id uuid;
  payload_columns text[];
  old_row jsonb;
  new_row jsonb;
BEGIN
  -- Member erasure (docs/engineering/member-erasure.md): app.erase_member()
  -- opens a member_erasures row for the academy in this transaction. While it
  -- is open, the erasure may delete this academy's rows, and on audit_entries
  -- and outbox_events may replace nothing but the JSON payloads with
  -- {"redacted": true}. Nothing else gets through, for any role. Before the
  -- erasure table exists (fresh setup), there is no exception at all.
  IF to_regclass('public.member_erasures') IS NOT NULL THEN
    old_row := to_jsonb(OLD);
    row_tenant := NULLIF(old_row ->> 'tenant_id', '')::uuid;
    IF row_tenant IS NOT NULL THEN
      SELECT me.id INTO erasure_id
      FROM public.member_erasures me
      WHERE me.tenant_id = row_tenant
        AND me.txid = txid_current()
      LIMIT 1;
    END IF;
  END IF;

  IF erasure_id IS NOT NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;

    payload_columns := CASE TG_TABLE_NAME
      WHEN 'audit_entries' THEN ARRAY['before_json', 'after_json', 'metadata_json']
      WHEN 'outbox_events' THEN ARRAY['payload_json', 'metadata_json']
      ELSE NULL
    END;
    new_row := to_jsonb(NEW);
    IF TG_OP = 'UPDATE'
      AND payload_columns IS NOT NULL
      AND (old_row - payload_columns) = (new_row - payload_columns)
      AND NOT EXISTS (
        SELECT 1 FROM unnest(payload_columns) AS c(name)
        WHERE (new_row -> c.name) IS DISTINCT FROM (old_row -> c.name)
          AND (new_row -> c.name) IS DISTINCT FROM '{"redacted": true}'::jsonb
      )
    THEN
      IF TG_TABLE_NAME = 'audit_entries' THEN
        -- The chain hashes each payload; keep the originals' hashes so
        -- app.verify_audit_chain() still verifies. A second redaction of the
        -- same entry keeps the first, original hashes.
        INSERT INTO public.audit_entry_redactions
          (audit_entry_id, tenant_id, member_erasure_id, before_sha256, after_sha256, metadata_sha256)
        VALUES (
          (old_row ->> 'id')::uuid,
          row_tenant,
          erasure_id,
          app.jsonb_sha256(OLD.before_json),
          app.jsonb_sha256(OLD.after_json),
          app.jsonb_sha256(OLD.metadata_json)
        )
        ON CONFLICT (audit_entry_id) DO NOTHING;
      END IF;
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'append-only table % cannot be updated or deleted', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS tenant_config_version_append_only ON tenant_config_version;
CREATE TRIGGER tenant_config_version_append_only
BEFORE UPDATE OR DELETE ON tenant_config_version
FOR EACH ROW EXECUTE FUNCTION app.reject_update_delete();

DROP TRIGGER IF EXISTS entitlement_grant_history_append_only ON entitlement_grant_history;
CREATE TRIGGER entitlement_grant_history_append_only
BEFORE UPDATE OR DELETE ON entitlement_grant_history
FOR EACH ROW EXECUTE FUNCTION app.reject_update_delete();

DROP TRIGGER IF EXISTS audit_entries_append_only ON audit_entries;
CREATE TRIGGER audit_entries_append_only
BEFORE UPDATE OR DELETE ON audit_entries
FOR EACH ROW EXECUTE FUNCTION app.reject_update_delete();

CREATE OR REPLACE FUNCTION app.set_audit_entry_hash()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  previous_entry_hash text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(coalesce(NEW.tenant_id::text, 'global_audit_stream')));

  SELECT ae.entry_hash
    INTO previous_entry_hash
  FROM audit_entries ae
  WHERE ae.tenant_id IS NOT DISTINCT FROM NEW.tenant_id
  ORDER BY ae.occurred_at DESC, ae.id DESC
  LIMIT 1;

  NEW.previous_hash := previous_entry_hash;

  NEW.entry_hash := app.sha256_hex(
    concat_ws(
      '|',
      coalesce(previous_entry_hash, ''),
      coalesce(NEW.tenant_id::text, ''),
      coalesce(NEW.actor_membership_id::text, ''),
      coalesce(NEW.actor_principal_id::text, ''),
      coalesce(NEW.action, ''),
      coalesce(NEW.target_type, ''),
      coalesce(NEW.target_id, ''),
      coalesce(NEW.request_id, ''),
      coalesce(NEW.ip_hash, ''),
      coalesce(NEW.user_agent_hash, ''),
      coalesce(app.jsonb_sha256(NEW.before_json), ''),
      coalesce(app.jsonb_sha256(NEW.after_json), ''),
      coalesce(app.jsonb_sha256(NEW.metadata_json), ''),
      coalesce(NEW.occurred_at::text, '')
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_entries_hash_chain ON audit_entries;
CREATE TRIGGER audit_entries_hash_chain
BEFORE INSERT ON audit_entries
FOR EACH ROW EXECUTE FUNCTION app.set_audit_entry_hash();