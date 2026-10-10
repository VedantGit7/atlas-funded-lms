import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { updateProgressScoreExportScheduleResponseSchema } from "@atlas/domain/reports/progress-score-exports.dto";
import {
  deleteProgressScoreExportSchedule,
  updateProgressScoreExportSchedule,
} from "@atlas/domain/reports/progress-score-exports.service";
import {
  deleteReportExportScheduleResponseSchema,
  reportExportScheduleParamsSchema,
  updateReportExportScheduleBodySchema,
} from "@atlas/domain/reports/report-exports.dto";
import { mutateReportExportScheduleMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const PATCH = createTenantRoute<
  z.output<typeof updateReportExportScheduleBodySchema>,
  z.output<typeof updateProgressScoreExportScheduleResponseSchema>,
  typeof reportExportScheduleParamsSchema
>({
  metadata: mutateReportExportScheduleMetadata,
  params: reportExportScheduleParamsSchema,
  body: updateReportExportScheduleBodySchema,
  output: updateProgressScoreExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateProgressScoreExportSchedule(tx, ctx, params["scheduleId"], input),
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
    deleteProgressScoreExportSchedule(tx, ctx, params["scheduleId"]),
});
