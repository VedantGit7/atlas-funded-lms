-- Better Auth claims an unclaimed principal at its owner's first sign-in with a
-- proven address, unless the principal carries a platform grant (audit H6;
-- launch plan task 3.2). It checks that as atlas_auth, so the role may read
-- grants. Reading only: granting platform authority stays with atlas_platform.

BEGIN;
SET LOCAL lock_timeout = '5s';

GRANT SELECT ON public.platform_operators TO atlas_auth;

COMMIT;
