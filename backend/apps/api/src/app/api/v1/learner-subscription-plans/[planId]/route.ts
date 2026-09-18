import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  learnerSubscriptionPlanParamsSchema,
  learnerSubscriptionPlanResponseSchema,
} from "@atlas/domain/learner-products/learner-products.dto";
import { getLearnerProductMetadata } from "@atlas/domain/learner-products/learner-products.route-metadata";
import { getLearnerSubscriptionPlan } from "@atlas/domain/learner-products/learner-products.service";

/**
 * One product, with its contents resolved to titles.
 *
 * The service behind this existed from the start and no route exposed it, so
 * the console could list products and enrol learners into them but never open
 * one.
 */
export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof learnerSubscriptionPlanResponseSchema>,
  typeof learnerSubscriptionPlanParamsSchema
>({
  metadata: getLearnerProductMetadata,
  params: learnerSubscriptionPlanParamsSchema,
  output: learnerSubscriptionPlanResponseSchema,
  handler: async ({ tx, ctx, params }) => getLearnerSubscriptionPlan(tx, ctx, params["planId"]),
});
