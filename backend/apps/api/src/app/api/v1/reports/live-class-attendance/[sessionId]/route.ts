import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  liveSessionDetailResponseSchema,
  liveSessionIdParamsSchema,
} from "@atlas/domain/reports/live-class-attendance-roster.dto";
import { listLiveClassAttendanceRosterMetadata } from "@atlas/domain/reports/live-class-attendance-roster.route-metadata";
import { getLiveClassSessionDetailedReport } from "@atlas/domain/reports/live-class-attendance-roster.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof liveSessionDetailResponseSchema>,
  typeof liveSessionIdParamsSchema
>({
  metadata: listLiveClassAttendanceRosterMetadata,
  input: noBodySchema,
  params: liveSessionIdParamsSchema,
  output: liveSessionDetailResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    getLiveClassSessionDetailedReport(tx, ctx, params.sessionId),
});
