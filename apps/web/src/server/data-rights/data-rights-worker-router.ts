import { withTenantTx } from "@atlas/db";

export { DATA_EXPORT_WORKER_DESTINATION } from "@atlas/domain/data-rights/data-rights.worker";

export async function processDataRightsOutboxBatch(args: {
  tenantId: string;
  requestId: string;
  limit?: number;
  maxRetries?: number;
}): Promise<{ processed: number; delivered: number; failed: number; skipped: number }> {
  const { processOutboxBatch } = await import("@atlas/events/services/outbox-worker.service");
  const { createDataRightsOutboxConsumers } = await import("../../events/outbox-consumers");

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
        handlers: createDataRightsOutboxConsumers(),
      }),
  );
}
