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

/**
 * Claims outbox events this consumer group still has undelivered work for.
 *
 * This query previously selected the oldest `limit` rows with `available_at <=
 * now()` and NOTHING ELSE — no completion filter of any kind. Since nothing in
 * the schema marks an event "done", every poll returned the same rows forever:
 *
 *   - already-delivered events were re-polled and re-skipped on every pass,
 *   - events with no handler in this group were re-polled forever and left no
 *     trace at all,
 *   - and because the oldest rows always won the ORDER BY, anything past the
 *     first `limit` rows was NEVER REACHED. The outbox head-of-line blocked
 *     permanently once `limit` inert events accumulated at the front.
 *
 * The bug was invisible while nothing called the worker (audit finding C6); it
 * surfaced the moment the worker ran, as a hot loop reporting 260 processed and
 * 0 delivered on every pass.
 *
 * The fix filters on the delivery ledger that already existed: an event is a
 * candidate only if this group subscribes to its type AND at least one of this
 * group's destinations has no `event_deliveries` row for it. The unique index on
 * `(outbox_event_id, destination_key)` serves the anti-join.
 */
export async function pollOutboxEventsForProcessing(
  tx: EventsDbTx,
  limit: number,
  subscriptions: readonly OutboxSubscription[],
): Promise<OutboxPollRow[]> {
  // A group with no subscriptions has nothing to claim. Without this guard the
  // empty arrays below would make the EXISTS never match anyway, but returning
  // early avoids taking row locks for no reason.
  if (subscriptions.length === 0) return [];

  const eventTypes = subscriptions.map((subscription) => subscription.eventType);
  const destinationKeys = subscriptions.map((subscription) => subscription.destinationKey);

  return tx.$queryRaw<OutboxPollRow[]>`
    SELECT
      o.id,
      o.tenant_id,
      o.event_type,
      o.aggregate_type,
      o.aggregate_id,
      o.payload_json,
      o.metadata_json,
      o.idempotency_key,
      o.occurred_at
    FROM outbox_events o
    WHERE o.available_at <= now()
      AND o.event_type = ANY(${eventTypes}::text[])
      AND EXISTS (
        SELECT 1
        FROM unnest(${eventTypes}::text[], ${destinationKeys}::text[])
          AS subscription(event_type, destination_key)
        WHERE subscription.event_type = o.event_type
          AND NOT EXISTS (
            SELECT 1
            FROM event_deliveries d
            WHERE d.outbox_event_id = o.id
              AND d.destination_key = subscription.destination_key
          )
      )
    ORDER BY o.available_at ASC, o.occurred_at ASC
    LIMIT ${limit}
    FOR UPDATE SKIP LOCKED
  `;
}
