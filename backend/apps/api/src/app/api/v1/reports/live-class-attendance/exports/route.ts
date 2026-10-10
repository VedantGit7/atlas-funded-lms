import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  createLiveClassAttendanceExportBodySchema,
  createLiveClassAttendanceExportResponseSchema,
  liveClassAttendanceExportsResponseSchema,
} from "@atlas/domain/reports/live-class-attendance-exports.dto";
import {
  createLiveClassAttendanceExport,
  getLiveClassAttendanceExports,
} from "@atlas/domain/reports/live-class-attendance-exports.service";
import {
  createReportExportMetadata,
  getReportExportsMetadata,
} from "@atlas/domain/reports/report-exports.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof liveClassAttendanceExportsResponseSchema>
>({
  metadata: getReportExportsMetadata,
  input: noBodySchema,
  output: liveClassAttendanceExportsResponseSchema,
  handler: async ({ tx, ctx }) => getLiveClassAttendanceExports(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createLiveClassAttendanceExportBodySchema>,
  z.output<typeof createLiveClassAttendanceExportResponseSchema>
>({
  metadata: createReportExportMetadata,
  body: createLiveClassAttendanceExportBodySchema,
  output: createLiveClassAttendanceExportResponseSchema,
  handler: async ({ tx, ctx, input }) => createLiveClassAttendanceExport(tx, ctx, input),
});
