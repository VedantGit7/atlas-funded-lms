import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  zoomMeetingIdParamsSchema,
  zoomParticipantsListResponseSchema,
  zoomParticipantsQuerySchema,
} from "@atlas/domain/reports/zoom-insights-roster.dto";
import { listZoomInsightsRosterMetadata } from "@atlas/domain/reports/zoom-insights-roster.route-metadata";
import { listZoomMeetingParticipants } from "@atlas/domain/reports/zoom-insights-roster.service";

export const GET = createTenantRoute<
  z.output<typeof zoomParticipantsQuerySchema>,
  z.output<typeof zoomParticipantsListResponseSchema>,
  typeof zoomMeetingIdParamsSchema
>({
  metadata: listZoomInsightsRosterMetadata,
  input: zoomParticipantsQuerySchema,
  params: zoomMeetingIdParamsSchema,
  output: zoomParticipantsListResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    listZoomMeetingParticipants(tx, ctx, params.meetingId, input),
});
