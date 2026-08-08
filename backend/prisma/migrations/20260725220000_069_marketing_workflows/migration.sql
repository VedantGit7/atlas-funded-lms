-- Migration 069: Marketing Workflows (Learnyst Marketing → Workflows).

CREATE TABLE "marketing_workflows" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "allow_resubscribe" BOOLEAN NOT NULL DEFAULT false,
    "use_case_key" TEXT,
    "graph_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_by_membership_id" UUID NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_workflows_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "marketing_workflows_tenant_status_created_idx"
  ON "marketing_workflows"("tenant_id", "status", "created_at");
CREATE INDEX "marketing_workflows_tenant_use_case_idx"
  ON "marketing_workflows"("tenant_id", "use_case_key");

CREATE TABLE "marketing_workflow_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "trigger_event_type" TEXT NOT NULL,
    "trigger_payload_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "current_node_id" TEXT,
    "wait_until" TIMESTAMPTZ(6),
    "idempotency_key" TEXT NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    CONSTRAINT "marketing_workflow_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketing_workflow_runs_tenant_idempotency_key"
  ON "marketing_workflow_runs"("tenant_id", "idempotency_key");
CREATE INDEX "marketing_workflow_runs_tenant_workflow_created_idx"
  ON "marketing_workflow_runs"("tenant_id", "workflow_id", "created_at");
CREATE INDEX "marketing_workflow_runs_tenant_status_wait_idx"
  ON "marketing_workflow_runs"("tenant_id", "status", "wait_until");

CREATE TABLE "marketing_workflow_run_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "node_id" TEXT,
    "node_type" TEXT,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_workflow_run_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "marketing_workflow_run_logs_tenant_run_created_idx"
  ON "marketing_workflow_run_logs"("tenant_id", "run_id", "created_at");

GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_workflows TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_workflow_runs TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_workflow_run_logs TO atlas_app, atlas_worker, atlas_platform;

ALTER TABLE marketing_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_workflows FORCE ROW LEVEL SECURITY;
ALTER TABLE marketing_workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_workflow_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE marketing_workflow_run_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_workflow_run_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_workflows_tenant_isolation ON marketing_workflows;
CREATE POLICY marketing_workflows_tenant_isolation ON marketing_workflows
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS marketing_workflows_platform_scope ON marketing_workflows;
CREATE POLICY marketing_workflows_platform_scope ON marketing_workflows
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS marketing_workflow_runs_tenant_isolation ON marketing_workflow_runs;
CREATE POLICY marketing_workflow_runs_tenant_isolation ON marketing_workflow_runs
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS marketing_workflow_runs_platform_scope ON marketing_workflow_runs;
CREATE POLICY marketing_workflow_runs_platform_scope ON marketing_workflow_runs
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS marketing_workflow_run_logs_tenant_isolation ON marketing_workflow_run_logs;
CREATE POLICY marketing_workflow_run_logs_tenant_isolation ON marketing_workflow_run_logs
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
DROP POLICY IF EXISTS marketing_workflow_run_logs_platform_scope ON marketing_workflow_run_logs;
CREATE POLICY marketing_workflow_run_logs_platform_scope ON marketing_workflow_run_logs
  FOR ALL TO atlas_platform USING (true) WITH CHECK (true);
