-- Named delivery destinations for scheduled / one-shot export delivery.
CREATE TABLE IF NOT EXISTS report_delivery_destinations (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  created_by_membership_id uuid NOT NULL,
  name text NOT NULL,
  kind text NOT NULL,
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  secrets_json jsonb,
  is_active boolean NOT NULL DEFAULT true,
  last_delivery_at timestamptz,
  last_delivery_status text,
  last_error text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  health_30d_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT report_delivery_destinations_kind_check
    CHECK (kind IN ('email', 'webhook', 'storage')),
  CONSTRAINT report_delivery_destinations_status_check
    CHECK (
      last_delivery_status IS NULL
      OR last_delivery_status IN ('succeeded', 'failed', 'pending')
    ),
  CONSTRAINT report_delivery_destinations_failures_nonneg
    CHECK (consecutive_failures >= 0)
);

CREATE INDEX IF NOT EXISTS report_delivery_destinations_tenant_kind_active_idx
  ON report_delivery_destinations (tenant_id, kind, is_active);

CREATE INDEX IF NOT EXISTS report_delivery_destinations_tenant_updated_idx
  ON report_delivery_destinations (tenant_id, updated_at DESC);

ALTER TABLE report_delivery_destinations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS report_delivery_destinations_tenant_isolation ON report_delivery_destinations;
CREATE POLICY report_delivery_destinations_tenant_isolation
  ON report_delivery_destinations
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
