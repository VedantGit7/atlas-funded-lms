import { createUuidV7 } from "@atlas/core/id/uuid-v7";
import type { EventsDbTx } from "../transaction";

export type EventDeliveryStatus = "SUCCEEDED" | "FAILED" | "SKIPPED";

const DB_STATUS: Record<EventDeliveryStatus, "SENT" | "FAILED" | "CANCELLED"> = {
  SUCCEEDED: "SENT",
  FAILED: "FAILED",
  SKIPPED: "CANCELLED",
};

export async function findEventDelivery(
  tx: EventsDbTx,
  input: {
    outboxEventId: string;
    destinationKey: string;
  },
): Promise<{ status: string } | null> {
  const rows = await tx.$queryRaw<{ status: string }[]>`
    SELECT status::text AS status
    FROM event_deliveries
    WHERE outbox_event_id = ${input.outboxEventId}::uuid
      AND destination_key = ${input.destinationKey}
    ORDER BY attempt_count DESC,created_at DESC
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function insertEventDeliveryAttempt(
  tx: EventsDbTx,
  input: {
    tenantId?: string | null;
    outboxEventId: string;
    destinationKey: string;
    status: EventDeliveryStatus;
    errorCode?: string | null;
    safeErrorMessage?: string | null;
    requestId: string;
    attemptCount?: number;
  },
): Promise<{ id: string }> {
  const id = createUuidV7();
  const responseJson =
    input.status === "SUCCEEDED"
      ? { requestId: input.requestId }
      : {
          requestId: input.requestId,
          errorCode: input.errorCode ?? null,
          safeErrorMessage: input.safeErrorMessage ?? null,
        };

  const rows = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO event_deliveries (
      id,
      tenant_id,
      outbox_event_id,
      destination_key,
      status,
      attempt_count,
      last_attempt_at,
      response_json
    )
    VALUES (
      ${id}::uuid,
      ${input.tenantId ?? null},
      ${input.outboxEventId}::uuid,
      ${input.destinationKey},
      ${DB_STATUS[input.status]}::"DispatchStatus",
      ${input.attemptCount ?? 1},
      now(),
      ${JSON.stringify(responseJson)}::jsonb
    )
    RETURNING id
  `;

  const row = rows[0];

  if (!row) {
    throw new Error("Failed to insert event delivery");
  }

  return row;
}
