import { withTenantTx } from "@atlas/db";
import { processOutboxBatch } from "@atlas/events/services/outbox-worker.service";
import {
  createEngagementOutboxConsumers,
  createGamificationOutboxConsumers,
} from "../../events/outbox-consumers";

export async function processGamificationOutboxBatch(args: {
  tenantId: string;
  requestId: string;
  limit?: number;
  maxRetries?: number;
}): Promise<{ processed: number; delivered: number; failed: number; skipped: number }> {
  return withTenantTx(
    {
      tenantId: args.tenantId,
      requestId: args.requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) =>
      processOutboxBatch(tx, {
        limit: args.limit ?? 25,
        maxRetries: args.maxRetries ?? 3,
        handlers: createEngagementOutboxConsumers(),
      }),
  );
}

export { createGamificationOutboxConsumers, createEngagementOutboxConsumers };
