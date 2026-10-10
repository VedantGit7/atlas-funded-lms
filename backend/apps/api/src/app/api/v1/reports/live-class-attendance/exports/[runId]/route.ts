import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { liveClassAttendanceExportRunDetailResponseSchema } from "@atlas/domain/reports/live-class-attendance-exports.dto";
import { getLiveClassAttendanceExportRun } from "@atlas/domain/reports/live-class-attendance-exports.service";
import { reportExportRunParamsSchema } from "@atlas/domain/reports/report-exports.dto";
import { getReportExportsMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof liveClassAttendanceExportRunDetailResponseSchema>,
  typeof reportExportRunParamsSchema
>({
  metadata: getReportExportsMetadata,
  params: reportExportRunParamsSchema,
  input: noBodySchema,
  output: liveClassAttendanceExportRunDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getLiveClassAttendanceExportRun(tx, ctx, params["runId"]),
});
