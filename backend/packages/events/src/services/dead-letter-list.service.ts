import type { EventsDbTx } from "../transaction";
import { listDeadLetterEventsForPlatform } from "../repositories/dead-letter.repository";
import type { DeadLetterListQuery } from "../schemas/dead-letter-list";

export async function readPlatformDeadLetterList(tx: EventsDbTx, query: DeadLetterListQuery) {
  const result = await listDeadLetterEventsForPlatform(tx, {
    limit: query.limit,
    ...(query.cursor ? { cursor: query.cursor } : {}),
  });

  return {
    data: result.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      outboxEventId: row.outbox_event_id,
      destinationKey: row.destination_key,
      eventType: row.event_type,
      errorCode: row.error_code,
      safeErrorMessage: row.safe_error_message,
      failedAt: row.failed_at.toISOString(),
    })),
    page: {
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    },
  };
}
