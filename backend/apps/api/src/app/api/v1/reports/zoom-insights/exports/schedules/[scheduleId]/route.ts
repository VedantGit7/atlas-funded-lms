import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  createZoomExportResponseSchema,
  updateZoomExportScheduleResponseSchema,
} from "@atlas/domain/reports/zoom-insights-exports.dto";
import {
  deleteZoomExportSchedule,
  runZoomExportScheduleNow,
  updateZoomExportSchedule,
} from "@atlas/domain/reports/zoom-insights-exports.service";
import {
  deleteReportExportScheduleResponseSchema,
  reportExportScheduleParamsSchema,
  updateReportExportScheduleBodySchema,
} from "@atlas/domain/reports/report-exports.dto";
import { mutateReportExportScheduleMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const PATCH = createTenantRoute<
  z.output<typeof updateReportExportScheduleBodySchema>,
  z.output<typeof updateZoomExportScheduleResponseSchema>,
  typeof reportExportScheduleParamsSchema
>({
  metadata: mutateReportExportScheduleMetadata,
  params: reportExportScheduleParamsSchema,
  body: updateReportExportScheduleBodySchema,
  output: updateZoomExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateZoomExportSchedule(tx, ctx, params["scheduleId"], input),
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
  handler: async ({ tx, ctx, params }) => deleteZoomExportSchedule(tx, ctx, params["scheduleId"]),
});

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof createZoomExportResponseSchema>,
  typeof reportExportScheduleParamsSchema
>({
  metadata: mutateReportExportScheduleMetadata,
  params: reportExportScheduleParamsSchema,
  input: noBodySchema,
  output: createZoomExportResponseSchema,
  handler: async ({ tx, ctx, params }) => runZoomExportScheduleNow(tx, ctx, params["scheduleId"]),
});
