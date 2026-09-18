import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  testSeriesParamsSchema,
  testSeriesResponseSchema,
} from "@atlas/domain/learner-products/learner-products.dto";
import { getLearnerProductMetadata } from "@atlas/domain/learner-products/learner-products.route-metadata";
import { getTestSeries } from "@atlas/domain/learner-products/learner-products.service";

/**
 * One product, with its contents resolved to titles.
 *
 * The service behind this existed from the start and no route exposed it, so
 * the console could list products and enrol learners into them but never open
 * one.
 */
export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof testSeriesResponseSchema>,
  typeof testSeriesParamsSchema
>({
  metadata: getLearnerProductMetadata,
  params: testSeriesParamsSchema,
  output: testSeriesResponseSchema,
  handler: async ({ tx, ctx, params }) => getTestSeries(tx, ctx, params["testSeriesId"]),
});
