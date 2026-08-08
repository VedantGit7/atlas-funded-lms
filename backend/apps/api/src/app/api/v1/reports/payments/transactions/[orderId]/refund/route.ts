import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  paymentTransactionDetailParamsSchema,
  refundPaymentTransactionBodySchema,
  refundPaymentTransactionResponseSchema,
} from "@atlas/domain/reports/payments-roster.dto";
import { mutatePaymentsRosterMetadata } from "@atlas/domain/reports/payments-roster.route-metadata";
import { refundPaymentTransaction } from "@atlas/domain/reports/payments-roster.service";

export const POST = createTenantRoute<
  z.output<typeof refundPaymentTransactionBodySchema>,
  z.output<typeof refundPaymentTransactionResponseSchema>,
  typeof paymentTransactionDetailParamsSchema
>({
  metadata: mutatePaymentsRosterMetadata,
  body: refundPaymentTransactionBodySchema,
  params: paymentTransactionDetailParamsSchema,
  output: refundPaymentTransactionResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    refundPaymentTransaction(tx, ctx, params.orderId, input),
});
