import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  batchExportScheduleParamsSchema,
  deleteBatchExportScheduleResponseSchema,
  updateBatchExportScheduleBodySchema,
  updateBatchExportScheduleResponseSchema,
} from "@atlas/domain/reports/batches-exports.dto";
import { mutateBatchesExportScheduleMetadata } from "@atlas/domain/reports/batches-exports.route-metadata";
import {
  deleteBatchExportSchedule,
  updateBatchExportSchedule,
} from "@atlas/domain/reports/batches-exports.service";

export const PATCH = createTenantRoute<
  z.output<typeof updateBatchExportScheduleBodySchema>,
  z.output<typeof updateBatchExportScheduleResponseSchema>,
  typeof batchExportScheduleParamsSchema
>({
  metadata: mutateBatchesExportScheduleMetadata,
  params: batchExportScheduleParamsSchema,
  body: updateBatchExportScheduleBodySchema,
  output: updateBatchExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateBatchExportSchedule(tx, ctx, params["scheduleId"], input),
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof deleteBatchExportScheduleResponseSchema>,
  typeof batchExportScheduleParamsSchema
>({
  metadata: mutateBatchesExportScheduleMetadata,
  params: batchExportScheduleParamsSchema,
  input: noBodySchema,
  output: deleteBatchExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params }) => deleteBatchExportSchedule(tx, ctx, params["scheduleId"]),
});
