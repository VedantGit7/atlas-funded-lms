import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  exportPaymentRosterBodySchema,
  exportPaymentRosterResponseSchema,
  paymentGatewayKeyParamsSchema,
} from "@atlas/domain/reports/payments-roster.dto";
import { exportPaymentsRosterMetadata } from "@atlas/domain/reports/payments-roster.route-metadata";
import { exportPaymentRoster } from "../../../../../../../../server/reports/payments-roster-actions.service";

export const POST = createTenantRoute<
  z.output<typeof exportPaymentRosterBodySchema>,
  z.output<typeof exportPaymentRosterResponseSchema>,
  typeof paymentGatewayKeyParamsSchema
>({
  metadata: exportPaymentsRosterMetadata,
  body: exportPaymentRosterBodySchema,
  params: paymentGatewayKeyParamsSchema,
  output: exportPaymentRosterResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    exportPaymentRoster(tx, ctx, {
      ...input,
      tab: "gateways",
      gatewayKey: params.gatewayKey,
    }),
});
