import { withTenantTx } from "@atlas/db";
import { runWorkerOutboxBatch } from "@atlas/observability";

export { CERTIFICATE_WORKER_DESTINATION } from "./certificate.worker";

/**
 * Drain certificate outbox events for a tenant (PDF render on certificate.issued).
 *
 * Invoke via:
 * - `scheduleCertificatePdfDrain` (after() following issue) when CERTIFICATE_PDF_WORKER=true
 * - Manual/ops call to processCertificateOutboxBatch
 * - Certificate expire cron (best-effort backlog drain per tenant)
 */
export async function processCertificateOutboxBatch(args: {
  tenantId: string;
  requestId: string;
  limit?: number;
  maxRetries?: number;
}): Promise<{ processed: number; delivered: number; failed: number; skipped: number }> {
  const { processOutboxBatch } = await import("@atlas/events/services/outbox-worker.service");
  const { createCertificateOutboxConsumers } = await import("../../events/outbox-consumers");

  return runWorkerOutboxBatch({
    parentRequestId: args.requestId,
    jobName: "certificates-outbox",
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
            handlers: createCertificateOutboxConsumers(),
          }),
      ),
  });
}
