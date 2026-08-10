import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  liveClassAttendanceExportRunParamsSchema,
  retryLiveClassAttendanceExportResponseSchema,
} from "@atlas/domain/reports/live-class-attendance-exports.dto";
import { retryLiveClassAttendanceExportMetadata } from "@atlas/domain/reports/live-class-attendance-exports.route-metadata";
import { retryLiveClassAttendanceExport } from "@atlas/domain/reports/live-class-attendance-exports.service";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof retryLiveClassAttendanceExportResponseSchema>,
  typeof liveClassAttendanceExportRunParamsSchema
>({
  metadata: retryLiveClassAttendanceExportMetadata,
  params: liveClassAttendanceExportRunParamsSchema,
  input: noBodySchema,
  output: retryLiveClassAttendanceExportResponseSchema,
  handler: async ({ tx, ctx, params }) => retryLiveClassAttendanceExport(tx, ctx, params["runId"]),
});
