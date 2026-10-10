import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { updateZoomExportScheduleResponseSchema } from "@atlas/domain/reports/zoom-insights-exports.dto";
import {
  deleteZoomExportSchedule,
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
