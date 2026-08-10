import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  liveClassAttendanceExportRunDetailResponseSchema,
  liveClassAttendanceExportRunParamsSchema,
} from "@atlas/domain/reports/live-class-attendance-exports.dto";
import { getLiveClassAttendanceExportsMetadata } from "@atlas/domain/reports/live-class-attendance-exports.route-metadata";
import { getLiveClassAttendanceExportRun } from "@atlas/domain/reports/live-class-attendance-exports.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof liveClassAttendanceExportRunDetailResponseSchema>,
  typeof liveClassAttendanceExportRunParamsSchema
>({
  metadata: getLiveClassAttendanceExportsMetadata,
  params: liveClassAttendanceExportRunParamsSchema,
  input: noBodySchema,
  output: liveClassAttendanceExportRunDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getLiveClassAttendanceExportRun(tx, ctx, params["runId"]),
});
