-- F08: frozen per-recipient receipts survive partial fan-out and outbox replay.
CREATE TABLE report_delivery_effects (
  effect_key text PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  report_run_id uuid NOT NULL REFERENCES report_runs(id),
  ordinal integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('email','webhook','storage')),
  destination_id uuid,
  request_json jsonb NOT NULL,
  retry_on_crash boolean NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','processing','succeeded','failed','reconciliation_required')),
  lease_token uuid,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  error_kind text CHECK (error_kind IN ('retryable','permanent','reconciliation_required')),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, report_run_id, ordinal)
);
CREATE INDEX report_delivery_effects_run_idx ON report_delivery_effects(tenant_id,report_run_id);
ALTER TABLE report_delivery_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_delivery_effects FORCE ROW LEVEL SECURITY;
CREATE POLICY report_delivery_effects_tenant_scope ON report_delivery_effects
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND EXISTS (SELECT 1 FROM report_runs r WHERE r.id = report_run_id AND r.tenant_id = report_delivery_effects.tenant_id)
  );
REVOKE ALL ON report_delivery_effects FROM PUBLIC, atlas_platform, atlas_app, atlas_worker;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON report_delivery_effects FROM anon; END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON report_delivery_effects FROM authenticated; END IF;
END $$;
GRANT SELECT, INSERT, UPDATE ON report_delivery_effects TO atlas_app, atlas_worker;
REVOKE DELETE ON report_delivery_effects FROM atlas_app, atlas_worker;
