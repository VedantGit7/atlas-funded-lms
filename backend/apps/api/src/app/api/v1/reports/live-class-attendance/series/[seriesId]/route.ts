import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  liveSeriesDetailParamsSchema,
  liveSeriesDetailQuerySchema,
  liveSeriesDetailResponseSchema,
} from "@atlas/domain/reports/live-class-attendance-roster.dto";
import { listLiveClassAttendanceRosterMetadata } from "@atlas/domain/reports/live-class-attendance-roster.route-metadata";
import { getLiveClassAttendanceSeriesDetail } from "@atlas/domain/reports/live-class-attendance-roster.service";

export const GET = createTenantRoute<
  z.output<typeof liveSeriesDetailQuerySchema>,
  z.output<typeof liveSeriesDetailResponseSchema>,
  typeof liveSeriesDetailParamsSchema
>({
  metadata: listLiveClassAttendanceRosterMetadata,
  input: liveSeriesDetailQuerySchema,
  params: liveSeriesDetailParamsSchema,
  output: liveSeriesDetailResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    getLiveClassAttendanceSeriesDetail(tx, ctx, params["seriesId"], input),
});
