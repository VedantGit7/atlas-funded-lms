import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  createLiveClassAttendanceExportResponseSchema,
  updateLiveClassAttendanceExportScheduleResponseSchema,
} from "@atlas/domain/reports/live-class-attendance-exports.dto";
import {
  deleteLiveClassAttendanceExportSchedule,
  runLiveClassAttendanceExportScheduleNow,
  updateLiveClassAttendanceExportSchedule,
} from "@atlas/domain/reports/live-class-attendance-exports.service";
import {
  deleteReportExportScheduleResponseSchema,
  reportExportScheduleParamsSchema,
  updateReportExportScheduleBodySchema,
} from "@atlas/domain/reports/report-exports.dto";
import { mutateReportExportScheduleMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const PATCH = createTenantRoute<
  z.output<typeof updateReportExportScheduleBodySchema>,
  z.output<typeof updateLiveClassAttendanceExportScheduleResponseSchema>,
  typeof reportExportScheduleParamsSchema
>({
  metadata: mutateReportExportScheduleMetadata,
  params: reportExportScheduleParamsSchema,
  body: updateReportExportScheduleBodySchema,
  output: updateLiveClassAttendanceExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateLiveClassAttendanceExportSchedule(tx, ctx, params["scheduleId"], input),
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof deleteReportExportScheduleResponseSchema>,
  typeof reportExportScheduleParamsSchema
>({
  metadata: mutateReportExportScheduleMetadata,
  params: reportExportScheduleParamsSchema,
  input: noBodySchema,
  output: deleteReportExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    deleteLiveClassAttendanceExportSchedule(tx, ctx, params["scheduleId"]),
});

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof createLiveClassAttendanceExportResponseSchema>,
  typeof reportExportScheduleParamsSchema
>({
  metadata: mutateReportExportScheduleMetadata,
  params: reportExportScheduleParamsSchema,
  input: noBodySchema,
  output: createLiveClassAttendanceExportResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    runLiveClassAttendanceExportScheduleNow(tx, ctx, params["scheduleId"]),
});
