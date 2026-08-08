import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  scoreProductQuizzesParamsSchema,
  scoreQuizzesListResponseSchema,
  scoreQuizzesQuerySchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { listProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";
import { listScoreQuizzesForProduct } from "@atlas/domain/reports/progress-score-roster.service";

export const GET = createTenantRoute<
  z.output<typeof scoreQuizzesQuerySchema>,
  z.output<typeof scoreQuizzesListResponseSchema>,
  typeof scoreProductQuizzesParamsSchema
>({
  metadata: listProgressScoreRosterMetadata,
  input: scoreQuizzesQuerySchema,
  params: scoreProductQuizzesParamsSchema,
  output: scoreQuizzesListResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    listScoreQuizzesForProduct(tx, ctx, params.productType, params.productId, input),
});
