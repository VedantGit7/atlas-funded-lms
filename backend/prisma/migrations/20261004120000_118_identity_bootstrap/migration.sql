-- Audit finding H6 — weak identity bootstrap.
--
-- `upsertAuthPrincipal` used to re-point any principal at a new Supabase user
-- whenever the email matched. Whoever registered a deleted user's address
-- inherited every membership, role and platform grant that user held. And
-- `global_status` was read but never enforced, so a disabled principal still
-- authenticated.
--
-- This migration gives the application the states it needs to stop doing that:
--
--   active     a principal bound to a real Supabase user;
--   unclaimed  a placeholder created before its owner signed up (the marketing
--              integration sign-up API). Its Supabase id is a random value that
--              no Supabase user holds. The first sign-in with a confirmed email
--              claims it;
--   disabled   refused at sign-in and on every authenticated request.
--
-- Re-pointing an active principal at a different Supabase user is now a
-- platform decision, recorded in auth_principal_relink_requests. The database
-- enforces this too, not only the application: the tenant roles may not change
-- `supabase_user_id` or `global_status` except to claim an unclaimed principal.

BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.auth_principals
  ADD CONSTRAINT auth_principals_global_status_valid
  CHECK (global_status IN ('active', 'unclaimed', 'disabled')) NOT VALID;
ALTER TABLE public.auth_principals VALIDATE CONSTRAINT auth_principals_global_status_valid;

-- Placeholders created before this migration were stored as 'active'. On a
-- Supabase-hosted database, a principal that never signed in and whose Supabase
-- id matches no auth user is such a placeholder. A principal that ever signed
-- in keeps 'active' even if its Supabase user is gone: that is exactly the
-- account a re-registration must not inherit without review. Plain Postgres
-- (CI, local without Supabase) has no auth schema, and nothing to backfill.
DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    EXECUTE $sql$
      UPDATE public.auth_principals ap
         SET global_status = 'unclaimed', updated_at = now()
       WHERE ap.global_status = 'active'
         AND ap.last_login_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = ap.supabase_user_id)
         AND NOT EXISTS (
           SELECT 1 FROM public.platform_operators po
            WHERE po.auth_principal_id = ap.id AND po.revoked_at IS NULL
         )
    $sql$;
  END IF;
END $$;

CREATE TABLE public.auth_principal_relink_requests (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_principal_id           uuid NOT NULL REFERENCES public.auth_principals(id) ON DELETE CASCADE,
  previous_supabase_user_id   uuid NOT NULL,
  requested_supabase_user_id  uuid NOT NULL,
  email_normalized            text NOT NULL,
  status                      text NOT NULL DEFAULT 'pending',
  attempt_count               integer NOT NULL DEFAULT 1,
  requested_at                timestamptz(6) NOT NULL DEFAULT now(),
  last_seen_at                timestamptz(6) NOT NULL DEFAULT now(),
  decided_at                  timestamptz(6),
  decided_by_principal_id     uuid REFERENCES public.auth_principals(id) ON DELETE SET NULL,
  decision_reason             text,
  revoked_platform_grant_id   uuid REFERENCES public.platform_operators(id),

  CONSTRAINT auth_principal_relink_requests_status_valid
    CHECK (status IN ('pending', 'approved', 'rejected', 'superseded')),
  CONSTRAINT auth_principal_relink_requests_distinct_users
    CHECK (previous_supabase_user_id <> requested_supabase_user_id),
  CONSTRAINT auth_principal_relink_requests_attempts_positive
    CHECK (attempt_count >= 1),
  -- A decision always says when, and an approval or rejection always says who
  -- and why. 'superseded' is written by an approval of a sibling request.
  CONSTRAINT auth_principal_relink_requests_decision_complete
    CHECK (
      (status = 'pending' AND decided_at IS NULL AND decided_by_principal_id IS NULL)
      OR (status = 'superseded' AND decided_at IS NOT NULL)
      OR (status IN ('approved', 'rejected') AND decided_at IS NOT NULL
          AND decision_reason IS NOT NULL AND length(trim(decision_reason)) >= 10)
    )
);

COMMENT ON TABLE public.auth_principal_relink_requests IS
  'H6: a confirmed email signed in under a different Supabase user than its principal. Approval by a platform operator is the only way the principal moves.';

CREATE UNIQUE INDEX auth_principal_relink_requests_pending_uq
  ON public.auth_principal_relink_requests (auth_principal_id, requested_supabase_user_id)
  WHERE status = 'pending';

CREATE INDEX auth_principal_relink_requests_pending_idx
  ON public.auth_principal_relink_requests (last_seen_at DESC)
  WHERE status = 'pending';

-- The tenant plane records that a blocked sign-in happened; it never decides.
REVOKE ALL ON public.auth_principal_relink_requests FROM PUBLIC, atlas_app, atlas_worker;
GRANT SELECT, INSERT ON public.auth_principal_relink_requests TO atlas_app;
GRANT UPDATE (last_seen_at, attempt_count) ON public.auth_principal_relink_requests TO atlas_app;
GRANT SELECT, INSERT, UPDATE ON public.auth_principal_relink_requests TO atlas_platform;
REVOKE DELETE ON public.auth_principal_relink_requests FROM atlas_platform;

-- Identity binding and account status belong to the platform plane. The
-- tenant roles keep the narrow transitions the sign-in path needs: refreshing
-- email and MFA state, and claiming an unclaimed placeholder exactly once.
CREATE OR REPLACE FUNCTION app.guard_auth_principal_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT (pg_has_role(current_user, 'atlas_app', 'MEMBER')
          OR pg_has_role(current_user, 'atlas_worker', 'MEMBER'))
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

  IF NEW.supabase_user_id IS DISTINCT FROM OLD.supabase_user_id
     AND OLD.global_status <> 'unclaimed' THEN
    RAISE EXCEPTION 'auth principal % is bound to its Supabase user; relinking requires platform review', OLD.id
      USING ERRCODE = 'insufficient_privilege';
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

DROP TRIGGER IF EXISTS auth_principals_identity_guard ON public.auth_principals;
CREATE TRIGGER auth_principals_identity_guard
BEFORE INSERT OR UPDATE ON public.auth_principals
FOR EACH ROW EXECUTE FUNCTION app.guard_auth_principal_identity();

COMMIT;
