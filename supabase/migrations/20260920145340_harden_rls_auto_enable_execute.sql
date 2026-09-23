-- F19: this helper is an event trigger, not an ordinary public RPC.
-- Preserve its definition, owner, pinned search_path and event-trigger binding.
-- PUBLIC must be revoked too: removing only direct client grants is insufficient.
DO $f19$
DECLARE
  target oid := pg_catalog.to_regprocedure('public.rls_auto_enable()');
BEGIN
  -- Optional platform helper: fresh local auth stacks may not install it.
  IF target IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc
    WHERE oid = target AND prorettype = 'pg_catalog.event_trigger'::pg_catalog.regtype
  ) THEN
    RAISE EXCEPTION 'Expected public.rls_auto_enable() to return event_trigger; refusing to change an unrelated function';
  END IF;

  REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

  IF pg_catalog.has_function_privilege('anon', target, 'EXECUTE')
    OR pg_catalog.has_function_privilege('authenticated', target, 'EXECUTE') THEN
    RAISE EXCEPTION 'Client roles still inherit EXECUTE on public.rls_auto_enable(); investigate role membership';
  END IF;
END;
$f19$;
