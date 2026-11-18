-- Atlas LMS Migration 001
-- PostgreSQL extensions and base helper functions.
--
-- Scope:
-- - No product tables.
-- - No tenant tables.
-- - No RLS policies.
-- - No Prisma models.
-- - Base database utilities only.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION app.current_actor_membership_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.actor_membership_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION app.current_request_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.request_id', true), '');
$$;

CREATE OR REPLACE FUNCTION app.current_platform_principal_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.platform_principal_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION app.sha256_hex(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT encode(digest(input, 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION app.jsonb_sha256(input jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT encode(digest(input::text, 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION app.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Append-only guard used by trigger definitions in prisma/sql/triggers and, since
-- migration 098, directly by Prisma migrations. It must therefore be defined during
-- setup (before `prisma migrate deploy`) rather than only in sql/triggers, which
-- cannot run until the tables it attaches to already exist. Definition is identical
-- to the one in sql/triggers/006 and is CREATE OR REPLACE, so re-applying is a no-op.
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