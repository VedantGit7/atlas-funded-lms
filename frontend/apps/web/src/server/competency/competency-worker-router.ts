// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import { withTenantTx } from "@atlas/db";
import { processOutboxBatch } from "@atlas/events/services/outbox-worker.service";
import { runWorkerOutboxBatch } from "@atlas/observability";
import {
  createEngagementOutboxConsumers,
  createCompetencyOutboxConsumers,
} from "../../events/outbox-consumers";

export async function processCompetencyOutboxBatch(args: {
  tenantId: string;
  requestId: string;
  limit?: number;
  maxRetries?: number;
}): Promise<{ processed: number; delivered: number; failed: number; skipped: number }> {
  return runWorkerOutboxBatch({
    parentRequestId: args.requestId,
    jobName: "competency-outbox",
    execute: () =>
      withTenantTx(
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
      ),
  });
}
export { createEngagementOutboxConsumers };
export { createCompetencyOutboxConsumers };
