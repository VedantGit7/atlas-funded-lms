import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  paymentGatewayKeyParamsSchema,
  paymentTransactionsListResponseSchema,
  paymentTransactionsQuerySchema,
} from "@atlas/domain/reports/payments-roster.dto";
import { listPaymentsRosterMetadata } from "@atlas/domain/reports/payments-roster.route-metadata";
import { listPaymentGatewayTransactions } from "@atlas/domain/reports/payments-roster.service";

export const GET = createTenantRoute<
  z.output<typeof paymentTransactionsQuerySchema>,
  z.output<typeof paymentTransactionsListResponseSchema>,
  typeof paymentGatewayKeyParamsSchema
>({
  metadata: listPaymentsRosterMetadata,
  input: paymentTransactionsQuerySchema,
  params: paymentGatewayKeyParamsSchema,
  output: paymentTransactionsListResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    listPaymentGatewayTransactions(tx, ctx, params["gatewayKey"], input),
});
