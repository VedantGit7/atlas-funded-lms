-- F21 stage 2: validate historical rows. Failure preserves evidence and the
-- stage-1 write protection; investigate with db:proctoring-integrity:check.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE public.proctoring_media_artifacts
  VALIDATE CONSTRAINT proctoring_media_artifacts_tenant_fkey;
ALTER TABLE public.proctoring_media_artifacts
  VALIDATE CONSTRAINT proctoring_media_artifacts_session_fkey;
ALTER TABLE public.proctoring_media_artifacts
  VALIDATE CONSTRAINT proctoring_media_artifacts_event_fkey;
COMMIT;
