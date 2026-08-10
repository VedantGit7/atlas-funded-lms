import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  zoomPersonMeetingsQuerySchema,
  zoomPersonMeetingsResponseSchema,
} from "@atlas/domain/reports/zoom-insights-roster.dto";
import { listZoomInsightsRosterMetadata } from "@atlas/domain/reports/zoom-insights-roster.route-metadata";
import { getZoomPersonMeetings } from "@atlas/domain/reports/zoom-insights-roster.service";

export const GET = createTenantRoute<
  z.output<typeof zoomPersonMeetingsQuerySchema>,
  z.output<typeof zoomPersonMeetingsResponseSchema>
>({
  metadata: listZoomInsightsRosterMetadata,
  input: zoomPersonMeetingsQuerySchema,
  output: zoomPersonMeetingsResponseSchema,
  handler: async ({ tx, ctx, input }) => getZoomPersonMeetings(tx, ctx, input),
});
