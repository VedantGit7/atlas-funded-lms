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
    ON CONFLICT DO NOTHING
    RETURNING id
  `;

  const row = rows[0];

  if (row) {
    return row;
  }

  // No row returned means the ON CONFLICT fired: this exact (tenant,
  // idempotency_key) has already been published.
  //
  // Before this, the insert had no conflict clause at all, so a duplicate
  // publish raised 23505 — and because it happens inside the caller's
  // transaction, Postgres aborted that transaction entirely. Every later
  // statement then failed with 25P02 ("current transaction is aborted"), so one
  // replayed event took down whatever else the request was doing. That is the
  // opposite of what an idempotency key is for: it exists so publishing twice
  // is safe, and a retry, a redelivered webhook or a re-applied tenant manifest
  // all legitimately publish twice.
  //
  // Returning the existing id keeps publish idempotent for callers, which is
  // what they already assume when they pass a key.
  if (input.idempotencyKey != null) {
    const existing = await tx.$queryRaw<{ id: string }[]>`
      SELECT id::text
        FROM outbox_events
       WHERE idempotency_key = ${input.idempotencyKey}
         AND tenant_id IS NOT DISTINCT FROM ${input.tenantId}::uuid
       LIMIT 1
    `;

    const found = existing[0];
    if (found) {
      return found;
    }
  }

  throw new Error("Failed to insert outbox event");
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

/** One (event type, destination) pair a consumer group is subscribed to. */
export type OutboxSubscription = {
  eventType: string;
  destinationKey: string;
};
