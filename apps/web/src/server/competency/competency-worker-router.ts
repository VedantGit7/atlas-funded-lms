import { withTenantTx } from "@atlas/db";
import { processOutboxBatch } from "@atlas/events/services/outbox-worker.service";
import { createCompetencyOutboxConsumers } from "../../events/outbox-consumers";

export async function processCompetencyOutboxBatch(args: {
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
        handlers: createCompetencyOutboxConsumers(),
      }),
  );
}

export { createCompetencyOutboxConsumers };
