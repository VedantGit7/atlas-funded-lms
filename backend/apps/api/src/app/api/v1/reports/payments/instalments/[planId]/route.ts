import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  paymentInstalmentPlanDetailResponseSchema,
  paymentInstalmentPlanParamsSchema,
} from "@atlas/domain/reports/payments-roster.dto";
import { listPaymentsRosterMetadata } from "@atlas/domain/reports/payments-roster.route-metadata";
import { getPaymentInstalmentPlanDetail } from "@atlas/domain/reports/payments-roster.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof paymentInstalmentPlanDetailResponseSchema>,
  typeof paymentInstalmentPlanParamsSchema
>({
  metadata: listPaymentsRosterMetadata,
  params: paymentInstalmentPlanParamsSchema,
  output: paymentInstalmentPlanDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getPaymentInstalmentPlanDetail(tx, ctx, params["planId"]),
});
