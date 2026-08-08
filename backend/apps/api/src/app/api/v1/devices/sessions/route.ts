import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  captureDeviceSessionBodySchema,
  captureDeviceSessionResponseSchema,
  deleteDeviceSessionsBodySchema,
  deleteDeviceSessionsResponseSchema,
  listDeviceSessionsQuerySchema,
  listDeviceSessionsResponseSchema,
} from "@atlas/domain/devices/devices.dto";
import {
  captureDeviceSessionMetadata,
  deleteDeviceSessionsMetadata,
  listDeviceSessionsMetadata,
} from "@atlas/domain/devices/devices.route-metadata";
import {
  captureDeviceSession,
  deleteDeviceSessions,
  listDeviceSessions,
} from "@atlas/domain/devices/devices.service";

export const GET = createTenantRoute<
  z.output<typeof listDeviceSessionsQuerySchema>,
  z.output<typeof listDeviceSessionsResponseSchema>
>({
  metadata: listDeviceSessionsMetadata,
  input: listDeviceSessionsQuerySchema,
  output: listDeviceSessionsResponseSchema,
  handler: async ({ tx, ctx, input }) => listDeviceSessions(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof captureDeviceSessionBodySchema>,
  z.output<typeof captureDeviceSessionResponseSchema>
>({
  metadata: captureDeviceSessionMetadata,
  body: captureDeviceSessionBodySchema,
  output: captureDeviceSessionResponseSchema,
  handler: async ({ tx, ctx, input }) => captureDeviceSession(tx, ctx, input),
});

export const DELETE = createTenantRoute<
  z.output<typeof deleteDeviceSessionsBodySchema>,
  z.output<typeof deleteDeviceSessionsResponseSchema>
>({
  metadata: deleteDeviceSessionsMetadata,
  body: deleteDeviceSessionsBodySchema,
  output: deleteDeviceSessionsResponseSchema,
  handler: async ({ tx, ctx, input }) => deleteDeviceSessions(tx, ctx, input),
});
