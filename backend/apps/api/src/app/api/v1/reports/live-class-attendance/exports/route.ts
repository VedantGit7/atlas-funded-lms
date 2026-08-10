import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  createLiveClassAttendanceExportBodySchema,
  createLiveClassAttendanceExportResponseSchema,
  liveClassAttendanceExportsResponseSchema,
} from "@atlas/domain/reports/live-class-attendance-exports.dto";
import {
  createLiveClassAttendanceExportMetadata,
  getLiveClassAttendanceExportsMetadata,
} from "@atlas/domain/reports/live-class-attendance-exports.route-metadata";
import {
  createLiveClassAttendanceExport,
  getLiveClassAttendanceExports,
} from "@atlas/domain/reports/live-class-attendance-exports.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof liveClassAttendanceExportsResponseSchema>
>({
  metadata: getLiveClassAttendanceExportsMetadata,
  input: noBodySchema,
  output: liveClassAttendanceExportsResponseSchema,
  handler: async ({ tx, ctx }) => getLiveClassAttendanceExports(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createLiveClassAttendanceExportBodySchema>,
  z.output<typeof createLiveClassAttendanceExportResponseSchema>
>({
  metadata: createLiveClassAttendanceExportMetadata,
  body: createLiveClassAttendanceExportBodySchema,
  output: createLiveClassAttendanceExportResponseSchema,
  handler: async ({ tx, ctx, input }) => createLiveClassAttendanceExport(tx, ctx, input),
});
