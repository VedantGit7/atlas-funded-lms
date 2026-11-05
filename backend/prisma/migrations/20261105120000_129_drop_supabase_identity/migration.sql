-- Supabase Auth is gone (launch plan task 3.8; docs/engineering/better-auth-design.md).
--
-- A principal was bound to one Supabase user, and a confirmed email that signed
-- in under a different one was held for a platform decision (audit H6). Better
-- Auth's user is the principal itself, so there is no second id to bind, and
-- nothing to relink: the column, the relink requests and the guard's rule for
-- them go. The guard keeps the rest of H6: the tenant, worker and auth roles may
-- create active or unclaimed principals and claim a placeholder, but disabling
-- and enabling stay with the platform.
--
-- A principal marked as having MFA with no Better Auth authenticator behind it
-- (one that enrolled with Supabase, whose secrets can't be exported) would be
-- asked for a code from a factor that no longer exists; it sets one up again
-- at its next sign-in instead.

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION app.guard_auth_principal_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT (pg_has_role(current_user, 'atlas_app', 'MEMBER')
          OR pg_has_role(current_user, 'atlas_worker', 'MEMBER')
          OR pg_has_role(current_user, 'atlas_auth', 'MEMBER'))
     OR (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.global_status NOT IN ('active', 'unclaimed') THEN
      RAISE EXCEPTION 'auth principal status % is set by the platform plane', NEW.global_status
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.global_status IS DISTINCT FROM OLD.global_status
     AND NOT (OLD.global_status = 'unclaimed' AND NEW.global_status = 'active') THEN
    RAISE EXCEPTION 'auth principal status % -> % is set by the platform plane',
      OLD.global_status, NEW.global_status
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TABLE public.auth_principal_relink_requests;

ALTER TABLE public.auth_principals DROP COLUMN supabase_user_id;

UPDATE public.auth_principals ap
   SET mfa_enabled = false, updated_at = now()
 WHERE ap.mfa_enabled
   AND NOT EXISTS (SELECT 1 FROM public.auth_two_factors tf WHERE tf.user_id = ap.id);

COMMIT;
