import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  createPaymentExportResponseSchema,
  updatePaymentExportScheduleResponseSchema,
} from "@atlas/domain/reports/payments-exports.dto";
import {
  deletePaymentExportSchedule,
  runPaymentExportScheduleNow,
  updatePaymentExportSchedule,
} from "@atlas/domain/reports/payments-exports.service";
import { scheduleReportExportProcessing } from "../../../../../../../../server/reports/report-exports-async";
import {
  deleteReportExportScheduleResponseSchema,
  reportExportScheduleParamsSchema,
  updateReportExportScheduleBodySchema,
} from "@atlas/domain/reports/report-exports.dto";
import { mutateReportExportScheduleMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const PATCH = createTenantRoute<
  z.output<typeof updateReportExportScheduleBodySchema>,
  z.output<typeof updatePaymentExportScheduleResponseSchema>,
  typeof reportExportScheduleParamsSchema
>({
  metadata: mutateReportExportScheduleMetadata,
  params: reportExportScheduleParamsSchema,
  body: updateReportExportScheduleBodySchema,
  output: updatePaymentExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updatePaymentExportSchedule(tx, ctx, params["scheduleId"], input),
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
    deletePaymentExportSchedule(tx, ctx, params["scheduleId"]),
});

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof createPaymentExportResponseSchema>,
  typeof reportExportScheduleParamsSchema
>({
  metadata: mutateReportExportScheduleMetadata,
  params: reportExportScheduleParamsSchema,
  input: noBodySchema,
  output: createPaymentExportResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const result = await runPaymentExportScheduleNow(tx, ctx, params["scheduleId"]);
    scheduleReportExportProcessing("payments", {
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
