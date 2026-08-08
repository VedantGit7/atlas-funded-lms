import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createPaymentInstalmentPlanBodySchema,
  createPaymentInstalmentPlanResponseSchema,
  paymentInstalmentsListResponseSchema,
  paymentInstalmentsQuerySchema,
} from "@atlas/domain/reports/payments-roster.dto";
import {
  listPaymentsRosterMetadata,
  mutatePaymentsRosterMetadata,
} from "@atlas/domain/reports/payments-roster.route-metadata";
import {
  createPaymentInstalmentPlan,
  listPaymentInstalmentPlans,
} from "@atlas/domain/reports/payments-roster.service";

export const GET = createTenantRoute<
  z.output<typeof paymentInstalmentsQuerySchema>,
  z.output<typeof paymentInstalmentsListResponseSchema>
>({
  metadata: listPaymentsRosterMetadata,
  input: paymentInstalmentsQuerySchema,
  output: paymentInstalmentsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listPaymentInstalmentPlans(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof createPaymentInstalmentPlanBodySchema>,
  z.output<typeof createPaymentInstalmentPlanResponseSchema>
>({
  metadata: mutatePaymentsRosterMetadata,
  body: createPaymentInstalmentPlanBodySchema,
  output: createPaymentInstalmentPlanResponseSchema,
  handler: async ({ tx, ctx, input }) => createPaymentInstalmentPlan(tx, ctx, input),
});
