import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  progressProductTypeParamsSchema,
  progressProductsListResponseSchema,
  progressProductsQuerySchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { listProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";
import { listProgressProducts } from "@atlas/domain/reports/progress-score-roster.service";

export const GET = createTenantRoute<
  z.output<typeof progressProductsQuerySchema>,
  z.output<typeof progressProductsListResponseSchema>,
  typeof progressProductTypeParamsSchema
>({
  metadata: listProgressScoreRosterMetadata,
  input: progressProductsQuerySchema,
  params: progressProductTypeParamsSchema,
  output: progressProductsListResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    listProgressProducts(tx, ctx, params["productType"], input),
});
