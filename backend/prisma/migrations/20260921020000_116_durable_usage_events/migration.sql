BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.tenant_usage_events (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_start date NOT NULL CHECK (extract(day FROM period_start)=1),
  requests bigint NOT NULL DEFAULT 0 CHECK(requests>=0),
  duration_ms double precision NOT NULL DEFAULT 0 CHECK(duration_ms>=0 AND duration_ms<'Infinity'::float8),
  emails bigint NOT NULL DEFAULT 0 CHECK(emails>=0),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX tenant_usage_events_pending_idx ON public.tenant_usage_events(tenant_id,created_at,id) WHERE processed_at IS NULL;
CREATE INDEX tenant_usage_events_tenant_created_idx ON public.tenant_usage_events(tenant_id,created_at);
CREATE INDEX tenant_usage_events_processed_idx ON public.tenant_usage_events(tenant_id,processed_at,id) WHERE processed_at IS NOT NULL;
ALTER TABLE public.tenant_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_usage_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_usage_events_tenant_isolation ON public.tenant_usage_events FOR ALL TO atlas_app,atlas_worker
  USING(tenant_id=app.current_tenant_id()) WITH CHECK(tenant_id=app.current_tenant_id());
CREATE POLICY tenant_usage_events_platform_scope ON public.tenant_usage_events FOR ALL TO atlas_platform USING(true) WITH CHECK(true);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.tenant_usage_events TO atlas_app,atlas_worker,atlas_platform;
COMMENT ON TABLE public.tenant_usage_events IS 'F22 durable operational cost metering; not a customer billing ledger. Rollup and processed acknowledgement share a transaction; processed IDs retained 30 days.';
COMMIT;
