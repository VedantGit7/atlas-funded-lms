import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  cancelPaymentInstalmentPlanBodySchema,
  cancelPaymentInstalmentPlanResponseSchema,
  paymentInstalmentPlanParamsSchema,
} from "@atlas/domain/reports/payments-roster.dto";
import { mutatePaymentsRosterMetadata } from "@atlas/domain/reports/payments-roster.route-metadata";
import { cancelPaymentInstalmentPlan } from "@atlas/domain/reports/payments-roster.service";

export const POST = createTenantRoute<
  z.output<typeof cancelPaymentInstalmentPlanBodySchema>,
  z.output<typeof cancelPaymentInstalmentPlanResponseSchema>,
  typeof paymentInstalmentPlanParamsSchema
>({
  metadata: mutatePaymentsRosterMetadata,
  body: cancelPaymentInstalmentPlanBodySchema,
  params: paymentInstalmentPlanParamsSchema,
  output: cancelPaymentInstalmentPlanResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    cancelPaymentInstalmentPlan(tx, ctx, params.planId, input),
});
