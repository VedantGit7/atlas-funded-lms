import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { updatePaymentExportScheduleResponseSchema } from "@atlas/domain/reports/payments-exports.dto";
import {
  deletePaymentExportSchedule,
  updatePaymentExportSchedule,
} from "@atlas/domain/reports/payments-exports.service";
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
