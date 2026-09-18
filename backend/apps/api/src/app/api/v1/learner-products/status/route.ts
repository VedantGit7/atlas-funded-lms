import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  learnerProductStatusResponseSchema,
  updateLearnerProductStatusBodySchema,
} from "@atlas/domain/learner-products/learner-products.dto";
import { updateLearnerProductStatusMetadata } from "@atlas/domain/learner-products/learner-products.route-metadata";
import { updateLearnerProductStatuses } from "@atlas/domain/learner-products/learner-products.service";

/**
 * Publish, archive or draft a set of catalogue products in one transaction.
 *
 * `POST` rather than `PATCH` on each product: the operation acts on a selection
 * the client chooses, not on one addressable resource, and splitting it into N
 * requests would make a partially-published catalogue the normal failure mode.
 */
export const POST = createTenantRoute<
  z.output<typeof updateLearnerProductStatusBodySchema>,
  z.output<typeof learnerProductStatusResponseSchema>
>({
  metadata: updateLearnerProductStatusMetadata,
  body: updateLearnerProductStatusBodySchema,
  output: learnerProductStatusResponseSchema,
  handler: async ({ tx, ctx, input }) => updateLearnerProductStatuses(tx, ctx, input),
});
