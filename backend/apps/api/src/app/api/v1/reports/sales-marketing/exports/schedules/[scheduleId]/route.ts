import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  createSalesMarketingExportResponseSchema,
  updateSalesMarketingExportScheduleResponseSchema,
} from "@atlas/domain/reports/sales-marketing-exports.dto";
import {
  deleteSalesMarketingExportSchedule,
  runSalesMarketingExportScheduleNow,
  updateSalesMarketingExportSchedule,
} from "@atlas/domain/reports/sales-marketing-exports.service";
import { scheduleReportExportProcessing } from "../../../../../../../../server/reports/report-exports-async";
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

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof createSalesMarketingExportResponseSchema>,
  typeof reportExportScheduleParamsSchema
>({
  metadata: mutateReportExportScheduleMetadata,
  params: reportExportScheduleParamsSchema,
  input: noBodySchema,
  output: createSalesMarketingExportResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const result = await runSalesMarketingExportScheduleNow(tx, ctx, params["scheduleId"]);
    scheduleReportExportProcessing("sales-marketing", {
      tenantId: ctx.tenantId,
      requestId: ctx.requestId,
      actorMembershipId: ctx.actorMembershipId,
      reportRunId: result.data.run.id,
      format: result.data.run.format === "pdf" ? "csv" : result.data.run.format,
      requestedAt: result.data.run.createdAt,
    });
    return result;
  },
});
