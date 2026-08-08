import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  paymentInvoicesListResponseSchema,
  paymentInvoicesQuerySchema,
} from "@atlas/domain/reports/payments-roster.dto";
import { listPaymentsRosterMetadata } from "@atlas/domain/reports/payments-roster.route-metadata";
import { listPaymentInvoices } from "@atlas/domain/reports/payments-roster.service";

export const GET = createTenantRoute<
  z.output<typeof paymentInvoicesQuerySchema>,
  z.output<typeof paymentInvoicesListResponseSchema>
>({
  metadata: listPaymentsRosterMetadata,
  input: paymentInvoicesQuerySchema,
  output: paymentInvoicesListResponseSchema,
  handler: async ({ tx, ctx, input }) => listPaymentInvoices(tx, ctx, input),
});
