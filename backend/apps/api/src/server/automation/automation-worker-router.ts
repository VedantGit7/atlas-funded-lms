import { withTenantTx } from "@atlas/db";
import { processOutboxBatch } from "@atlas/events/services/outbox-worker.service";
import { runWorkerOutboxBatch } from "@atlas/observability";
import { createAutomationOutboxConsumers } from "../../events/outbox-consumers";

export async function processAutomationOutboxBatch(args: {
  tenantId: string;
  requestId: string;
  limit?: number;
  maxRetries?: number;
}): Promise<{ processed: number; delivered: number; failed: number; skipped: number }> {
  return runWorkerOutboxBatch({
    parentRequestId: args.requestId,
    jobName: "automation-outbox",
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
          handlers: createAutomationOutboxConsumers(),
        },
      ),
  });
}

export { createAutomationOutboxConsumers };
