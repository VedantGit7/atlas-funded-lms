import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  mockTestParamsSchema,
  productEnrollBodySchema,
  productEnrollmentListQuerySchema,
  productEnrollmentListResponseSchema,
  productEnrollmentResponseSchema,
} from "@atlas/domain/learner-products/learner-products.dto";
import {
  enrollMockTestMetadata,
  listProductEnrollmentsMetadata,
} from "@atlas/domain/learner-products/learner-products.route-metadata";
import {
  enrollMockTest,
  listMockTestEnrollments,
} from "@atlas/domain/learner-products/learner-products.service";

export const POST = createTenantRoute<
  z.output<typeof productEnrollBodySchema>,
  z.output<typeof productEnrollmentResponseSchema>,
  typeof mockTestParamsSchema
>({
  metadata: enrollMockTestMetadata,
  params: mockTestParamsSchema,
  body: productEnrollBodySchema,
  output: productEnrollmentResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    enrollMockTest(tx, ctx, params["mockTestId"], input),
});

export const GET = createTenantRoute<
  z.output<typeof productEnrollmentListQuerySchema>,
  z.output<typeof productEnrollmentListResponseSchema>,
  typeof mockTestParamsSchema
>({
  metadata: listProductEnrollmentsMetadata,
  params: mockTestParamsSchema,
  input: productEnrollmentListQuerySchema,
  output: productEnrollmentListResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    listMockTestEnrollments(tx, ctx, params["mockTestId"], input),
});
