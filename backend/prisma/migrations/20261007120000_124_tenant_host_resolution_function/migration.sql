-- Host resolution answers one exact hostname, never a listing.
--
-- Every request resolves its tenant from the Host header before a tenant
-- context exists. That lookup ran as `atlas_app` against `tenant_domains`, and
-- the policy that made it possible, `tenant_domains_host_resolution`, granted
-- SELECT on *every* undeleted row whenever `app.tenant_id` was unset:
-- `select * from tenant_domains` from any pre-context code path returned every
-- tenant's hostnames, including unverified custom-domain claims and their DNS
-- verification values. RLS cannot see a query's WHERE clause, so a policy can
-- only allow the table or refuse it; it cannot allow "one row, by hostname".
--
-- A function can. `app.resolve_tenant_host(host)` returns at most one row: the
-- verified (ACTIVE), undeleted domain whose hostname equals the argument, of a
-- tenant that is not deleted, with only the columns resolution needs. It runs
-- as `atlas_host_resolver`, a NOLOGIN role that owns nothing else, can read
-- only those columns, and whose policy admits only verified, undeleted domains. The application roles keep
-- EXECUTE on the function and lose the table-wide pre-context policy, so with
-- no tenant context set `tenant_domains` now reads as empty to them.
--
-- `backend/prisma/sql/rls/025_tenant_rls_policies.sql` drops the old policy
-- too, so a freshly provisioned database ends in the same state.
-- The policy and its reasoning: docs/runbooks/tenant-host-resolution.md.

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas_host_resolver') THEN
    CREATE ROLE atlas_host_resolver NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

-- The migration role must be able to hand the function to this owner.
DO $$
BEGIN
  EXECUTE format('GRANT atlas_host_resolver TO %I', current_user);
END $$;

GRANT USAGE ON SCHEMA public, app TO atlas_host_resolver;
REVOKE ALL ON public.tenant_domains, public.tenants FROM atlas_host_resolver;
GRANT SELECT (id, tenant_id, hostname, status, deleted_at) ON public.tenant_domains TO atlas_host_resolver;
GRANT SELECT (id, slug, state, deleted_at) ON public.tenants TO atlas_host_resolver;

DROP POLICY IF EXISTS tenant_domains_host_resolver ON public.tenant_domains;
CREATE POLICY tenant_domains_host_resolver
  ON public.tenant_domains
  FOR SELECT
  TO atlas_host_resolver
  USING (deleted_at IS NULL AND status = 'ACTIVE'::"DomainStatus");

CREATE OR REPLACE FUNCTION app.resolve_tenant_host(p_host text)
RETURNS TABLE (
  tenant_id uuid,
  tenant_slug text,
  tenant_state text,
  domain_id uuid,
  domain_status text,
  hostname text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT t.id, t.slug, t.state::text, td.id, td.status::text, td.hostname
  FROM public.tenant_domains td
  JOIN public.tenants t ON t.id = td.tenant_id
  WHERE lower(td.hostname) = lower(p_host)
    AND td.status = 'ACTIVE'::public."DomainStatus"
    AND td.deleted_at IS NULL
    AND t.deleted_at IS NULL
    AND t.state <> 'DELETED'::public."TenantState"
  LIMIT 1
$$;

ALTER FUNCTION app.resolve_tenant_host(text) OWNER TO atlas_host_resolver;
REVOKE ALL ON FUNCTION app.resolve_tenant_host(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.resolve_tenant_host(text) TO atlas_app, atlas_worker;

DROP POLICY IF EXISTS tenant_domains_host_resolution ON public.tenant_domains;

COMMIT;
