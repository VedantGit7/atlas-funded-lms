import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  zoomParticipantDetailResponseSchema,
  zoomParticipantMatchBodySchema,
  zoomParticipantMatchResponseSchema,
  zoomParticipantParamsSchema,
} from "@atlas/domain/reports/zoom-insights-roster.dto";
import {
  listZoomInsightsRosterMetadata,
  mutateZoomInsightsRosterMetadata,
} from "@atlas/domain/reports/zoom-insights-roster.route-metadata";
import {
  getZoomMeetingParticipantDetail,
  mutateZoomMeetingParticipantMatch,
} from "@atlas/domain/reports/zoom-insights-roster.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof zoomParticipantDetailResponseSchema>,
  typeof zoomParticipantParamsSchema
>({
  metadata: listZoomInsightsRosterMetadata,
  input: noBodySchema,
  params: zoomParticipantParamsSchema,
  output: zoomParticipantDetailResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    getZoomMeetingParticipantDetail(tx, ctx, params["meetingId"], params["participantId"]),
});

export const PATCH = createTenantRoute<
  z.output<typeof zoomParticipantMatchBodySchema>,
  z.output<typeof zoomParticipantMatchResponseSchema>,
  typeof zoomParticipantParamsSchema
>({
  metadata: mutateZoomInsightsRosterMetadata,
  params: zoomParticipantParamsSchema,
  input: zoomParticipantMatchBodySchema,
  output: zoomParticipantMatchResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    mutateZoomMeetingParticipantMatch(tx, ctx, params["meetingId"], params["participantId"], input),
});
