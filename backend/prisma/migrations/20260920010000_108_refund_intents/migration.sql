-- F07: durable reservations and independently leased refund processing.
CREATE UNIQUE INDEX payment_orders_tenant_id_id_key ON payment_orders(tenant_id, id);
CREATE TABLE payment_refund_intents (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  order_id uuid NOT NULL,
  request_key uuid NOT NULL,
  request_fingerprint text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL,
  gateway_key text,
  gateway_id uuid,
  external_id text,
  status text NOT NULL CHECK(status IN ('requested','processing','pending','succeeded','failed','reconciliation_required','manual_adjustment')),
  provider_refund_id text,
  payload_json jsonb NOT NULL,
  lease_token uuid,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_refund_order_tenant_fk FOREIGN KEY(tenant_id,order_id) REFERENCES payment_orders(tenant_id,id),
  CONSTRAINT payment_refund_request_key UNIQUE(tenant_id,request_key)
);
CREATE UNIQUE INDEX payment_refund_provider_identity ON payment_refund_intents(tenant_id,gateway_id,provider_refund_id) WHERE provider_refund_id IS NOT NULL;
CREATE INDEX payment_refund_order_idx ON payment_refund_intents(tenant_id,order_id,created_at);
CREATE INDEX payment_refund_work_idx ON payment_refund_intents(tenant_id,next_attempt_at) WHERE status IN ('requested','processing','pending','reconciliation_required');
ALTER TABLE payment_refund_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_refund_intents FORCE ROW LEVEL SECURITY;
CREATE POLICY payment_refund_tenant_scope ON payment_refund_intents
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);
REVOKE ALL ON payment_refund_intents FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON payment_refund_intents FROM anon; END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON payment_refund_intents FROM authenticated; END IF;
END $$;
GRANT SELECT, INSERT, UPDATE ON payment_refund_intents TO atlas_app, atlas_worker;
REVOKE DELETE ON payment_refund_intents FROM atlas_app, atlas_worker;
