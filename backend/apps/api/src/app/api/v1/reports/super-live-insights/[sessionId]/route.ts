import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  superLiveInsightDetailResponseSchema,
  superLiveSessionIdParamsSchema,
} from "@atlas/domain/reports/super-live-insights-roster.dto";
import { listSuperLiveInsightsRosterMetadata } from "@atlas/domain/reports/super-live-insights-roster.route-metadata";
import { getSuperLiveInsightDetail } from "@atlas/domain/reports/super-live-insights-roster.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof superLiveInsightDetailResponseSchema>,
  typeof superLiveSessionIdParamsSchema
>({
  metadata: listSuperLiveInsightsRosterMetadata,
  input: noBodySchema,
  params: superLiveSessionIdParamsSchema,
  output: superLiveInsightDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getSuperLiveInsightDetail(tx, ctx, params["sessionId"]),
});
