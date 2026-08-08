import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  liveAttendeesListResponseSchema,
  liveAttendeesQuerySchema,
  liveSessionIdParamsSchema,
} from "@atlas/domain/reports/live-class-attendance-roster.dto";
import { listLiveClassAttendanceRosterMetadata } from "@atlas/domain/reports/live-class-attendance-roster.route-metadata";
import { listLiveClassSessionAttendees } from "@atlas/domain/reports/live-class-attendance-roster.service";

export const GET = createTenantRoute<
  z.output<typeof liveAttendeesQuerySchema>,
  z.output<typeof liveAttendeesListResponseSchema>,
  typeof liveSessionIdParamsSchema
>({
  metadata: listLiveClassAttendanceRosterMetadata,
  input: liveAttendeesQuerySchema,
  params: liveSessionIdParamsSchema,
  output: liveAttendeesListResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    listLiveClassSessionAttendees(tx, ctx, params.sessionId, input),
});
