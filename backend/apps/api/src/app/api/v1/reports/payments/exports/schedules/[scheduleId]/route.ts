import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  deletePaymentExportScheduleResponseSchema,
  paymentExportScheduleParamsSchema,
  updatePaymentExportScheduleBodySchema,
  updatePaymentExportScheduleResponseSchema,
} from "@atlas/domain/reports/payments-exports.dto";
import { mutatePaymentExportScheduleMetadata } from "@atlas/domain/reports/payments-exports.route-metadata";
import {
  deletePaymentExportSchedule,
  updatePaymentExportSchedule,
} from "@atlas/domain/reports/payments-exports.service";

export const PATCH = createTenantRoute<
  z.output<typeof updatePaymentExportScheduleBodySchema>,
  z.output<typeof updatePaymentExportScheduleResponseSchema>,
  typeof paymentExportScheduleParamsSchema
>({
  metadata: mutatePaymentExportScheduleMetadata,
  params: paymentExportScheduleParamsSchema,
  body: updatePaymentExportScheduleBodySchema,
  output: updatePaymentExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updatePaymentExportSchedule(tx, ctx, params["scheduleId"], input),
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof deletePaymentExportScheduleResponseSchema>,
  typeof paymentExportScheduleParamsSchema
>({
  metadata: mutatePaymentExportScheduleMetadata,
  params: paymentExportScheduleParamsSchema,
  input: noBodySchema,
  output: deletePaymentExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    deletePaymentExportSchedule(tx, ctx, params["scheduleId"]),
});
