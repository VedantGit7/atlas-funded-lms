-- Device security alerts for Active Devices triage queue.
CREATE TABLE IF NOT EXISTS "device_security_alerts" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "membership_id" UUID NOT NULL,
  "alert_key" TEXT NOT NULL,
  "alert_type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "title" TEXT NOT NULL,
  "evidence_json" JSONB,
  "session_ids" JSONB NOT NULL,
  "detected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMPTZ(6),
  "resolved_by" UUID,
  "notes_json" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "device_security_alerts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "device_security_alerts_tenant_id_alert_key_key"
  ON "device_security_alerts" ("tenant_id", "alert_key");

CREATE INDEX IF NOT EXISTS "device_security_alerts_tenant_status_detected_idx"
  ON "device_security_alerts" ("tenant_id", "status", "detected_at" DESC);

CREATE INDEX IF NOT EXISTS "device_security_alerts_tenant_type_status_idx"
  ON "device_security_alerts" ("tenant_id", "alert_type", "status");

CREATE INDEX IF NOT EXISTS "device_security_alerts_tenant_membership_idx"
  ON "device_security_alerts" ("tenant_id", "membership_id");

GRANT SELECT, INSERT, UPDATE, DELETE ON device_security_alerts TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE device_security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_security_alerts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS device_security_alerts_tenant_isolation ON device_security_alerts;
CREATE POLICY device_security_alerts_tenant_isolation ON device_security_alerts
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS device_security_alerts_platform_scope ON device_security_alerts;
CREATE POLICY device_security_alerts_platform_scope ON device_security_alerts
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
