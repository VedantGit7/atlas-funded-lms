import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  progressLearnersListResponseSchema,
  progressLearnersQuerySchema,
  progressProductLearnersParamsSchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { listProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";
import { listProgressLearnersForProduct } from "@atlas/domain/reports/progress-score-roster.service";

export const GET = createTenantRoute<
  z.output<typeof progressLearnersQuerySchema>,
  z.output<typeof progressLearnersListResponseSchema>,
  typeof progressProductLearnersParamsSchema
>({
  metadata: listProgressScoreRosterMetadata,
  input: progressLearnersQuerySchema,
  params: progressProductLearnersParamsSchema,
  output: progressLearnersListResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    listProgressLearnersForProduct(tx, ctx, params["productType"], params["productId"], input),
});
