import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  createResourceUsageExportResponseSchema,
  deleteResourceUsageExportScheduleResponseSchema,
  resourceUsageExportScheduleParamsSchema,
  updateResourceUsageExportScheduleBodySchema,
  updateResourceUsageExportScheduleResponseSchema,
} from "@atlas/domain/reports/resource-usage-exports.dto";
import { mutateResourceUsageExportScheduleMetadata } from "@atlas/domain/reports/resource-usage-exports.route-metadata";
import {
  deleteResourceUsageExportSchedule,
  runResourceUsageExportScheduleNow,
  updateResourceUsageExportSchedule,
} from "@atlas/domain/reports/resource-usage-exports.service";

export const PATCH = createTenantRoute<
  z.output<typeof updateResourceUsageExportScheduleBodySchema>,
  z.output<typeof updateResourceUsageExportScheduleResponseSchema>,
  typeof resourceUsageExportScheduleParamsSchema
>({
  metadata: mutateResourceUsageExportScheduleMetadata,
  params: resourceUsageExportScheduleParamsSchema,
  body: updateResourceUsageExportScheduleBodySchema,
  output: updateResourceUsageExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateResourceUsageExportSchedule(tx, ctx, params["scheduleId"], input),
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof deleteResourceUsageExportScheduleResponseSchema>,
  typeof resourceUsageExportScheduleParamsSchema
>({
  metadata: mutateResourceUsageExportScheduleMetadata,
  params: resourceUsageExportScheduleParamsSchema,
  input: noBodySchema,
  output: deleteResourceUsageExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    deleteResourceUsageExportSchedule(tx, ctx, params["scheduleId"]),
});

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof createResourceUsageExportResponseSchema>,
  typeof resourceUsageExportScheduleParamsSchema
>({
  metadata: mutateResourceUsageExportScheduleMetadata,
  params: resourceUsageExportScheduleParamsSchema,
  input: noBodySchema,
  output: createResourceUsageExportResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    runResourceUsageExportScheduleNow(tx, ctx, params["scheduleId"]),
});
