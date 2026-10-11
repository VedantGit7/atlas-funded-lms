import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  createCustomFieldExportResponseSchema,
  updateCustomFieldExportScheduleResponseSchema,
} from "@atlas/domain/reports/custom-field-exports.dto";
import {
  deleteCustomFieldExportSchedule,
  runCustomFieldExportScheduleNow,
  updateCustomFieldExportSchedule,
} from "@atlas/domain/reports/custom-field-exports.service";
import {
  deleteReportExportScheduleResponseSchema,
  reportExportScheduleParamsSchema,
  updateReportExportScheduleBodySchema,
} from "@atlas/domain/reports/report-exports.dto";
import { mutateReportExportScheduleMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const PATCH = createTenantRoute<
  z.output<typeof updateReportExportScheduleBodySchema>,
  z.output<typeof updateCustomFieldExportScheduleResponseSchema>,
  typeof reportExportScheduleParamsSchema
>({
  metadata: mutateReportExportScheduleMetadata,
  params: reportExportScheduleParamsSchema,
  body: updateReportExportScheduleBodySchema,
  output: updateCustomFieldExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateCustomFieldExportSchedule(tx, ctx, params["scheduleId"], input),
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
    deleteCustomFieldExportSchedule(tx, ctx, params["scheduleId"]),
});

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof createCustomFieldExportResponseSchema>,
  typeof reportExportScheduleParamsSchema
>({
  metadata: mutateReportExportScheduleMetadata,
  params: reportExportScheduleParamsSchema,
  input: noBodySchema,
  output: createCustomFieldExportResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    runCustomFieldExportScheduleNow(tx, ctx, params["scheduleId"]),
});
