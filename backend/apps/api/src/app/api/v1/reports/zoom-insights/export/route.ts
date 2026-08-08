import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  exportZoomInsightsRosterBodySchema,
  exportZoomInsightsRosterResponseSchema,
} from "@atlas/domain/reports/zoom-insights-roster.dto";
import { exportZoomInsightsRosterMetadata } from "@atlas/domain/reports/zoom-insights-roster.route-metadata";
import { exportZoomInsightsRoster } from "../../../../../../../server/reports/zoom-insights-roster-actions.service";

export const POST = createTenantRoute<
  z.output<typeof exportZoomInsightsRosterBodySchema>,
  z.output<typeof exportZoomInsightsRosterResponseSchema>
>({
  metadata: exportZoomInsightsRosterMetadata,
  body: exportZoomInsightsRosterBodySchema,
  output: exportZoomInsightsRosterResponseSchema,
  handler: async ({ tx, ctx, input }) => exportZoomInsightsRoster(tx, ctx, input),
});
