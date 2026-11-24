-- Event reminders, and passwords collected by sign-up forms (QA review 2 H29
-- and H30, remediation step S1.14).
--
-- 1. Events let the admin choose "Reminder: 1 hour before", but nothing ever
--    sent one. The worker now queues each registration's reminder once, and
--    marks it here so a restart or a second sweep doesn't send it again.
--
-- 2. Sign-up forms asked visitors for a password and kept its hash on the
--    marketing contact. Nothing ever read it: no account was made, so the
--    visitor couldn't sign in with it. Sign-up forms now start the academy's
--    real sign-up (an emailed link where the password is chosen), and the
--    stored hashes are removed.

BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.marketing_event_registrations
  ADD COLUMN reminder_queued_at timestamptz(6);

UPDATE public.marketing_contacts
SET password_hash = NULL
WHERE password_hash IS NOT NULL;

COMMIT;
