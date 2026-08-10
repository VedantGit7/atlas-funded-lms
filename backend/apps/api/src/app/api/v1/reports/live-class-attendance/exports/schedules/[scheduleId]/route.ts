import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  createLiveClassAttendanceExportResponseSchema,
  deleteLiveClassAttendanceExportScheduleResponseSchema,
  liveClassAttendanceExportScheduleParamsSchema,
  updateLiveClassAttendanceExportScheduleBodySchema,
  updateLiveClassAttendanceExportScheduleResponseSchema,
} from "@atlas/domain/reports/live-class-attendance-exports.dto";
import { mutateLiveClassAttendanceExportScheduleMetadata } from "@atlas/domain/reports/live-class-attendance-exports.route-metadata";
import {
  deleteLiveClassAttendanceExportSchedule,
  runLiveClassAttendanceExportScheduleNow,
  updateLiveClassAttendanceExportSchedule,
} from "@atlas/domain/reports/live-class-attendance-exports.service";

export const PATCH = createTenantRoute<
  z.output<typeof updateLiveClassAttendanceExportScheduleBodySchema>,
  z.output<typeof updateLiveClassAttendanceExportScheduleResponseSchema>,
  typeof liveClassAttendanceExportScheduleParamsSchema
>({
  metadata: mutateLiveClassAttendanceExportScheduleMetadata,
  params: liveClassAttendanceExportScheduleParamsSchema,
  body: updateLiveClassAttendanceExportScheduleBodySchema,
  output: updateLiveClassAttendanceExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateLiveClassAttendanceExportSchedule(tx, ctx, params["scheduleId"], input),
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof deleteLiveClassAttendanceExportScheduleResponseSchema>,
  typeof liveClassAttendanceExportScheduleParamsSchema
>({
  metadata: mutateLiveClassAttendanceExportScheduleMetadata,
  params: liveClassAttendanceExportScheduleParamsSchema,
  input: noBodySchema,
  output: deleteLiveClassAttendanceExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    deleteLiveClassAttendanceExportSchedule(tx, ctx, params["scheduleId"]),
});

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof createLiveClassAttendanceExportResponseSchema>,
  typeof liveClassAttendanceExportScheduleParamsSchema
>({
  metadata: mutateLiveClassAttendanceExportScheduleMetadata,
  params: liveClassAttendanceExportScheduleParamsSchema,
  input: noBodySchema,
  output: createLiveClassAttendanceExportResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    runLiveClassAttendanceExportScheduleNow(tx, ctx, params["scheduleId"]),
});
