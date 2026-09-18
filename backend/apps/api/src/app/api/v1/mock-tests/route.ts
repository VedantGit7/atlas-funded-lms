import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createMockTestBodySchema,
  learnerProductListQuerySchema,
  mockTestListResponseSchema,
  mockTestResponseSchema,
} from "@atlas/domain/learner-products/learner-products.dto";
import {
  createMockTestMetadata,
  listMockTestsMetadata,
} from "@atlas/domain/learner-products/learner-products.route-metadata";
import {
  createMockTest,
  listMockTests,
} from "@atlas/domain/learner-products/learner-products.service";

export const GET = createTenantRoute<
  z.output<typeof learnerProductListQuerySchema>,
  z.output<typeof mockTestListResponseSchema>
>({
  metadata: listMockTestsMetadata,
  input: learnerProductListQuerySchema,
  output: mockTestListResponseSchema,
  handler: async ({ tx, ctx, input }) => listMockTests(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof createMockTestBodySchema>,
  z.output<typeof mockTestResponseSchema>
>({
  metadata: createMockTestMetadata,
  body: createMockTestBodySchema,
  output: mockTestResponseSchema,
  handler: async ({ tx, ctx, input }) => createMockTest(tx, ctx, input),
});
