import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  deleteSalesMarketingExportScheduleResponseSchema,
  smExportScheduleParamsSchema,
  updateSalesMarketingExportScheduleBodySchema,
  updateSalesMarketingExportScheduleResponseSchema,
} from "@atlas/domain/reports/sales-marketing-exports.dto";
import { mutateSalesMarketingExportScheduleMetadata } from "@atlas/domain/reports/sales-marketing-exports.route-metadata";
import {
  deleteSalesMarketingExportSchedule,
  updateSalesMarketingExportSchedule,
} from "@atlas/domain/reports/sales-marketing-exports.service";

export const PATCH = createTenantRoute<
  z.output<typeof updateSalesMarketingExportScheduleBodySchema>,
  z.output<typeof updateSalesMarketingExportScheduleResponseSchema>,
  typeof smExportScheduleParamsSchema
>({
  metadata: mutateSalesMarketingExportScheduleMetadata,
  params: smExportScheduleParamsSchema,
  body: updateSalesMarketingExportScheduleBodySchema,
  output: updateSalesMarketingExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateSalesMarketingExportSchedule(tx, ctx, params.scheduleId, input),
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof deleteSalesMarketingExportScheduleResponseSchema>,
  typeof smExportScheduleParamsSchema
>({
  metadata: mutateSalesMarketingExportScheduleMetadata,
  params: smExportScheduleParamsSchema,
  input: noBodySchema,
  output: deleteSalesMarketingExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    deleteSalesMarketingExportSchedule(tx, ctx, params.scheduleId),
});
