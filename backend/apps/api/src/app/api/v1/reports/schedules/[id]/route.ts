import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  deleteReportScheduleResponseSchema,
  reportScheduleParamsSchema,
  updateReportScheduleBodySchema,
  updateReportScheduleResponseSchema,
} from "@atlas/domain/reports/reports.dto";
import { deleteReportSchedule, updateReportSchedule } from "@atlas/domain/reports/reports.service";
import {
  deleteReportScheduleMetadata,
  updateReportScheduleMetadata,
} from "@atlas/domain/reports/reports.route-metadata";

export const PATCH = createTenantRoute<
  z.output<typeof updateReportScheduleBodySchema>,
  z.output<typeof updateReportScheduleResponseSchema>,
  typeof reportScheduleParamsSchema
>({
  metadata: updateReportScheduleMetadata,
  params: reportScheduleParamsSchema,
  input: updateReportScheduleBodySchema,
  output: updateReportScheduleResponseSchema,
  handler: async ({ tx, ctx, params, input }) => updateReportSchedule(tx, ctx, params.id, input),
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof deleteReportScheduleResponseSchema>,
  typeof reportScheduleParamsSchema
>({
  metadata: deleteReportScheduleMetadata,
  params: reportScheduleParamsSchema,
  output: deleteReportScheduleResponseSchema,
  handler: async ({ tx, ctx, params }) => deleteReportSchedule(tx, ctx, params.id),
});
