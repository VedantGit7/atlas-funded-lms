import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  captureDeviceSessionBodySchema,
  captureDeviceSessionResponseSchema,
} from "@atlas/domain/devices/devices.dto";
import { captureDeviceSessionMetadata } from "@atlas/domain/devices/devices.route-metadata";
import { captureDeviceSession } from "@atlas/domain/devices/devices.service";

export const POST = createTenantRoute<
  z.output<typeof captureDeviceSessionBodySchema>,
  z.output<typeof captureDeviceSessionResponseSchema>
>({
  metadata: captureDeviceSessionMetadata,
  input: captureDeviceSessionBodySchema,
  output: captureDeviceSessionResponseSchema,
  handler: async ({ tx, ctx, input }) => captureDeviceSession(tx, ctx, input),
});
