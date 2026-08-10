import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  superLiveInsightsOutliersQuerySchema,
  superLiveInsightsOutliersResponseSchema,
} from "@atlas/domain/reports/super-live-insights-outliers.dto";
import { getSuperLiveInsightsOutliersMetadata } from "@atlas/domain/reports/super-live-insights-outliers.route-metadata";
import { getSuperLiveInsightsOutliers } from "@atlas/domain/reports/super-live-insights-outliers.service";

export const GET = createTenantRoute<
  z.output<typeof superLiveInsightsOutliersQuerySchema>,
  z.output<typeof superLiveInsightsOutliersResponseSchema>
>({
  metadata: getSuperLiveInsightsOutliersMetadata,
  input: superLiveInsightsOutliersQuerySchema,
  output: superLiveInsightsOutliersResponseSchema,
  handler: async ({ tx, ctx, input }) => getSuperLiveInsightsOutliers(tx, ctx, input),
});
