import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  deleteZoomExportScheduleResponseSchema,
  updateZoomExportScheduleBodySchema,
  updateZoomExportScheduleResponseSchema,
  zoomExportScheduleParamsSchema,
} from "@atlas/domain/reports/zoom-insights-exports.dto";
import { mutateZoomInsightsExportScheduleMetadata } from "@atlas/domain/reports/zoom-insights-exports.route-metadata";
import {
  deleteZoomExportSchedule,
  updateZoomExportSchedule,
} from "@atlas/domain/reports/zoom-insights-exports.service";

export const PATCH = createTenantRoute<
  z.output<typeof updateZoomExportScheduleBodySchema>,
  z.output<typeof updateZoomExportScheduleResponseSchema>,
  typeof zoomExportScheduleParamsSchema
>({
  metadata: mutateZoomInsightsExportScheduleMetadata,
  params: zoomExportScheduleParamsSchema,
  body: updateZoomExportScheduleBodySchema,
  output: updateZoomExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateZoomExportSchedule(tx, ctx, params["scheduleId"], input),
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof deleteZoomExportScheduleResponseSchema>,
  typeof zoomExportScheduleParamsSchema
>({
  metadata: mutateZoomInsightsExportScheduleMetadata,
  params: zoomExportScheduleParamsSchema,
  input: noBodySchema,
  output: deleteZoomExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params }) => deleteZoomExportSchedule(tx, ctx, params["scheduleId"]),
});
