import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  productEnrollBodySchema,
  productEnrollmentListQuerySchema,
  productEnrollmentListResponseSchema,
  productEnrollmentResponseSchema,
  testSeriesParamsSchema,
} from "@atlas/domain/learner-products/learner-products.dto";
import {
  enrollTestSeriesMetadata,
  listProductEnrollmentsMetadata,
} from "@atlas/domain/learner-products/learner-products.route-metadata";
import {
  enrollTestSeries,
  listTestSeriesEnrollments,
} from "@atlas/domain/learner-products/learner-products.service";

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
    enrollTestSeries(tx, ctx, params["testSeriesId"], input),
});

export const GET = createTenantRoute<
  z.output<typeof productEnrollmentListQuerySchema>,
  z.output<typeof productEnrollmentListResponseSchema>,
  typeof testSeriesParamsSchema
>({
  metadata: listProductEnrollmentsMetadata,
  params: testSeriesParamsSchema,
  input: productEnrollmentListQuerySchema,
  output: productEnrollmentListResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    listTestSeriesEnrollments(tx, ctx, params["testSeriesId"], input),
});
