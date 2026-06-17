import type { Prisma } from "@atlas/db/generated/prisma/client";
import type { EventsDbTx } from "../transaction";

export type PublishOutboxInput = {
  id: string;
  tenantId: string | null;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  actorMembershipId?: string | null;
  payloadJson: unknown;
  metadataJson: {
    requestId: string;
    idempotencyKey?: string;
  };
  schemaVersion: number;
  idempotencyKey?: string | null;
  availableAt?: Date;
};

function buildMetadataJson(input: PublishOutboxInput): Prisma.InputJsonValue {
  const metadata: Record<string, unknown> = { ...input.metadataJson };

  if (input.actorMembershipId != null) {
    metadata["actorMembershipId"] = input.actorMembershipId;
  }

  metadata["schemaVersion"] = input.schemaVersion;

  return metadata as Prisma.InputJsonValue;
}

export async function insertOutboxEvent(
  tx: EventsDbTx,
  input: PublishOutboxInput,
): Promise<{ id: string }> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO outbox_events (
      id,
      tenant_id,
      event_type,
      aggregate_type,
      aggregate_id,
      payload_json,
      metadata_json,
      idempotency_key,
      available_at
    )
    VALUES (
      ${input.id}::uuid,
      ${input.tenantId},
      ${input.eventType},
      ${input.aggregateType},
      ${input.aggregateId},
      ${input.payloadJson},
      ${buildMetadataJson(input)},
      ${input.idempotencyKey ?? null},
      ${input.availableAt ?? new Date()}
    )
    RETURNING id
  `;

  const row = rows[0];

  if (!row) {
    throw new Error("Failed to insert outbox event");
  }

  return row;
}

export type OutboxPollRow = {
  id: string;
  tenant_id: string | null;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload_json: unknown;
  metadata_json: unknown;
  idempotency_key: string | null;
  occurred_at: Date;
};

export async function pollOutboxEventsForProcessing(
  tx: EventsDbTx,
  limit: number,
): Promise<OutboxPollRow[]> {
  return tx.$queryRaw<OutboxPollRow[]>`
    SELECT
      id,
      tenant_id,
      event_type,
      aggregate_type,
      aggregate_id,
      payload_json,
      metadata_json,
      idempotency_key,
      occurred_at
    FROM outbox_events
    WHERE available_at <= now()
    ORDER BY available_at ASC, occurred_at ASC
    LIMIT ${limit}
    FOR UPDATE SKIP LOCKED
  `;
}
