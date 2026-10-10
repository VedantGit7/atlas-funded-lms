import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  createResourceUsageExportResponseSchema,
  updateResourceUsageExportScheduleResponseSchema,
} from "@atlas/domain/reports/resource-usage-exports.dto";
import {
  deleteResourceUsageExportSchedule,
  runResourceUsageExportScheduleNow,
  updateResourceUsageExportSchedule,
} from "@atlas/domain/reports/resource-usage-exports.service";
import {
  deleteReportExportScheduleResponseSchema,
  reportExportScheduleParamsSchema,
  updateReportExportScheduleBodySchema,
} from "@atlas/domain/reports/report-exports.dto";
import { mutateReportExportScheduleMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const PATCH = createTenantRoute<
  z.output<typeof updateReportExportScheduleBodySchema>,
  z.output<typeof updateResourceUsageExportScheduleResponseSchema>,
  typeof reportExportScheduleParamsSchema
>({
  metadata: mutateReportExportScheduleMetadata,
  params: reportExportScheduleParamsSchema,
  body: updateReportExportScheduleBodySchema,
  output: updateResourceUsageExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateResourceUsageExportSchedule(tx, ctx, params["scheduleId"], input),
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
    deleteResourceUsageExportSchedule(tx, ctx, params["scheduleId"]),
});

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof createResourceUsageExportResponseSchema>,
  typeof reportExportScheduleParamsSchema
>({
  metadata: mutateReportExportScheduleMetadata,
  params: reportExportScheduleParamsSchema,
  input: noBodySchema,
  output: createResourceUsageExportResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    runResourceUsageExportScheduleNow(tx, ctx, params["scheduleId"]),
});
