import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createLearnerSubscriptionPlanBodySchema,
  learnerProductListQuerySchema,
  learnerSubscriptionPlanListResponseSchema,
  learnerSubscriptionPlanResponseSchema,
} from "@atlas/domain/learner-products/learner-products.dto";
import {
  createLearnerSubscriptionPlanMetadata,
  listLearnerSubscriptionPlansMetadata,
} from "@atlas/domain/learner-products/learner-products.route-metadata";
import {
  createLearnerSubscriptionPlan,
  listLearnerSubscriptionPlans,
} from "@atlas/domain/learner-products/learner-products.service";

export const GET = createTenantRoute<
  z.output<typeof learnerProductListQuerySchema>,
  z.output<typeof learnerSubscriptionPlanListResponseSchema>
>({
  metadata: listLearnerSubscriptionPlansMetadata,
  input: learnerProductListQuerySchema,
  output: learnerSubscriptionPlanListResponseSchema,
  handler: async ({ tx, ctx, input }) => listLearnerSubscriptionPlans(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof createLearnerSubscriptionPlanBodySchema>,
  z.output<typeof learnerSubscriptionPlanResponseSchema>
>({
  metadata: createLearnerSubscriptionPlanMetadata,
  body: createLearnerSubscriptionPlanBodySchema,
  output: learnerSubscriptionPlanResponseSchema,
  handler: async ({ tx, ctx, input }) => createLearnerSubscriptionPlan(tx, ctx, input),
});
