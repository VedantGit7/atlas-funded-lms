import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  learnerSubscriptionPlanParamsSchema,
  productEnrollBodySchema,
  productEnrollmentListQuerySchema,
  productEnrollmentListResponseSchema,
  productEnrollmentResponseSchema,
} from "@atlas/domain/learner-products/learner-products.dto";
import {
  enrollLearnerSubscriptionPlanMetadata,
  listProductEnrollmentsMetadata,
} from "@atlas/domain/learner-products/learner-products.route-metadata";
import {
  enrollLearnerSubscriptionPlan,
  listLearnerSubscriptionPlanEnrollments,
} from "@atlas/domain/learner-products/learner-products.service";

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
    enrollLearnerSubscriptionPlan(tx, ctx, params["planId"], input),
});

export const GET = createTenantRoute<
  z.output<typeof productEnrollmentListQuerySchema>,
  z.output<typeof productEnrollmentListResponseSchema>,
  typeof learnerSubscriptionPlanParamsSchema
>({
  metadata: listProductEnrollmentsMetadata,
  params: learnerSubscriptionPlanParamsSchema,
  input: productEnrollmentListQuerySchema,
  output: productEnrollmentListResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    listLearnerSubscriptionPlanEnrollments(tx, ctx, params["planId"], input),
});
