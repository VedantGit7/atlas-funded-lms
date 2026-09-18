import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  mockTestParamsSchema,
  mockTestResponseSchema,
} from "@atlas/domain/learner-products/learner-products.dto";
import { getLearnerProductMetadata } from "@atlas/domain/learner-products/learner-products.route-metadata";
import { getMockTest } from "@atlas/domain/learner-products/learner-products.service";

/**
 * One product, with its contents resolved to titles.
 *
 * The service behind this existed from the start and no route exposed it, so
 * the console could list products and enrol learners into them but never open
 * one.
 */
export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof mockTestResponseSchema>,
  typeof mockTestParamsSchema
>({
  metadata: getLearnerProductMetadata,
  params: mockTestParamsSchema,
  output: mockTestResponseSchema,
  handler: async ({ tx, ctx, params }) => getMockTest(tx, ctx, params["mockTestId"]),
});
