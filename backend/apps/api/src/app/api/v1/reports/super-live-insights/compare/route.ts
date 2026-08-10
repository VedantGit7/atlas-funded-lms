import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  superLiveInsightsCompareQuerySchema,
  superLiveInsightsCompareResponseSchema,
} from "@atlas/domain/reports/super-live-insights-compare.dto";
import { getSuperLiveInsightsCompareMetadata } from "@atlas/domain/reports/super-live-insights-compare.route-metadata";
import { getSuperLiveInsightsCompare } from "@atlas/domain/reports/super-live-insights-compare.service";

export const GET = createTenantRoute<
  z.output<typeof superLiveInsightsCompareQuerySchema>,
  z.output<typeof superLiveInsightsCompareResponseSchema>
>({
  metadata: getSuperLiveInsightsCompareMetadata,
  input: superLiveInsightsCompareQuerySchema,
  output: superLiveInsightsCompareResponseSchema,
  handler: async ({ tx, ctx, input }) => getSuperLiveInsightsCompare(tx, ctx, input),
});
