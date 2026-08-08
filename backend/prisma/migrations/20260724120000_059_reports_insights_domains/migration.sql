-- CreateTable
CREATE TABLE "report_definitions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "param_schema_json" JSONB NOT NULL,
    "dataset_key" TEXT NOT NULL,
    "default_format" TEXT NOT NULL DEFAULT 'csv',
    "scope" TEXT NOT NULL DEFAULT 'system',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "report_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_schedules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "report_definition_id" UUID NOT NULL,
    "created_by_membership_id" UUID NOT NULL,
    "name" TEXT,
    "cron_expression" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "params_json" JSONB NOT NULL DEFAULT '{}',
    "formats_json" JSONB NOT NULL DEFAULT '["csv"]',
    "delivery_json" JSONB,
    "next_run_at" TIMESTAMPTZ(6) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "report_definition_id" UUID NOT NULL,
    "report_schedule_id" UUID,
    "requested_by_membership_id" UUID NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "params_json" JSONB NOT NULL,
    "format" TEXT NOT NULL,
    "row_count" INTEGER,
    "r2_object_key" TEXT,
    "error_json" JSONB,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "report_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "at_risk_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rule_type" TEXT NOT NULL,
    "config_json" JSONB NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "at_risk_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "at_risk_alerts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "at_risk_rule_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "context_json" JSONB,
    "triggered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "at_risk_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "device_fingerprint" TEXT,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "platform" TEXT,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "device_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_orders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID,
    "external_id" TEXT,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL,
    "metadata_json" JSONB,
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "course_id" UUID,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_memberships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "batch_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "polls" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "context_json" JSONB,
    "closes_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "polls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_options" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "poll_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_responses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "poll_id" UUID NOT NULL,
    "poll_option_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "poll_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_attribution_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID,
    "event_type" TEXT NOT NULL,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "utm_term" TEXT,
    "utm_content" TEXT,
    "revenue_cents" INTEGER,
    "currency" TEXT,
    "metadata_json" JSONB,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sales_attribution_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_definitions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "field_type" TEXT NOT NULL,
    "options_json" JSONB,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_values" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "custom_field_definition_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "value_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "custom_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zoom_connections" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "account_id" TEXT,
    "access_token_ref" TEXT,
    "refresh_token_ref" TEXT,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "connected_at" TIMESTAMPTZ(6),
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "zoom_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zoom_meetings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "zoom_connection_id" UUID NOT NULL,
    "external_meeting_id" TEXT NOT NULL,
    "topic" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "zoom_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zoom_meeting_participants" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "zoom_meeting_id" UUID NOT NULL,
    "membership_id" UUID,
    "external_user_id" TEXT,
    "display_name" TEXT,
    "join_time" TIMESTAMPTZ(6),
    "leave_time" TIMESTAMPTZ(6),
    "duration_seconds" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "zoom_meeting_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "course_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "scheduled_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "live_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_attendance" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "live_session_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'registered',
    "joined_at" TIMESTAMPTZ(6),
    "left_at" TIMESTAMPTZ(6),
    "duration_seconds" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "live_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messenger_conversations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "subject" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "messenger_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messenger_messages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_membership_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "metadata_json" JSONB,
    "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "messenger_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_export_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "requested_by_membership_id" UUID NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "dataset_key" TEXT NOT NULL,
    "params_json" JSONB,
    "r2_object_key" TEXT,
    "error_json" JSONB,
    "completed_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bi_export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "report_definitions_tenant_id_key_key" ON "report_definitions"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "report_definitions_tenant_id_category_idx" ON "report_definitions"("tenant_id", "category");

-- CreateIndex
CREATE INDEX "report_schedules_tenant_id_next_run_at_is_active_idx" ON "report_schedules"("tenant_id", "next_run_at", "is_active");

-- CreateIndex
CREATE INDEX "report_runs_tenant_id_status_created_at_idx" ON "report_runs"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "at_risk_rules_tenant_id_key_key" ON "at_risk_rules"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "at_risk_rules_tenant_id_status_idx" ON "at_risk_rules"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "at_risk_alerts_tenant_id_status_triggered_at_idx" ON "at_risk_alerts"("tenant_id", "status", "triggered_at");

-- CreateIndex
CREATE INDEX "at_risk_alerts_tenant_id_membership_id_idx" ON "at_risk_alerts"("tenant_id", "membership_id");

-- CreateIndex
CREATE INDEX "device_sessions_tenant_id_membership_id_last_seen_at_idx" ON "device_sessions"("tenant_id", "membership_id", "last_seen_at");

-- CreateIndex
CREATE INDEX "device_sessions_tenant_id_last_seen_at_idx" ON "device_sessions"("tenant_id", "last_seen_at");

