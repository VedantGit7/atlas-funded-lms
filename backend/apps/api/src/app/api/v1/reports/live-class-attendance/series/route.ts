import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  liveSeriesListQuerySchema,
  liveSeriesListResponseSchema,
} from "@atlas/domain/reports/live-class-attendance-roster.dto";
import { listLiveClassAttendanceRosterMetadata } from "@atlas/domain/reports/live-class-attendance-roster.route-metadata";
import { listLiveClassAttendanceSeries } from "@atlas/domain/reports/live-class-attendance-roster.service";

export const GET = createTenantRoute<
  z.output<typeof liveSeriesListQuerySchema>,
  z.output<typeof liveSeriesListResponseSchema>
>({
  metadata: listLiveClassAttendanceRosterMetadata,
  input: liveSeriesListQuerySchema,
  output: liveSeriesListResponseSchema,
  handler: async ({ tx, ctx, input }) => listLiveClassAttendanceSeries(tx, ctx, input),
});
