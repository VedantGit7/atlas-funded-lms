import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  paymentGatewaysListResponseSchema,
  paymentGatewaysQuerySchema,
} from "@atlas/domain/reports/payments-roster.dto";
import { listPaymentsRosterMetadata } from "@atlas/domain/reports/payments-roster.route-metadata";
import { listPaymentReportGateways } from "@atlas/domain/reports/payments-roster.service";

export const GET = createTenantRoute<
  z.output<typeof paymentGatewaysQuerySchema>,
  z.output<typeof paymentGatewaysListResponseSchema>
>({
  metadata: listPaymentsRosterMetadata,
  input: paymentGatewaysQuerySchema,
  output: paymentGatewaysListResponseSchema,
  handler: async ({ tx, ctx, input }) => listPaymentReportGateways(tx, ctx, input),
});
