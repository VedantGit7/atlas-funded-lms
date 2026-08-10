import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  superLiveInsightsTrendsQuerySchema,
  superLiveInsightsTrendsResponseSchema,
} from "@atlas/domain/reports/super-live-insights-trends.dto";
import { getSuperLiveInsightsTrendsMetadata } from "@atlas/domain/reports/super-live-insights-trends.route-metadata";
import { getSuperLiveInsightsTrends } from "@atlas/domain/reports/super-live-insights-trends.service";

export const GET = createTenantRoute<
  z.output<typeof superLiveInsightsTrendsQuerySchema>,
  z.output<typeof superLiveInsightsTrendsResponseSchema>
>({
  metadata: getSuperLiveInsightsTrendsMetadata,
  input: superLiveInsightsTrendsQuerySchema,
  output: superLiveInsightsTrendsResponseSchema,
  handler: async ({ tx, ctx, input }) => getSuperLiveInsightsTrends(tx, ctx, input),
});
