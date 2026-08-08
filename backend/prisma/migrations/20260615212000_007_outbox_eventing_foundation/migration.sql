-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "event_type" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "payload_json" JSONB NOT NULL,
    "metadata_json" JSONB,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_deliveries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "outbox_event_id" UUID NOT NULL,
    "destination_key" TEXT NOT NULL,
    "status" "DispatchStatus" NOT NULL DEFAULT 'QUEUED',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMPTZ(6),
    "next_attempt_at" TIMESTAMPTZ(6),
    "response_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dead_letter_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "outbox_event_id" UUID NOT NULL,
    "destination_key" TEXT,
    "error_json" JSONB NOT NULL,
    "failed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dead_letter_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbox_events_tenant_id_event_type_occurred_at_idx" ON "outbox_events"("tenant_id", "event_type", "occurred_at");

-- CreateIndex
CREATE INDEX "outbox_events_available_at_idx" ON "outbox_events"("available_at");

-- CreateIndex
CREATE INDEX "event_deliveries_tenant_id_status_next_attempt_at_idx" ON "event_deliveries"("tenant_id", "status", "next_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "event_deliveries_outbox_event_id_destination_key_key" ON "event_deliveries"("outbox_event_id", "destination_key");

-- CreateIndex
CREATE INDEX "dead_letter_events_tenant_id_failed_at_idx" ON "dead_letter_events"("tenant_id", "failed_at");
