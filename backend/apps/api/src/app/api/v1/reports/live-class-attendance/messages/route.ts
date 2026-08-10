import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  sendLiveClassAttendanceMessageBodySchema,
  sendLiveClassAttendanceMessageResponseSchema,
} from "@atlas/domain/reports/live-class-attendance-roster.dto";
import { messageLiveClassAttendanceRosterMetadata } from "@atlas/domain/reports/live-class-attendance-roster.route-metadata";
import { sendLiveClassAttendanceMessage } from "@atlas/api-server/reports/live-class-attendance-roster-actions.service";

export const POST = createTenantRoute<
  z.output<typeof sendLiveClassAttendanceMessageBodySchema>,
  z.output<typeof sendLiveClassAttendanceMessageResponseSchema>
>({
  metadata: messageLiveClassAttendanceRosterMetadata,
  body: sendLiveClassAttendanceMessageBodySchema,
  output: sendLiveClassAttendanceMessageResponseSchema,
  handler: async ({ tx, ctx, input }) => sendLiveClassAttendanceMessage(tx, ctx, input),
});
