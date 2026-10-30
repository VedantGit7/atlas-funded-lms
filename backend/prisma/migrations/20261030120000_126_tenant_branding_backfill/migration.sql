-- Every tenant has a branding row (launch plan task 2.6).
--
-- Provisioning never wrote one, so a provisioned tenant's branding reads failed
-- with BRANDING_NOT_FOUND: its security emails were dead-lettered, and the
-- admin Branding and About pages could not load (staging, 30 October 2026).
-- Provisioning now writes it; this adds it for tenants made before, as the
-- same draft named after the tenant. A tenant that has a row keeps it.
--
-- tenant_branding forces row-level security and the owner has no policy, so on
-- a deployed database the insert runs in the platform scope, as the seed job
-- does. On a fresh database the grants come after the migrations
-- (provision-database.mjs) and there are no tenants yet, so it runs as the
-- migration user and inserts nothing.

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas_platform')
    AND has_table_privilege('atlas_platform', 'public.tenants', 'SELECT')
    AND has_table_privilege('atlas_platform', 'public.tenant_branding', 'INSERT')
  THEN
    SET LOCAL ROLE atlas_platform;
    PERFORM set_config('app.platform_scope', 'true', true);
  END IF;

  INSERT INTO public.tenant_branding (
    id,
    tenant_id,
    display_name,
    public_name,
    status,
    version,
    created_at,
    updated_at
  )
  SELECT gen_random_uuid(), t.id, t.display_name, t.display_name, 'DRAFT', 0, now(), now()
  FROM public.tenants t
  WHERE NOT EXISTS (SELECT 1 FROM public.tenant_branding b WHERE b.tenant_id = t.id)
  ON CONFLICT (tenant_id) DO NOTHING;
END
$$;

RESET ROLE;
COMMIT;
