import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  productEnrollBodySchema,
  productEnrollmentResponseSchema,
  testSeriesParamsSchema,
} from "@atlas/domain/learner-products/learner-products.dto";
import { enrollTestSeriesMetadata } from "@atlas/domain/learner-products/learner-products.route-metadata";
import { enrollTestSeries } from "@atlas/domain/learner-products/learner-products.service";

export const POST = createTenantRoute<
  z.output<typeof productEnrollBodySchema>,
  z.output<typeof productEnrollmentResponseSchema>,
  typeof testSeriesParamsSchema
>({
  metadata: enrollTestSeriesMetadata,
  params: testSeriesParamsSchema,
  body: productEnrollBodySchema,
  output: productEnrollmentResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    enrollTestSeries(tx, ctx, params.testSeriesId, input),
});
