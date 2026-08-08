import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  exportSuperLiveInsightsRosterBodySchema,
  exportSuperLiveInsightsRosterResponseSchema,
} from "@atlas/domain/reports/super-live-insights-roster.dto";
import { exportSuperLiveInsightsRosterMetadata } from "@atlas/domain/reports/super-live-insights-roster.route-metadata";
import { exportSuperLiveInsightsRoster } from "@atlas/api-server/reports/super-live-insights-roster-actions.service";

export const POST = createTenantRoute<
  z.output<typeof exportSuperLiveInsightsRosterBodySchema>,
  z.output<typeof exportSuperLiveInsightsRosterResponseSchema>
>({
  metadata: exportSuperLiveInsightsRosterMetadata,
  body: exportSuperLiveInsightsRosterBodySchema,
  output: exportSuperLiveInsightsRosterResponseSchema,
  handler: async ({ tx, ctx, input }) => exportSuperLiveInsightsRoster(tx, ctx, input),
});
