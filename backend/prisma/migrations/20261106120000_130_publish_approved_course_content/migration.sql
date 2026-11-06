-- Approved courses show their modules and lessons (launch plan task 5.1).
--
-- Learners only see modules and lessons marked PUBLISHED, but nothing ever
-- published them: the studio has no per-item control and approving a course
-- changed only the course. So a course built in the studio and approved showed
-- its learners "no published module outline" (staging, 6 November 2026).
-- Approval now publishes the course's draft modules and lessons; this does the
-- same for courses approved before. Nothing could keep a draft inside a
-- published course on purpose, so every one is the bug's. Deleted and ARCHIVED
-- items stay as they are.
--
-- course_modules and lessons force row-level security and the owner has no
-- policy, so on a deployed database the update runs in the platform scope, as
-- migration 126 does. On a fresh database the grants come after the migrations
-- (provision-database.mjs) and there are no courses yet, so it runs as the
-- migration user and updates nothing.

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas_platform')
    AND has_table_privilege('atlas_platform', 'public.courses', 'SELECT')
    AND has_table_privilege('atlas_platform', 'public.course_modules', 'UPDATE')
    AND has_table_privilege('atlas_platform', 'public.lessons', 'UPDATE')
  THEN
    SET LOCAL ROLE atlas_platform;
    PERFORM set_config('app.platform_scope', 'true', true);
  END IF;

  UPDATE public.course_modules m
     SET status = 'PUBLISHED'::"PublishStatus", updated_at = now()
    FROM public.courses c
   WHERE m.course_id = c.id
     AND c.status = 'PUBLISHED'::"PublishStatus"
     AND c.deleted_at IS NULL
     AND m.deleted_at IS NULL
     AND m.status IN ('DRAFT'::"PublishStatus", 'REVIEW'::"PublishStatus");

  UPDATE public.lessons l
     SET status = 'PUBLISHED'::"PublishStatus", updated_at = now()
    FROM public.course_modules m
    JOIN public.courses c ON c.id = m.course_id
   WHERE l.module_id = m.id
     AND c.status = 'PUBLISHED'::"PublishStatus"
     AND c.deleted_at IS NULL
     AND m.deleted_at IS NULL
     AND l.deleted_at IS NULL
     AND l.status IN ('DRAFT'::"PublishStatus", 'REVIEW'::"PublishStatus");
END
$$;

RESET ROLE;
COMMIT;
