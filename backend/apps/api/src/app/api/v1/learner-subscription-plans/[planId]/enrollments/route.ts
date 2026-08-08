import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  learnerSubscriptionPlanParamsSchema,
  productEnrollBodySchema,
  productEnrollmentResponseSchema,
} from "@atlas/domain/learner-products/learner-products.dto";
import { enrollLearnerSubscriptionPlanMetadata } from "@atlas/domain/learner-products/learner-products.route-metadata";
import { enrollLearnerSubscriptionPlan } from "@atlas/domain/learner-products/learner-products.service";

export const POST = createTenantRoute<
  z.output<typeof productEnrollBodySchema>,
  z.output<typeof productEnrollmentResponseSchema>,
  typeof learnerSubscriptionPlanParamsSchema
>({
  metadata: enrollLearnerSubscriptionPlanMetadata,
  params: learnerSubscriptionPlanParamsSchema,
  body: productEnrollBodySchema,
  output: productEnrollmentResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    enrollLearnerSubscriptionPlan(tx, ctx, params.planId, input),
});
