-- Host resolution can use the hostname index (audit §3.1).
--
-- Every request resolves its tenant through app.resolve_tenant_host(host),
-- which matched `lower(td.hostname) = lower(p_host)`. Under row-level security
-- Postgres applies a condition only after the policy unless every function in
-- it is leakproof, and lower() is not, so no index on hostname or
-- lower(hostname) could serve it: each request scanned the table.
--
-- Plain text equality is leakproof. Hostnames are case-insensitive and both
-- write paths already store them lowercased (the custom-domain request schema
-- lowercases; fallback domains are built from lowercase-only slugs). This
-- makes that an invariant of the table and compares the stored value
-- directly, so the existing tenant_domains_hostname_active_uq index answers it.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- Rows written before the invariant. Fails on a case-only duplicate, which
-- would already be ambiguous to resolve.
UPDATE public.tenant_domains
SET hostname = lower(hostname)
WHERE hostname <> lower(hostname);

ALTER TABLE public.tenant_domains
  DROP CONSTRAINT IF EXISTS tenant_domains_hostname_lowercase;
ALTER TABLE public.tenant_domains
  ADD CONSTRAINT tenant_domains_hostname_lowercase CHECK (hostname = lower(hostname));

-- Same signature, owner, grants and result as migration 124; only the
-- hostname comparison changes.
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
  WHERE td.hostname = lower(p_host)
    AND td.status = 'ACTIVE'::public."DomainStatus"
    AND td.deleted_at IS NULL
    AND t.deleted_at IS NULL
    AND t.state <> 'DELETED'::public."TenantState"
  LIMIT 1
$$;

COMMIT;
