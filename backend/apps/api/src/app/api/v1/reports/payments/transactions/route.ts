import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  paymentTransactionsListResponseSchema,
  paymentTransactionsQuerySchema,
} from "@atlas/domain/reports/payments-roster.dto";
import { listPaymentsRosterMetadata } from "@atlas/domain/reports/payments-roster.route-metadata";
import { listPaymentTransactions } from "@atlas/domain/reports/payments-roster.service";

export const GET = createTenantRoute<
  z.output<typeof paymentTransactionsQuerySchema>,
  z.output<typeof paymentTransactionsListResponseSchema>
>({
  metadata: listPaymentsRosterMetadata,
  input: paymentTransactionsQuerySchema,
  output: paymentTransactionsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listPaymentTransactions(tx, ctx, input),
});
