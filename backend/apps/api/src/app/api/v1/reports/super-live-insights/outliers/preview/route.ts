import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  superLiveInsightsOutliersPreviewQuerySchema,
  superLiveInsightsOutliersPreviewResponseSchema,
} from "@atlas/domain/reports/super-live-insights-outliers.dto";
import { previewSuperLiveInsightsOutliersMetadata } from "@atlas/domain/reports/super-live-insights-outliers.route-metadata";
import { previewSuperLiveInsightsOutliers } from "@atlas/domain/reports/super-live-insights-outliers.service";

export const GET = createTenantRoute<
  z.output<typeof superLiveInsightsOutliersPreviewQuerySchema>,
  z.output<typeof superLiveInsightsOutliersPreviewResponseSchema>
>({
  metadata: previewSuperLiveInsightsOutliersMetadata,
  input: superLiveInsightsOutliersPreviewQuerySchema,
  output: superLiveInsightsOutliersPreviewResponseSchema,
  handler: async ({ tx, ctx, input }) => previewSuperLiveInsightsOutliers(tx, ctx, input),
});
