import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { updateBatchExportScheduleResponseSchema } from "@atlas/domain/reports/batches-exports.dto";
import {
  deleteBatchExportSchedule,
  updateBatchExportSchedule,
} from "@atlas/domain/reports/batches-exports.service";
import {
  deleteReportExportScheduleResponseSchema,
  reportExportScheduleParamsSchema,
  updateReportExportScheduleBodySchema,
} from "@atlas/domain/reports/report-exports.dto";
import { mutateReportExportScheduleMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const PATCH = createTenantRoute<
  z.output<typeof updateReportExportScheduleBodySchema>,
  z.output<typeof updateBatchExportScheduleResponseSchema>,
  typeof reportExportScheduleParamsSchema
>({
  metadata: mutateReportExportScheduleMetadata,
  params: reportExportScheduleParamsSchema,
  body: updateReportExportScheduleBodySchema,
  output: updateBatchExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateBatchExportSchedule(tx, ctx, params["scheduleId"], input),
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
  handler: async ({ tx, ctx, params }) => deleteBatchExportSchedule(tx, ctx, params["scheduleId"]),
});
