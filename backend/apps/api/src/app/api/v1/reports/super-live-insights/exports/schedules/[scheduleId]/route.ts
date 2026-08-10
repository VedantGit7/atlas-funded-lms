import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  createSuperLiveInsightsExportResponseSchema,
  deleteSuperLiveInsightsExportScheduleResponseSchema,
  superLiveInsightsExportScheduleParamsSchema,
  updateSuperLiveInsightsExportScheduleBodySchema,
  updateSuperLiveInsightsExportScheduleResponseSchema,
} from "@atlas/domain/reports/super-live-insights-exports.dto";
import { mutateSuperLiveInsightsExportScheduleMetadata } from "@atlas/domain/reports/super-live-insights-exports.route-metadata";
import {
  deleteSuperLiveInsightsExportSchedule,
  runSuperLiveInsightsExportScheduleNow,
  updateSuperLiveInsightsExportSchedule,
} from "@atlas/domain/reports/super-live-insights-exports.service";

export const PATCH = createTenantRoute<
  z.output<typeof updateSuperLiveInsightsExportScheduleBodySchema>,
  z.output<typeof updateSuperLiveInsightsExportScheduleResponseSchema>,
  typeof superLiveInsightsExportScheduleParamsSchema
>({
  metadata: mutateSuperLiveInsightsExportScheduleMetadata,
  params: superLiveInsightsExportScheduleParamsSchema,
  body: updateSuperLiveInsightsExportScheduleBodySchema,
  output: updateSuperLiveInsightsExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateSuperLiveInsightsExportSchedule(tx, ctx, params["scheduleId"], input),
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof deleteSuperLiveInsightsExportScheduleResponseSchema>,
  typeof superLiveInsightsExportScheduleParamsSchema
>({
  metadata: mutateSuperLiveInsightsExportScheduleMetadata,
  params: superLiveInsightsExportScheduleParamsSchema,
  input: noBodySchema,
  output: deleteSuperLiveInsightsExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    deleteSuperLiveInsightsExportSchedule(tx, ctx, params["scheduleId"]),
});

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof createSuperLiveInsightsExportResponseSchema>,
  typeof superLiveInsightsExportScheduleParamsSchema
>({
  metadata: mutateSuperLiveInsightsExportScheduleMetadata,
  params: superLiveInsightsExportScheduleParamsSchema,
  input: noBodySchema,
  output: createSuperLiveInsightsExportResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    runSuperLiveInsightsExportScheduleNow(tx, ctx, params["scheduleId"]),
});
