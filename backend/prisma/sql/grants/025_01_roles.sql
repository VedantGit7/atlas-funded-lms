DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas_app') THEN
    CREATE ROLE atlas_app NOINHERIT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas_worker') THEN
    CREATE ROLE atlas_worker NOINHERIT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas_platform') THEN
    CREATE ROLE atlas_platform NOINHERIT;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO atlas_app, atlas_worker, atlas_platform;
GRANT USAGE ON SCHEMA app TO atlas_app, atlas_worker, atlas_platform;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas') THEN
    GRANT atlas_app TO atlas;
    GRANT atlas_worker TO atlas;
    GRANT atlas_platform TO atlas;
  END IF;
END $$;

-- Migration 124 hands app.resolve_tenant_host to atlas_host_resolver. Unless
-- the migration login is a superuser, Postgres allows that only when the new
-- owner has CREATE on the function's schema, so the role is created here,
-- before migrations, and given it; 124_host_resolver_schema.sql takes it back
-- after them. Deployed databases migrate as a non-superuser owner
-- (scripts/db/migration-job.mjs).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas_host_resolver') THEN
    CREATE ROLE atlas_host_resolver NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

GRANT CREATE ON SCHEMA app TO atlas_host_resolver;
