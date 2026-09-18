import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  testSeriesParamsSchema,
  replaceTestSeriesContentsBodySchema,
  testSeriesResponseSchema,
} from "@atlas/domain/learner-products/learner-products.dto";
import { replaceLearnerProductContentsMetadata } from "@atlas/domain/learner-products/learner-products.route-metadata";
import { replaceTestSeriesContents } from "@atlas/domain/learner-products/learner-products.service";

/**
 * Replace what this product contains.
 *
 * `PUT`, not `PATCH`: the body is the complete ordered list, because a partial
 * update of an ordered collection has no unambiguous meaning — "move item 3 to
 * the front" and "remove item 3" are the same diff from the server's side.
 */
export const PUT = createTenantRoute<
  z.output<typeof replaceTestSeriesContentsBodySchema>,
  z.output<typeof testSeriesResponseSchema>,
  typeof testSeriesParamsSchema
>({
  metadata: replaceLearnerProductContentsMetadata,
  params: testSeriesParamsSchema,
  body: replaceTestSeriesContentsBodySchema,
  output: testSeriesResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    replaceTestSeriesContents(tx, ctx, params["testSeriesId"], input),
});