-- CreateIndex
CREATE INDEX "payment_orders_tenant_id_status_created_at_idx" ON "payment_orders"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "payment_orders_tenant_id_membership_id_idx" ON "payment_orders"("tenant_id", "membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "batches_tenant_id_key_key" ON "batches"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "batches_tenant_id_status_idx" ON "batches"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "batch_memberships_tenant_id_batch_id_membership_id_key" ON "batch_memberships"("tenant_id", "batch_id", "membership_id");

-- CreateIndex
CREATE INDEX "batch_memberships_tenant_id_membership_id_idx" ON "batch_memberships"("tenant_id", "membership_id");

-- CreateIndex
CREATE INDEX "polls_tenant_id_status_idx" ON "polls"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "poll_options_tenant_id_poll_id_idx" ON "poll_options"("tenant_id", "poll_id");

-- CreateIndex
CREATE UNIQUE INDEX "poll_responses_tenant_id_poll_id_membership_id_key" ON "poll_responses"("tenant_id", "poll_id", "membership_id");

-- CreateIndex
CREATE INDEX "poll_responses_tenant_id_poll_id_idx" ON "poll_responses"("tenant_id", "poll_id");

-- CreateIndex
CREATE INDEX "sales_attribution_events_tenant_id_occurred_at_idx" ON "sales_attribution_events"("tenant_id", "occurred_at");

-- CreateIndex
CREATE INDEX "sales_attribution_events_tenant_id_utm_source_utm_campaign_idx" ON "sales_attribution_events"("tenant_id", "utm_source", "utm_campaign");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_definitions_tenant_id_key_key" ON "custom_field_definitions"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "custom_field_definitions_tenant_id_status_idx" ON "custom_field_definitions"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_values_tenant_id_custom_field_definition_id_membership_id_key" ON "custom_field_values"("tenant_id", "custom_field_definition_id", "membership_id");

-- CreateIndex
CREATE INDEX "custom_field_values_tenant_id_membership_id_idx" ON "custom_field_values"("tenant_id", "membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "zoom_connections_tenant_id_key" ON "zoom_connections"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "zoom_meetings_tenant_id_external_meeting_id_key" ON "zoom_meetings"("tenant_id", "external_meeting_id");

-- CreateIndex
CREATE INDEX "zoom_meetings_tenant_id_started_at_idx" ON "zoom_meetings"("tenant_id", "started_at");

-- CreateIndex
CREATE INDEX "zoom_meeting_participants_tenant_id_zoom_meeting_id_idx" ON "zoom_meeting_participants"("tenant_id", "zoom_meeting_id");

-- CreateIndex
CREATE INDEX "live_sessions_tenant_id_status_scheduled_at_idx" ON "live_sessions"("tenant_id", "status", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "live_attendance_tenant_id_live_session_id_membership_id_key" ON "live_attendance"("tenant_id", "live_session_id", "membership_id");

-- CreateIndex
CREATE INDEX "live_attendance_tenant_id_live_session_id_idx" ON "live_attendance"("tenant_id", "live_session_id");

-- CreateIndex
CREATE INDEX "messenger_conversations_tenant_id_status_updated_at_idx" ON "messenger_conversations"("tenant_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "messenger_messages_tenant_id_conversation_id_sent_at_idx" ON "messenger_messages"("tenant_id", "conversation_id", "sent_at");

-- CreateIndex
CREATE INDEX "bi_export_jobs_tenant_id_status_created_at_idx" ON "bi_export_jobs"("tenant_id", "status", "created_at");

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_report_definition_id_fkey" FOREIGN KEY ("report_definition_id") REFERENCES "report_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_runs" ADD CONSTRAINT "report_runs_report_definition_id_fkey" FOREIGN KEY ("report_definition_id") REFERENCES "report_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_runs" ADD CONSTRAINT "report_runs_report_schedule_id_fkey" FOREIGN KEY ("report_schedule_id") REFERENCES "report_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "at_risk_alerts" ADD CONSTRAINT "at_risk_alerts_at_risk_rule_id_fkey" FOREIGN KEY ("at_risk_rule_id") REFERENCES "at_risk_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_memberships" ADD CONSTRAINT "batch_memberships_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_responses" ADD CONSTRAINT "poll_responses_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_responses" ADD CONSTRAINT "poll_responses_poll_option_id_fkey" FOREIGN KEY ("poll_option_id") REFERENCES "poll_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_custom_field_definition_id_fkey" FOREIGN KEY ("custom_field_definition_id") REFERENCES "custom_field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zoom_meetings" ADD CONSTRAINT "zoom_meetings_zoom_connection_id_fkey" FOREIGN KEY ("zoom_connection_id") REFERENCES "zoom_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zoom_meeting_participants" ADD CONSTRAINT "zoom_meeting_participants_zoom_meeting_id_fkey" FOREIGN KEY ("zoom_meeting_id") REFERENCES "zoom_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_attendance" ADD CONSTRAINT "live_attendance_live_session_id_fkey" FOREIGN KEY ("live_session_id") REFERENCES "live_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messenger_messages" ADD CONSTRAINT "messenger_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "messenger_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Grants (new tables do not inherit prior GRANT ON ALL TABLES)
GRANT SELECT, INSERT, UPDATE, DELETE ON report_definitions TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON report_schedules TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON report_runs TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON at_risk_rules TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON at_risk_alerts TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON device_sessions TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON payment_orders TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON batches TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON batch_memberships TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON polls TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON poll_options TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON poll_responses TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_attribution_events TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON custom_field_definitions TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON custom_field_values TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON zoom_connections TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON zoom_meetings TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON zoom_meeting_participants TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON live_sessions TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON live_attendance TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON messenger_conversations TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON messenger_messages TO atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON bi_export_jobs TO atlas_app, atlas_worker, atlas_platform;
