import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  mockTestParamsSchema,
  replaceMockTestContentsBodySchema,
  mockTestResponseSchema,
} from "@atlas/domain/learner-products/learner-products.dto";
import { replaceLearnerProductContentsMetadata } from "@atlas/domain/learner-products/learner-products.route-metadata";
import { replaceMockTestContents } from "@atlas/domain/learner-products/learner-products.service";

/**
 * Replace what this product contains.
 *
 * `PUT`, not `PATCH`: the body is the complete ordered list, because a partial
 * update of an ordered collection has no unambiguous meaning — "move item 3 to
 * the front" and "remove item 3" are the same diff from the server's side.
 */
export const PUT = createTenantRoute<
  z.output<typeof replaceMockTestContentsBodySchema>,
  z.output<typeof mockTestResponseSchema>,
  typeof mockTestParamsSchema
>({
  metadata: replaceLearnerProductContentsMetadata,
  params: mockTestParamsSchema,
  body: replaceMockTestContentsBodySchema,
  output: mockTestResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    replaceMockTestContents(tx, ctx, params["mockTestId"], input),
});
