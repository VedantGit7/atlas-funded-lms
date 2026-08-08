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