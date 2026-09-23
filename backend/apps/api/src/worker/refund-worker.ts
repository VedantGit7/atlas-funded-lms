import { withTenantTx } from "@atlas/db/with-tenant-tx";
import type { TenantTx } from "@atlas/db";
import { resolvePaymentProvider } from "@atlas/domain/payments/payment-provider.registry";
import { processOneRefund } from "@atlas/domain/payments/refund-workflow";

export async function processPaymentRefundBatch(args: {
  tenantId: string;
  requestId: string;
  limit?: number;
}) {
  let processed = 0;
  const limit = Math.max(1, Math.min(args.limit ?? 10, 25));
  for (let index = 0; index < limit; index++) {
    const result = await processOneRefund({
      transaction: (fn) =>
        withTenantTx(
          { tenantId: args.tenantId, requestId: args.requestId, allowAnonymousTenantRead: true },
          fn,
        ),
      resolveProvider: (tx, intent) =>
        resolvePaymentProvider(tx as TenantTx, { gatewayKey: intent.gateway_key }),
    });
    if (result === "empty") break;
    processed++;
  }
  // Processing may leave a reservation pending/reconciling; it isn't a confirmed refund.
  return { processed, delivered: 0, failed: 0, skipped: 0 };
}
