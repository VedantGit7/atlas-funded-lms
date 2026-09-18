import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  duplicateLearnerProductBodySchema,
  learnerSubscriptionPlanParamsSchema,
  learnerSubscriptionPlanResponseSchema,
} from "@atlas/domain/learner-products/learner-products.dto";
import { duplicateLearnerProductMetadata } from "@atlas/domain/learner-products/learner-products.route-metadata";
import { duplicateLearnerSubscriptionPlan } from "@atlas/domain/learner-products/learner-products.service";

/**
 * Clone this product into a new DRAFT row.
 *
 * Items come across; enrolments deliberately do not. An enrolment belongs to
 * the product a learner was actually placed into, and copying it would grant
 * access to something nobody agreed to.
 */
export const POST = createTenantRoute<
  z.output<typeof duplicateLearnerProductBodySchema>,
  z.output<typeof learnerSubscriptionPlanResponseSchema>,
  typeof learnerSubscriptionPlanParamsSchema
>({
  metadata: duplicateLearnerProductMetadata,
  params: learnerSubscriptionPlanParamsSchema,
  body: duplicateLearnerProductBodySchema,
  output: learnerSubscriptionPlanResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    duplicateLearnerSubscriptionPlan(tx, ctx, params["planId"], input),
});
