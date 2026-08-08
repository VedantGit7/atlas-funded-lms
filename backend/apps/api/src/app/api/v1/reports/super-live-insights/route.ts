import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  superLiveInsightsListQuerySchema,
  superLiveInsightsListResponseSchema,
} from "@atlas/domain/reports/super-live-insights-roster.dto";
import { listSuperLiveInsightsRosterMetadata } from "@atlas/domain/reports/super-live-insights-roster.route-metadata";
import { listSuperLiveInsights } from "@atlas/domain/reports/super-live-insights-roster.service";

export const GET = createTenantRoute<
  z.output<typeof superLiveInsightsListQuerySchema>,
  z.output<typeof superLiveInsightsListResponseSchema>
>({
  metadata: listSuperLiveInsightsRosterMetadata,
  input: superLiveInsightsListQuerySchema,
  output: superLiveInsightsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listSuperLiveInsights(tx, ctx, input),
});
