import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  mockTestParamsSchema,
  productEnrollBodySchema,
  productEnrollmentResponseSchema,
} from "@atlas/domain/learner-products/learner-products.dto";
import { enrollMockTestMetadata } from "@atlas/domain/learner-products/learner-products.route-metadata";
import { enrollMockTest } from "@atlas/domain/learner-products/learner-products.service";

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
    enrollMockTest(tx, ctx, params.mockTestId, input),
});
