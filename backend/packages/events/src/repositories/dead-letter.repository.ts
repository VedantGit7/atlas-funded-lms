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

export type DeadLetterListRow = {
  id: string;
  tenant_id: string | null;
  outbox_event_id: string;
  destination_key: string | null;
  event_type: string;
  error_code: string | null;
  safe_error_message: string | null;
  failed_at: Date;
};

function decodeDeadLetterCursor(cursor: string | undefined): { failedAt: Date; id: string } | null {
  if (!cursor) {
    return null;
  }

  const [failedAt, id] = cursor.split("|");
  if (!failedAt || !id) {
    return null;
  }

  const parsed = new Date(failedAt);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return { failedAt: parsed, id };
}

function encodeDeadLetterCursor(row: DeadLetterListRow): string {
  return `${row.failed_at.toISOString()}|${row.id}`;
}

export async function listDeadLetterEventsForPlatform(
  tx: EventsDbTx,
  query: { limit: number; cursor?: string },
): Promise<{ rows: DeadLetterListRow[]; nextCursor: string | null; hasMore: boolean }> {
  const limitPlusOne = query.limit + 1;
  const cursor = decodeDeadLetterCursor(query.cursor);

  const rows = await tx.$queryRaw<DeadLetterListRow[]>`
    SELECT
      d.id::text AS id,
      d.tenant_id::text AS tenant_id,
      d.outbox_event_id::text AS outbox_event_id,
      d.destination_key,
      COALESCE(d.error_json->>'eventType', 'unknown.event') AS event_type,
      d.error_json->>'errorCode' AS error_code,
      d.error_json->>'safeErrorMessage' AS safe_error_message,
      d.failed_at
    FROM dead_letter_events d
    WHERE (
      ${cursor?.failedAt ?? null}::timestamptz IS NULL
      OR d.failed_at < ${cursor?.failedAt ?? null}::timestamptz
      OR (
        d.failed_at = ${cursor?.failedAt ?? null}::timestamptz
        AND d.id < ${cursor?.id ?? null}::uuid
      )
    )
    ORDER BY d.failed_at DESC, d.id DESC
    LIMIT ${limitPlusOne}
  `;

  const hasMore = rows.length > query.limit;
  const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
  const last = pageRows[pageRows.length - 1];

  return {
    rows: pageRows,
    hasMore,
    nextCursor: hasMore && last ? encodeDeadLetterCursor(last) : null,
  };
}
