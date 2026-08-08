import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  liveSessionsListQuerySchema,
  liveSessionsListResponseSchema,
} from "@atlas/domain/reports/live-class-attendance-roster.dto";
import { listLiveClassAttendanceRosterMetadata } from "@atlas/domain/reports/live-class-attendance-roster.route-metadata";
import { listLiveClassAttendanceSessions } from "@atlas/domain/reports/live-class-attendance-roster.service";

export const GET = createTenantRoute<
  z.output<typeof liveSessionsListQuerySchema>,
  z.output<typeof liveSessionsListResponseSchema>
>({
  metadata: listLiveClassAttendanceRosterMetadata,
  input: liveSessionsListQuerySchema,
  output: liveSessionsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listLiveClassAttendanceSessions(tx, ctx, input),
});
