import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  liveClassSessionIdParamsSchema,
  liveClassSessionLiveMonitorResponseSchema,
} from "@atlas/domain/reports/live-class-attendance-roster.dto";
import { listLiveClassAttendanceRosterMetadata } from "@atlas/domain/reports/live-class-attendance-roster.route-metadata";
import { getLiveClassSessionLiveMonitor } from "@atlas/domain/reports/live-class-attendance-roster.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof liveClassSessionLiveMonitorResponseSchema>,
  typeof liveClassSessionIdParamsSchema
>({
  metadata: listLiveClassAttendanceRosterMetadata,
  input: noBodySchema,
  params: liveClassSessionIdParamsSchema,
  output: liveClassSessionLiveMonitorResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    getLiveClassSessionLiveMonitor(tx, ctx, params["sessionId"]),
});
