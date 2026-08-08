import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  zoomMeetingsListQuerySchema,
  zoomMeetingsListResponseSchema,
} from "@atlas/domain/reports/zoom-insights-roster.dto";
import { listZoomInsightsRosterMetadata } from "@atlas/domain/reports/zoom-insights-roster.route-metadata";
import { listZoomInsightsMeetings } from "@atlas/domain/reports/zoom-insights-roster.service";

export const GET = createTenantRoute<
  z.output<typeof zoomMeetingsListQuerySchema>,
  z.output<typeof zoomMeetingsListResponseSchema>
>({
  metadata: listZoomInsightsRosterMetadata,
  input: zoomMeetingsListQuerySchema,
  output: zoomMeetingsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listZoomInsightsMeetings(tx, ctx, input),
});
