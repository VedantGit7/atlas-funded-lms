import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  paymentInvoiceDetailParamsSchema,
  paymentInvoiceDetailResponseSchema,
} from "@atlas/domain/reports/payments-roster.dto";
import { listPaymentsRosterMetadata } from "@atlas/domain/reports/payments-roster.route-metadata";
import { getPaymentInvoiceDetail } from "@atlas/domain/reports/payments-roster.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof paymentInvoiceDetailResponseSchema>,
  typeof paymentInvoiceDetailParamsSchema
>({
  metadata: listPaymentsRosterMetadata,
  params: paymentInvoiceDetailParamsSchema,
  output: paymentInvoiceDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getPaymentInvoiceDetail(tx, ctx, params.orderId),
});
