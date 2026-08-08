import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  deleteDeviceExportScheduleResponseSchema,
  deviceExportScheduleParamsSchema,
  updateDeviceExportScheduleBodySchema,
  updateDeviceExportScheduleResponseSchema,
} from "@atlas/domain/reports/active-devices-exports.dto";
import { mutateDeviceExportScheduleMetadata } from "@atlas/domain/reports/active-devices-exports.route-metadata";
import {
  deleteActiveDevicesExportSchedule,
  updateActiveDevicesExportSchedule,
} from "@atlas/domain/reports/active-devices-exports.service";

export const PATCH = createTenantRoute<
  z.output<typeof updateDeviceExportScheduleBodySchema>,
  z.output<typeof updateDeviceExportScheduleResponseSchema>,
  typeof deviceExportScheduleParamsSchema
>({
  metadata: mutateDeviceExportScheduleMetadata,
  params: deviceExportScheduleParamsSchema,
  body: updateDeviceExportScheduleBodySchema,
  output: updateDeviceExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateActiveDevicesExportSchedule(tx, ctx, params.scheduleId, input),
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof deleteDeviceExportScheduleResponseSchema>,
  typeof deviceExportScheduleParamsSchema
>({
  metadata: mutateDeviceExportScheduleMetadata,
  params: deviceExportScheduleParamsSchema,
  input: noBodySchema,
  output: deleteDeviceExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    deleteActiveDevicesExportSchedule(tx, ctx, params.scheduleId),
});
