import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  productEnrollmentActionBodySchema,
  productEnrollmentActionResponseSchema,
} from "@atlas/domain/learner-products/learner-products.dto";
import { manageProductEnrollmentsMetadata } from "@atlas/domain/learner-products/learner-products.route-metadata";
import { updateProductEnrollments } from "@atlas/domain/learner-products/learner-products.service";

/**
 * Change expiry, revoke, or restore a selection of a product's enrolments.
 *
 * One command endpoint dispatched on `productKind`, matching
 * `/learner-products/status`: the roster acts on a selection, and N requests
 * would make a half-applied change the normal failure mode.
 */
export const POST = createTenantRoute<
  z.output<typeof productEnrollmentActionBodySchema>,
  z.output<typeof productEnrollmentActionResponseSchema>
>({
  metadata: manageProductEnrollmentsMetadata,
  body: productEnrollmentActionBodySchema,
  output: productEnrollmentActionResponseSchema,
  handler: async ({ tx, ctx, input }) => updateProductEnrollments(tx, ctx, input),
});
