// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import { withTenantTx } from "@atlas/db";
import { runWorkerOutboxBatch } from "@atlas/observability";

export { REPORT_GENERATE_WORKER_DESTINATION } from "@atlas/domain/reports/reports.worker";

export async function processReportsOutboxBatch(args: {
  tenantId: string;
  requestId: string;
  limit?: number;
  maxRetries?: number;
}): Promise<{ processed: number; delivered: number; failed: number; skipped: number }> {
  const { processOutboxBatch } = await import("@atlas/events/services/outbox-worker.service");
  const { createReportsOutboxConsumers } = await import("../../events/outbox-consumers");

  return runWorkerOutboxBatch({
    parentRequestId: args.requestId,
    jobName: "reports-outbox",
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
            handlers: createReportsOutboxConsumers(),
          }),
      ),
  });
}
