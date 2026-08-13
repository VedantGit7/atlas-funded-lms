-- L1 proctoring foundation: security policies, sessions, append-only events, reports.

CREATE TYPE "Severity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TABLE IF NOT EXISTS "exam_security_policies" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "config_json" JSONB NOT NULL,
  "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "exam_security_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "exam_security_policies_tenant_id_key_key"
  ON "exam_security_policies" ("tenant_id", "key");

GRANT SELECT, INSERT, UPDATE, DELETE ON exam_security_policies TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE exam_security_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_security_policies FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exam_security_policies_tenant_isolation ON exam_security_policies;
CREATE POLICY exam_security_policies_tenant_isolation
  ON exam_security_policies
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS exam_security_policies_platform_scope ON exam_security_policies;
CREATE POLICY exam_security_policies_platform_scope
  ON exam_security_policies
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS "proctoring_sessions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "attempt_id" UUID NOT NULL,
  "membership_id" UUID NOT NULL,
  "policy_id" UUID,
  "status" TEXT NOT NULL DEFAULT 'active',
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMPTZ(6),
  "summary_json" JSONB,
  CONSTRAINT "proctoring_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "proctoring_sessions_tenant_id_attempt_id_key"
  ON "proctoring_sessions" ("tenant_id", "attempt_id");

CREATE INDEX IF NOT EXISTS "proctoring_sessions_tenant_id_membership_id_started_at_idx"
  ON "proctoring_sessions" ("tenant_id", "membership_id", "started_at");

GRANT SELECT, INSERT, UPDATE, DELETE ON proctoring_sessions TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE proctoring_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE proctoring_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS proctoring_sessions_tenant_isolation ON proctoring_sessions;
CREATE POLICY proctoring_sessions_tenant_isolation
  ON proctoring_sessions
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS proctoring_sessions_platform_scope ON proctoring_sessions;
CREATE POLICY proctoring_sessions_platform_scope
  ON proctoring_sessions
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS "proctoring_events" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "proctoring_session_id" UUID NOT NULL,
  "event_type" TEXT NOT NULL,
  "severity" "Severity" NOT NULL DEFAULT 'INFO',
  "metadata_json" JSONB,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "idempotency_key" TEXT,
  CONSTRAINT "proctoring_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "proctoring_events_tenant_id_idempotency_key_key"
  ON "proctoring_events" ("tenant_id", "idempotency_key");

CREATE INDEX IF NOT EXISTS "proctoring_events_tenant_id_proctoring_session_id_occurred_at_idx"
  ON "proctoring_events" ("tenant_id", "proctoring_session_id", "occurred_at");

GRANT SELECT, INSERT ON proctoring_events TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE proctoring_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE proctoring_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS proctoring_events_tenant_isolation ON proctoring_events;
CREATE POLICY proctoring_events_tenant_isolation
  ON proctoring_events
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS proctoring_events_platform_scope ON proctoring_events;
CREATE POLICY proctoring_events_platform_scope
  ON proctoring_events
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS proctoring_events_append_only ON proctoring_events;
CREATE TRIGGER proctoring_events_append_only
BEFORE UPDATE OR DELETE ON proctoring_events
FOR EACH ROW EXECUTE FUNCTION app.reject_update_delete();

CREATE TABLE IF NOT EXISTS "proctoring_reports" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "proctoring_session_id" UUID NOT NULL,
  "risk_score" DECIMAL(8, 4),
  "report_json" JSONB NOT NULL,
  "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "proctoring_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "proctoring_reports_proctoring_session_id_key"
  ON "proctoring_reports" ("proctoring_session_id");

CREATE INDEX IF NOT EXISTS "proctoring_reports_tenant_id_generated_at_idx"
  ON "proctoring_reports" ("tenant_id", "generated_at");

GRANT SELECT, INSERT, UPDATE, DELETE ON proctoring_reports TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE proctoring_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE proctoring_reports FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS proctoring_reports_tenant_isolation ON proctoring_reports;
CREATE POLICY proctoring_reports_tenant_isolation
  ON proctoring_reports
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS proctoring_reports_platform_scope ON proctoring_reports;
CREATE POLICY proctoring_reports_platform_scope
  ON proctoring_reports
  FOR ALL TO atlas_platform
  USING (true)
  WITH CHECK (true);
