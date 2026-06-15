CREATE OR REPLACE FUNCTION app.reject_update_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
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