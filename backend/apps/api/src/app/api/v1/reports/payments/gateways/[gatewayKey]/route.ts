import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  paymentGatewayDetailQuerySchema,
  paymentGatewayDetailResponseSchema,
  paymentGatewayKeyParamsSchema,
} from "@atlas/domain/reports/payments-roster.dto";
import { listPaymentsRosterMetadata } from "@atlas/domain/reports/payments-roster.route-metadata";
import { getPaymentGatewayDetail } from "@atlas/domain/reports/payments-roster.service";

export const GET = createTenantRoute<
  z.output<typeof paymentGatewayDetailQuerySchema>,
  z.output<typeof paymentGatewayDetailResponseSchema>,
  typeof paymentGatewayKeyParamsSchema
>({
  metadata: listPaymentsRosterMetadata,
  input: paymentGatewayDetailQuerySchema,
  params: paymentGatewayKeyParamsSchema,
  output: paymentGatewayDetailResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    getPaymentGatewayDetail(tx, ctx, params.gatewayKey, input),
});
