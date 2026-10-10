import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { retryLiveClassAttendanceExportResponseSchema } from "@atlas/domain/reports/live-class-attendance-exports.dto";
import { retryLiveClassAttendanceExport } from "@atlas/domain/reports/live-class-attendance-exports.service";
import { reportExportRunParamsSchema } from "@atlas/domain/reports/report-exports.dto";
import { retryReportExportMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof retryLiveClassAttendanceExportResponseSchema>,
  typeof reportExportRunParamsSchema
>({
  metadata: retryReportExportMetadata,
  params: reportExportRunParamsSchema,
  input: noBodySchema,
  output: retryLiveClassAttendanceExportResponseSchema,
  handler: async ({ tx, ctx, params }) => retryLiveClassAttendanceExport(tx, ctx, params["runId"]),
});
