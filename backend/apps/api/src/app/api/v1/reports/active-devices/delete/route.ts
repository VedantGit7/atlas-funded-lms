import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  deleteDeviceSessionsBodySchema,
  deleteDeviceSessionsResponseSchema,
} from "@atlas/domain/devices/devices.dto";
import { deleteActiveDevicesMetadata } from "@atlas/domain/reports/active-devices-roster.route-metadata";
import { deleteDeviceSessions } from "@atlas/domain/devices/devices.service";

export const POST = createTenantRoute<
  z.output<typeof deleteDeviceSessionsBodySchema>,
  z.output<typeof deleteDeviceSessionsResponseSchema>
>({
  metadata: deleteActiveDevicesMetadata,
  body: deleteDeviceSessionsBodySchema,
  output: deleteDeviceSessionsResponseSchema,
  handler: async ({ tx, ctx, input }) => deleteDeviceSessions(tx, ctx, input),
});
