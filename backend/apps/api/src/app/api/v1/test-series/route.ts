import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createTestSeriesBodySchema,
  learnerProductListQuerySchema,
  testSeriesListResponseSchema,
  testSeriesResponseSchema,
} from "@atlas/domain/learner-products/learner-products.dto";
import {
  createTestSeriesMetadata,
  listTestSeriesMetadata,
} from "@atlas/domain/learner-products/learner-products.route-metadata";
import {
  createTestSeries,
  listTestSeries,
} from "@atlas/domain/learner-products/learner-products.service";

export const GET = createTenantRoute<
  z.output<typeof learnerProductListQuerySchema>,
  z.output<typeof testSeriesListResponseSchema>
>({
  metadata: listTestSeriesMetadata,
  input: learnerProductListQuerySchema,
  output: testSeriesListResponseSchema,
  handler: async ({ tx, ctx, input }) => listTestSeries(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof createTestSeriesBodySchema>,
  z.output<typeof testSeriesResponseSchema>
>({
  metadata: createTestSeriesMetadata,
  body: createTestSeriesBodySchema,
  output: testSeriesResponseSchema,
  handler: async ({ tx, ctx, input }) => createTestSeries(tx, ctx, input),
});
