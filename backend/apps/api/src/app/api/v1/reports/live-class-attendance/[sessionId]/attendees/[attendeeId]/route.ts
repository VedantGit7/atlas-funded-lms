import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  liveAttendeeDetailResponseSchema,
  liveClassAttendeeParamsSchema,
  updateLiveClassAttendeeStatusBodySchema,
  updateLiveClassAttendeeStatusResponseSchema,
} from "@atlas/domain/reports/live-class-attendance-roster.dto";
import {
  listLiveClassAttendanceRosterMetadata,
  mutateLiveClassAttendanceRosterMetadata,
} from "@atlas/domain/reports/live-class-attendance-roster.route-metadata";
import {
  getLiveClassAttendeeDetail,
  updateLiveClassAttendeeStatus,
} from "@atlas/domain/reports/live-class-attendance-roster.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof liveAttendeeDetailResponseSchema>,
  typeof liveClassAttendeeParamsSchema
>({
  metadata: listLiveClassAttendanceRosterMetadata,
  input: noBodySchema,
  params: liveClassAttendeeParamsSchema,
  output: liveAttendeeDetailResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    getLiveClassAttendeeDetail(tx, ctx, params["sessionId"], params["attendeeId"]),
});

export const PATCH = createTenantRoute<
  z.output<typeof updateLiveClassAttendeeStatusBodySchema>,
  z.output<typeof updateLiveClassAttendeeStatusResponseSchema>,
  typeof liveClassAttendeeParamsSchema
>({
  metadata: mutateLiveClassAttendanceRosterMetadata,
  params: liveClassAttendeeParamsSchema,
  input: updateLiveClassAttendeeStatusBodySchema,
  output: updateLiveClassAttendeeStatusResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateLiveClassAttendeeStatus(tx, ctx, params["sessionId"], params["attendeeId"], input),
});
