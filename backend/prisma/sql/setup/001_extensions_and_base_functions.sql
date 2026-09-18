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
BEGIN
  RAISE EXCEPTION 'append-only table % cannot be updated or deleted', TG_TABLE_NAME;
END;
$$;