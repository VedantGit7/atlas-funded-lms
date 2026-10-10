import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  createSuperLiveInsightsExportResponseSchema,
  updateSuperLiveInsightsExportScheduleResponseSchema,
} from "@atlas/domain/reports/super-live-insights-exports.dto";
import {
  deleteSuperLiveInsightsExportSchedule,
  runSuperLiveInsightsExportScheduleNow,
  updateSuperLiveInsightsExportSchedule,
} from "@atlas/domain/reports/super-live-insights-exports.service";
import {
  deleteReportExportScheduleResponseSchema,
  reportExportScheduleParamsSchema,
  updateReportExportScheduleBodySchema,
} from "@atlas/domain/reports/report-exports.dto";
import { mutateReportExportScheduleMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const PATCH = createTenantRoute<
  z.output<typeof updateReportExportScheduleBodySchema>,
  z.output<typeof updateSuperLiveInsightsExportScheduleResponseSchema>,
  typeof reportExportScheduleParamsSchema
>({
  metadata: mutateReportExportScheduleMetadata,
  params: reportExportScheduleParamsSchema,
  body: updateReportExportScheduleBodySchema,
  output: updateSuperLiveInsightsExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateSuperLiveInsightsExportSchedule(tx, ctx, params["scheduleId"], input),
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
    deleteSuperLiveInsightsExportSchedule(tx, ctx, params["scheduleId"]),
});

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof createSuperLiveInsightsExportResponseSchema>,
  typeof reportExportScheduleParamsSchema
>({
  metadata: mutateReportExportScheduleMetadata,
  params: reportExportScheduleParamsSchema,
  input: noBodySchema,
  output: createSuperLiveInsightsExportResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    runSuperLiveInsightsExportScheduleNow(tx, ctx, params["scheduleId"]),
});
