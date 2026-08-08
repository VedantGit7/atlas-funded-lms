import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  zoomMeetingDetailResponseSchema,
  zoomMeetingIdParamsSchema,
} from "@atlas/domain/reports/zoom-insights-roster.dto";
import { listZoomInsightsRosterMetadata } from "@atlas/domain/reports/zoom-insights-roster.route-metadata";
import { getZoomMeetingDetailedReport } from "@atlas/domain/reports/zoom-insights-roster.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof zoomMeetingDetailResponseSchema>,
  typeof zoomMeetingIdParamsSchema
>({
  metadata: listZoomInsightsRosterMetadata,
  input: noBodySchema,
  params: zoomMeetingIdParamsSchema,
  output: zoomMeetingDetailResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    getZoomMeetingDetailedReport(tx, ctx, params.meetingId),
});
