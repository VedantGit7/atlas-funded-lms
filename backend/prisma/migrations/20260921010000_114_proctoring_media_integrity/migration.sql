-- F21 stage 1: protect new writes without deleting or rewriting historical evidence.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE UNIQUE INDEX proctoring_sessions_tenant_id_id_key
  ON public.proctoring_sessions (tenant_id, id);
CREATE UNIQUE INDEX proctoring_events_tenant_session_id_key
  ON public.proctoring_events (tenant_id, proctoring_session_id, id);
CREATE INDEX proctoring_media_artifacts_tenant_session_event_idx
  ON public.proctoring_media_artifacts (tenant_id, proctoring_session_id, proctoring_event_id);

ALTER TABLE public.proctoring_media_artifacts
  ADD CONSTRAINT proctoring_media_artifacts_tenant_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID,
  ADD CONSTRAINT proctoring_media_artifacts_session_fkey
    FOREIGN KEY (tenant_id, proctoring_session_id)
    REFERENCES public.proctoring_sessions(tenant_id, id)
    ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID,
  ADD CONSTRAINT proctoring_media_artifacts_event_fkey
    FOREIGN KEY (tenant_id, proctoring_session_id, proctoring_event_id)
    REFERENCES public.proctoring_events(tenant_id, proctoring_session_id, id)
    MATCH SIMPLE ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

COMMENT ON CONSTRAINT proctoring_media_artifacts_event_fkey ON public.proctoring_media_artifacts IS
  'Optional event must belong to the same tenant and session. Retained media blocks parent deletion; remove the object before its artifact row.';
COMMIT;
