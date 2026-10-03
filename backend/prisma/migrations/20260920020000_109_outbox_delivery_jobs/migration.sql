-- Durable mutable scheduling is separate from append-only event/attempt evidence.
DROP INDEX event_deliveries_outbox_event_id_destination_key_key;
CREATE UNIQUE INDEX event_deliveries_event_destination_attempt_key
  ON event_deliveries(outbox_event_id,destination_key,attempt_count);

CREATE TABLE outbox_delivery_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  outbox_event_id uuid NOT NULL REFERENCES outbox_events(id),
  destination_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','retry','succeeded','dead','reconciliation_required','cancelled')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count >= 0),
  cycle_attempt_count integer NOT NULL DEFAULT 0 CHECK(cycle_attempt_count >= 0),
  max_attempts integer NOT NULL CHECK(max_attempts BETWEEN 1 AND 101),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_until timestamptz,
  last_error_code text,
  last_dead_letter_id uuid REFERENCES dead_letter_events(id),
  replayed_dead_letter_id uuid REFERENCES dead_letter_events(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outbox_delivery_jobs_event_destination_key UNIQUE(outbox_event_id,destination_key)
);
CREATE INDEX outbox_delivery_jobs_tenant_due_idx ON outbox_delivery_jobs(tenant_id,next_attempt_at)
  WHERE status IN ('pending','processing','retry');
CREATE INDEX outbox_delivery_jobs_tenant_state_idx ON outbox_delivery_jobs(tenant_id,status,updated_at);

-- Do not mass-retry historical sends/failures when installing the worker.
INSERT INTO outbox_delivery_jobs(tenant_id,outbox_event_id,destination_key,status,attempt_count,cycle_attempt_count,max_attempts,last_dead_letter_id)
SELECT d.tenant_id,d.outbox_event_id,d.destination_key,
  CASE WHEN d.status::text='SENT' THEN 'succeeded' WHEN d.status::text='CANCELLED' THEN 'cancelled' ELSE 'reconciliation_required' END,
  greatest(d.attempt_count,1),greatest(d.attempt_count,1),greatest(least(d.attempt_count,101),1),
  (SELECT dl.id FROM dead_letter_events dl WHERE dl.outbox_event_id=d.outbox_event_id AND dl.destination_key=d.destination_key ORDER BY dl.failed_at DESC,dl.id DESC LIMIT 1)
FROM event_deliveries d;

ALTER TABLE outbox_delivery_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_delivery_jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY outbox_delivery_jobs_tenant ON outbox_delivery_jobs FOR ALL TO atlas_app,atlas_worker
USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND EXISTS(SELECT 1 FROM outbox_events o WHERE o.id=outbox_event_id AND o.tenant_id=outbox_delivery_jobs.tenant_id));
CREATE POLICY outbox_delivery_jobs_platform ON outbox_delivery_jobs FOR ALL TO atlas_platform
USING (true) WITH CHECK (EXISTS(SELECT 1 FROM outbox_events o WHERE o.id=outbox_event_id AND o.tenant_id IS NOT DISTINCT FROM outbox_delivery_jobs.tenant_id));
REVOKE ALL ON outbox_delivery_jobs FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON outbox_delivery_jobs FROM anon; END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON outbox_delivery_jobs FROM authenticated; END IF;
END $$;
GRANT SELECT,INSERT,UPDATE ON outbox_delivery_jobs TO atlas_app,atlas_worker,atlas_platform;
REVOKE DELETE ON outbox_delivery_jobs FROM atlas_app,atlas_worker,atlas_platform;
REVOKE UPDATE,DELETE ON event_deliveries FROM atlas_app,atlas_worker,atlas_platform;
