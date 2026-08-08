import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  exportLiveClassAttendanceRosterBodySchema,
  exportLiveClassAttendanceRosterResponseSchema,
} from "@atlas/domain/reports/live-class-attendance-roster.dto";
import { exportLiveClassAttendanceRosterMetadata } from "@atlas/domain/reports/live-class-attendance-roster.route-metadata";
import { exportLiveClassAttendanceRoster } from "@atlas/api-server/reports/live-class-attendance-roster-actions.service";

export const POST = createTenantRoute<
  z.output<typeof exportLiveClassAttendanceRosterBodySchema>,
  z.output<typeof exportLiveClassAttendanceRosterResponseSchema>
>({
  metadata: exportLiveClassAttendanceRosterMetadata,
  body: exportLiveClassAttendanceRosterBodySchema,
  output: exportLiveClassAttendanceRosterResponseSchema,
  handler: async ({ tx, ctx, input }) => exportLiveClassAttendanceRoster(tx, ctx, input),
});
