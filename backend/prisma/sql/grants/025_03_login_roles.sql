-- Login roles that CANNOT bypass row-level security.
--
-- Audited state (C5): the application connected as `atlas`, which is
-- rolsuper = true and rolbypassrls = true. A direct probe confirmed that any
-- query reaching the database without `SET LOCAL ROLE atlas_app` returned rows
-- for every tenant. RLS was therefore inert as a backstop, and tenant isolation
-- rested entirely on application discipline — contrary to Master PRD §0.4 #1,
-- which promises enforcement at three layers.
--
-- Design notes:
--
--   * atlas_app_login is a member of atlas_app ONLY. It is deliberately NOT a
--     member of atlas_platform: the platform policy is `USING (true)`, and RLS
--     policy applicability follows role membership, so granting atlas_platform
--     here would re-open cross-tenant reads even without superuser.
--
--   * INHERIT is required. Policy applicability and table grants both depend on
--     the login role actually holding atlas_app's privileges.
--
--   * With this role, a query that forgets `SET LOCAL ROLE` fails CLOSED rather
--     than open: the tenant_isolation policy still applies, app.current_tenant_id()
--     is NULL, and `tenant_id = NULL` matches no rows.
--
--   * Platform work uses a separate connection (PLATFORM_DATABASE_URL) and
--     `SET LOCAL ROLE atlas_platform`, so it gets its own login role.
--
-- Passwords are intentionally NOT set here. Set them out of band:
--   ALTER ROLE atlas_app_login WITH PASSWORD '...';
-- For local development, `pnpm db:setup-login-roles` does this from env vars.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas_app_login') THEN
    CREATE ROLE atlas_app_login LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas_platform_login') THEN
    CREATE ROLE atlas_platform_login LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

-- Re-assert the safety attributes even if the roles already existed, so an
-- accidentally-elevated role is corrected on the next provision.
ALTER ROLE atlas_app_login NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE INHERIT;
ALTER ROLE atlas_platform_login NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE INHERIT;

GRANT atlas_app TO atlas_app_login;
GRANT atlas_platform TO atlas_platform_login;

-- Explicitly ensure the app login does not hold platform membership, in case an
-- earlier setup granted it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_auth_members m
    JOIN pg_roles member ON member.oid = m.member
    JOIN pg_roles grp ON grp.oid = m.roleid
    WHERE member.rolname = 'atlas_app_login'
      AND grp.rolname = 'atlas_platform'
  ) THEN
    REVOKE atlas_platform FROM atlas_app_login;
  END IF;
END $$;
