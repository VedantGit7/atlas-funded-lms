import { withTenantTx } from "@atlas/db";
import { runWorkerOutboxBatch } from "@atlas/observability";

export const SEARCH_WORKER_DESTINATION = "search.index";

export async function processSearchOutboxBatch(args: {
  tenantId: string;
  requestId: string;
  limit?: number;
  maxRetries?: number;
}): Promise<{ processed: number; delivered: number; failed: number; skipped: number }> {
  const { processOutboxBatch } = await import("@atlas/events");
  const { createSearchOutboxConsumers } = await import("../../events/outbox-consumers");

  return runWorkerOutboxBatch({
    parentRequestId: args.requestId,
    jobName: "search-outbox",
    execute: () =>
      processOutboxBatch(
        {
          transaction: (fn) =>
            withTenantTx(
              {
                tenantId: args.tenantId,
                requestId: args.requestId,
                allowAnonymousTenantRead: true,
              },
              fn,
            ),
        },
        {
          limit: args.limit ?? 25,
          maxRetries: args.maxRetries ?? 3,
          handlers: createSearchOutboxConsumers(),
        },
      ),
  });
}
