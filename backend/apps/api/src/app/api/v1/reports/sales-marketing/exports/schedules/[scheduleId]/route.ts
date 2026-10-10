import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { updateSalesMarketingExportScheduleResponseSchema } from "@atlas/domain/reports/sales-marketing-exports.dto";
import {
  deleteSalesMarketingExportSchedule,
  updateSalesMarketingExportSchedule,
} from "@atlas/domain/reports/sales-marketing-exports.service";
import {
  deleteReportExportScheduleResponseSchema,
  reportExportScheduleParamsSchema,
  updateReportExportScheduleBodySchema,
} from "@atlas/domain/reports/report-exports.dto";
import { mutateReportExportScheduleMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const PATCH = createTenantRoute<
  z.output<typeof updateReportExportScheduleBodySchema>,
  z.output<typeof updateSalesMarketingExportScheduleResponseSchema>,
  typeof reportExportScheduleParamsSchema
>({
  metadata: mutateReportExportScheduleMetadata,
  params: reportExportScheduleParamsSchema,
  body: updateReportExportScheduleBodySchema,
  output: updateSalesMarketingExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateSalesMarketingExportSchedule(tx, ctx, params["scheduleId"], input),
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
    deleteSalesMarketingExportSchedule(tx, ctx, params["scheduleId"]),
});
