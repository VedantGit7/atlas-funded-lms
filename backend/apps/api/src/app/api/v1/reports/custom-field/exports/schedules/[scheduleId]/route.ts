import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  customFieldExportScheduleParamsSchema,
  deleteCustomFieldExportScheduleResponseSchema,
  updateCustomFieldExportScheduleBodySchema,
  updateCustomFieldExportScheduleResponseSchema,
} from "@atlas/domain/reports/custom-field-exports.dto";
import { mutateCustomFieldExportScheduleMetadata } from "@atlas/domain/reports/custom-field-exports.route-metadata";
import {
  deleteCustomFieldExportSchedule,
  updateCustomFieldExportSchedule,
} from "@atlas/domain/reports/custom-field-exports.service";

export const PATCH = createTenantRoute<
  z.output<typeof updateCustomFieldExportScheduleBodySchema>,
  z.output<typeof updateCustomFieldExportScheduleResponseSchema>,
  typeof customFieldExportScheduleParamsSchema
>({
  metadata: mutateCustomFieldExportScheduleMetadata,
  params: customFieldExportScheduleParamsSchema,
  body: updateCustomFieldExportScheduleBodySchema,
  output: updateCustomFieldExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateCustomFieldExportSchedule(tx, ctx, params["scheduleId"], input),
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof deleteCustomFieldExportScheduleResponseSchema>,
  typeof customFieldExportScheduleParamsSchema
>({
  metadata: mutateCustomFieldExportScheduleMetadata,
  params: customFieldExportScheduleParamsSchema,
  input: noBodySchema,
  output: deleteCustomFieldExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    deleteCustomFieldExportSchedule(tx, ctx, params["scheduleId"]),
});
