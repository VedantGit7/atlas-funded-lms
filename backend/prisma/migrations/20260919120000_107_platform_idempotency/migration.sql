-- F03: atomic platform replay claims, separate from tenant-owned records.
CREATE TABLE platform_idempotency_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE CHECK (octet_length(idempotency_key) BETWEEN 1 AND 256),
  actor_principal_id uuid NOT NULL REFERENCES auth_principals(id),
  scope text NOT NULL,
  request_id text NOT NULL,
  request_fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED')),
  response_json jsonb,
  response_omitted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  CONSTRAINT platform_idempotency_completion_consistent CHECK (
    status <> 'COMPLETED' OR
    (completed_at IS NOT NULL AND (response_json IS NOT NULL OR response_omitted))
  )
);
CREATE INDEX platform_idempotency_expires_idx ON platform_idempotency_records (expires_at);
ALTER TABLE platform_idempotency_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_idempotency_records FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_idempotency_scope ON platform_idempotency_records
  FOR ALL TO atlas_platform
  USING (current_setting('app.platform_scope', true) = 'true')
  WITH CHECK (current_setting('app.platform_scope', true) = 'true');
REVOKE ALL ON platform_idempotency_records FROM PUBLIC, atlas_app, atlas_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON platform_idempotency_records TO atlas_platform;
