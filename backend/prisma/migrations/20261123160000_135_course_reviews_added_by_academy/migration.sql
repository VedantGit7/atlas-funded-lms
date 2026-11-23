-- Reviews added by the academy (QA review 1 M18, owner decision D8: keep,
-- labelled).
--
-- Admins could "Add review" in Manage › Ratings & Reviews, and the review
-- showed to learners like any learner's. The form even let the admin pick a
-- learner, and saved the review as that learner's, replacing a real one.
-- From now on an admin-added review belongs to the academy: it is written
-- under the admin's own membership, marked here, shown with an "Added by the
-- academy" label, and left out of the course's star average and count.
--
-- Earlier admin-added reviews can't all be told apart: the ones written under
-- an owner's or admin's own membership are marked; any written under a
-- learner's membership can only be found by hand.

BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.course_reviews
  ADD COLUMN added_by_academy boolean NOT NULL DEFAULT false;

UPDATE public.course_reviews cr
SET added_by_academy = true
WHERE EXISTS (
  SELECT 1
  FROM public.user_roles ur
  JOIN public.roles r
    ON r.id = ur.role_id
   AND r.tenant_id = ur.tenant_id
   AND r.deleted_at IS NULL
  WHERE ur.tenant_id = cr.tenant_id
    AND ur.membership_id = cr.membership_id
    AND r.key IN ('owner', 'admin')
);

COMMIT;
