import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  bundleParamsSchema,
  productEnrollBodySchema,
  productEnrollmentResponseSchema,
} from "@atlas/domain/learner-products/learner-products.dto";
import { enrollBundleMetadata } from "@atlas/domain/learner-products/learner-products.route-metadata";
import { enrollBundle } from "@atlas/domain/learner-products/learner-products.service";

export const POST = createTenantRoute<
  z.output<typeof productEnrollBodySchema>,
  z.output<typeof productEnrollmentResponseSchema>,
  typeof bundleParamsSchema
>({
  metadata: enrollBundleMetadata,
  params: bundleParamsSchema,
  body: productEnrollBodySchema,
  output: productEnrollmentResponseSchema,
  handler: async ({ tx, ctx, params, input }) => enrollBundle(tx, ctx, params.bundleId, input),
});
