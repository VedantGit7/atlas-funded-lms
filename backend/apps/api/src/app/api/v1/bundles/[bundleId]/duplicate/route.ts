import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  duplicateLearnerProductBodySchema,
  bundleParamsSchema,
  bundleResponseSchema,
} from "@atlas/domain/learner-products/learner-products.dto";
import { duplicateLearnerProductMetadata } from "@atlas/domain/learner-products/learner-products.route-metadata";
import { duplicateBundle } from "@atlas/domain/learner-products/learner-products.service";

/**
 * Clone this product into a new DRAFT row.
 *
 * Items come across; enrolments deliberately do not. An enrolment belongs to
 * the product a learner was actually placed into, and copying it would grant
 * access to something nobody agreed to.
 */
export const POST = createTenantRoute<
  z.output<typeof duplicateLearnerProductBodySchema>,
  z.output<typeof bundleResponseSchema>,
  typeof bundleParamsSchema
>({
  metadata: duplicateLearnerProductMetadata,
  params: bundleParamsSchema,
  body: duplicateLearnerProductBodySchema,
  output: bundleResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    duplicateBundle(tx, ctx, params["bundleId"], input),
});
