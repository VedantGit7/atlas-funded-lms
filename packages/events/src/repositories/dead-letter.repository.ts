import { createUuidV7 } from "@atlas/core/id/uuid-v7";
import type { EventsDbTx } from "../transaction";

export type DeadLetterReplayRow = {
  id: string;
  outbox_event_id: string;
  tenant_id: string | null;
  destination_key: string | null;
  event_type: string;
  payload_json: unknown;
  request_id: string;
};

function parseDeadLetterErrorJson(errorJson: unknown): {
  eventType: string;
  payloadJson: unknown;
  requestId: string;
  errorCode: string | null;
  safeErrorMessage: string | null;
} {
  const record =
    errorJson != null && typeof errorJson === "object"
      ? (errorJson as Record<string, unknown>)
      : {};

  return {
    eventType: typeof record["eventType"] === "string" ? record["eventType"] : "unknown.event",
    payloadJson: record["payloadJson"] ?? null,
    requestId: typeof record["requestId"] === "string" ? record["requestId"] : "unknown",
    errorCode: typeof record["errorCode"] === "string" ? record["errorCode"] : null,
    safeErrorMessage:
      typeof record["safeErrorMessage"] === "string" ? record["safeErrorMessage"] : null,
  };
}

export async function insertDeadLetterEvent(
  tx: EventsDbTx,
  input: {
    outboxEventId: string;
    tenantId: string | null;
    destinationKey: string;
    eventType: string;
    errorCode: string;
    safeErrorMessage: string;
    retryCount: number;
    requestId: string;
    payloadJson?: unknown;
  },
): Promise<{ id: string }> {
  const id = createUuidV7();
  const errorJson = {
    eventType: input.eventType,
    payloadJson: input.payloadJson ?? null,
    requestId: input.requestId,
    errorCode: input.errorCode,
    safeErrorMessage: input.safeErrorMessage,
    retryCount: input.retryCount,
  };

  const rows = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO dead_letter_events (
      id,
      tenant_id,
      outbox_event_id,
      destination_key,
      error_json,
      failed_at
    )
    VALUES (
      ${id}::uuid,
      ${input.tenantId},
      ${input.outboxEventId}::uuid,
      ${input.destinationKey},
      ${errorJson},
      now()
    )
    RETURNING id
  `;

  const row = rows[0];

  if (!row) {
    throw new Error("Failed to insert dead letter event");
  }

  return row;
}

export async function findDeadLetterForReplay(
  tx: EventsDbTx,
  id: string,
): Promise<DeadLetterReplayRow | null> {
  const rows = await tx.$queryRaw<
    {
      id: string;
      outbox_event_id: string;
      tenant_id: string | null;
      destination_key: string | null;
      error_json: unknown;
    }[]
  >`
    SELECT
      id,
      outbox_event_id,
      tenant_id,
      destination_key,
      error_json
    FROM dead_letter_events
    WHERE id = ${id}::uuid
    LIMIT 1
  `;

  const row = rows[0];

  if (!row) {
    return null;
  }

  const parsed = parseDeadLetterErrorJson(row.error_json);

  return {
    id: row.id,
    outbox_event_id: row.outbox_event_id,
    tenant_id: row.tenant_id,
    destination_key: row.destination_key,
    event_type: parsed.eventType,
    payload_json: parsed.payloadJson,
    request_id: parsed.requestId,
  };
}
