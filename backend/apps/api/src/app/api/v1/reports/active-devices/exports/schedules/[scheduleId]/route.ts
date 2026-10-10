import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { updateDeviceExportScheduleResponseSchema } from "@atlas/domain/reports/active-devices-exports.dto";
import {
  deleteActiveDevicesExportSchedule,
  updateActiveDevicesExportSchedule,
} from "@atlas/domain/reports/active-devices-exports.service";
import {
  deleteReportExportScheduleResponseSchema,
  reportExportScheduleParamsSchema,
  updateReportExportScheduleBodySchema,
} from "@atlas/domain/reports/report-exports.dto";
import { mutateReportExportScheduleMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const PATCH = createTenantRoute<
  z.output<typeof updateReportExportScheduleBodySchema>,
  z.output<typeof updateDeviceExportScheduleResponseSchema>,
  typeof reportExportScheduleParamsSchema
>({
  metadata: mutateReportExportScheduleMetadata,
  params: reportExportScheduleParamsSchema,
  body: updateReportExportScheduleBodySchema,
  output: updateDeviceExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateActiveDevicesExportSchedule(tx, ctx, params["scheduleId"], input),
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
    deleteActiveDevicesExportSchedule(tx, ctx, params["scheduleId"]),
});
