import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  scoreProductTypeParamsSchema,
  scoreProductsListResponseSchema,
  scoreProductsQuerySchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { listProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";
import { listScoreProducts } from "@atlas/domain/reports/progress-score-roster.service";

export const GET = createTenantRoute<
  z.output<typeof scoreProductsQuerySchema>,
  z.output<typeof scoreProductsListResponseSchema>,
  typeof scoreProductTypeParamsSchema
>({
  metadata: listProgressScoreRosterMetadata,
  input: scoreProductsQuerySchema,
  params: scoreProductTypeParamsSchema,
  output: scoreProductsListResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    listScoreProducts(tx, ctx, params.productType, input),
});
