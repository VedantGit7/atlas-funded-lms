import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  payPaymentInstalmentBodySchema,
  payPaymentInstalmentResponseSchema,
  paymentInstalmentPlanParamsSchema,
} from "@atlas/domain/reports/payments-roster.dto";
import { mutatePaymentsRosterMetadata } from "@atlas/domain/reports/payments-roster.route-metadata";
import { payPaymentInstalment } from "@atlas/domain/reports/payments-roster.service";

export const POST = createTenantRoute<
  z.output<typeof payPaymentInstalmentBodySchema>,
  z.output<typeof payPaymentInstalmentResponseSchema>,
  typeof paymentInstalmentPlanParamsSchema
>({
  metadata: mutatePaymentsRosterMetadata,
  body: payPaymentInstalmentBodySchema,
  params: paymentInstalmentPlanParamsSchema,
  output: payPaymentInstalmentResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    payPaymentInstalment(tx, ctx, params.planId, input),
});
