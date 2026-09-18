import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  learnerSubscriptionPlanParamsSchema,
  replaceSubscriptionPlanContentsBodySchema,
  learnerSubscriptionPlanResponseSchema,
} from "@atlas/domain/learner-products/learner-products.dto";
import { replaceLearnerProductContentsMetadata } from "@atlas/domain/learner-products/learner-products.route-metadata";
import { replaceSubscriptionPlanContents } from "@atlas/domain/learner-products/learner-products.service";

/**
 * Replace what this product contains.
 *
 * `PUT`, not `PATCH`: the body is the complete ordered list, because a partial
 * update of an ordered collection has no unambiguous meaning — "move item 3 to
 * the front" and "remove item 3" are the same diff from the server's side.
 */
export const PUT = createTenantRoute<
  z.output<typeof replaceSubscriptionPlanContentsBodySchema>,
  z.output<typeof learnerSubscriptionPlanResponseSchema>,
  typeof learnerSubscriptionPlanParamsSchema
>({
  metadata: replaceLearnerProductContentsMetadata,
  params: learnerSubscriptionPlanParamsSchema,
  body: replaceSubscriptionPlanContentsBodySchema,
  output: learnerSubscriptionPlanResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    replaceSubscriptionPlanContents(tx, ctx, params["planId"], input),
});
