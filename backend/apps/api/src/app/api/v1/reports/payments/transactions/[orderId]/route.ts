import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  paymentTransactionDetailParamsSchema,
  paymentTransactionDetailResponseSchema,
} from "@atlas/domain/reports/payments-roster.dto";
import { listPaymentsRosterMetadata } from "@atlas/domain/reports/payments-roster.route-metadata";
import { getPaymentTransactionDetail } from "@atlas/domain/reports/payments-roster.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof paymentTransactionDetailResponseSchema>,
  typeof paymentTransactionDetailParamsSchema
>({
  metadata: listPaymentsRosterMetadata,
  params: paymentTransactionDetailParamsSchema,
  output: paymentTransactionDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getPaymentTransactionDetail(tx, ctx, params["orderId"]),
});
