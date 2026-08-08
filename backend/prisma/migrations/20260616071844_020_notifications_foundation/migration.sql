-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "variables_json" JSONB,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_dispatches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID,
    "channel" TEXT NOT NULL,
    "template_key" TEXT,
    "destination" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "status" "DispatchStatus" NOT NULL DEFAULT 'QUEUED',
    "payload_json" JSONB NOT NULL,
    "error_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(6),

    CONSTRAINT "notification_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_tenant_id_key_channel_locale_key" ON "notification_templates"("tenant_id", "key", "channel", "locale");

-- CreateIndex
CREATE INDEX "notification_dispatches_tenant_id_membership_id_created_at_idx" ON "notification_dispatches"("tenant_id", "membership_id", "created_at");

-- CreateIndex
CREATE INDEX "notification_dispatches_tenant_id_status_created_at_idx" ON "notification_dispatches"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_dispatches_tenant_id_idempotency_key_key" ON "notification_dispatches"("tenant_id", "idempotency_key");
