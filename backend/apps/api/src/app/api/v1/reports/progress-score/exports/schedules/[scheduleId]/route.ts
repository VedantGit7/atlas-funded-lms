import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  deleteProgressScoreExportScheduleResponseSchema,
  progressScoreExportScheduleParamsSchema,
  updateProgressScoreExportScheduleBodySchema,
  updateProgressScoreExportScheduleResponseSchema,
} from "@atlas/domain/reports/progress-score-exports.dto";
import { mutateProgressScoreExportScheduleMetadata } from "@atlas/domain/reports/progress-score-exports.route-metadata";
import {
  deleteProgressScoreExportSchedule,
  updateProgressScoreExportSchedule,
} from "@atlas/domain/reports/progress-score-exports.service";

export const PATCH = createTenantRoute<
  z.output<typeof updateProgressScoreExportScheduleBodySchema>,
  z.output<typeof updateProgressScoreExportScheduleResponseSchema>,
  typeof progressScoreExportScheduleParamsSchema
>({
  metadata: mutateProgressScoreExportScheduleMetadata,
  params: progressScoreExportScheduleParamsSchema,
  body: updateProgressScoreExportScheduleBodySchema,
  output: updateProgressScoreExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateProgressScoreExportSchedule(tx, ctx, params["scheduleId"], input),
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof deleteProgressScoreExportScheduleResponseSchema>,
  typeof progressScoreExportScheduleParamsSchema
>({
  metadata: mutateProgressScoreExportScheduleMetadata,
  params: progressScoreExportScheduleParamsSchema,
  input: noBodySchema,
  output: deleteProgressScoreExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    deleteProgressScoreExportSchedule(tx, ctx, params["scheduleId"]),
});
