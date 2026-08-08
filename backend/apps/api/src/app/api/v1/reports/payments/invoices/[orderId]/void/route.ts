import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  paymentInvoiceDetailParamsSchema,
  voidPaymentInvoiceBodySchema,
  voidPaymentInvoiceResponseSchema,
} from "@atlas/domain/reports/payments-roster.dto";
import { mutatePaymentsRosterMetadata } from "@atlas/domain/reports/payments-roster.route-metadata";
import { voidPaymentInvoice } from "@atlas/domain/reports/payments-roster.service";

export const POST = createTenantRoute<
  z.output<typeof voidPaymentInvoiceBodySchema>,
  z.output<typeof voidPaymentInvoiceResponseSchema>,
  typeof paymentInvoiceDetailParamsSchema
>({
  metadata: mutatePaymentsRosterMetadata,
  body: voidPaymentInvoiceBodySchema,
  params: paymentInvoiceDetailParamsSchema,
  output: voidPaymentInvoiceResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    voidPaymentInvoice(tx, ctx, params.orderId, input.reason),
});
