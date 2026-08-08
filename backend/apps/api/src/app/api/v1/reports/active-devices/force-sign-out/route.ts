import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  forceSignOutBodySchema,
  forceSignOutResponseSchema,
} from "@atlas/domain/devices/devices.dto";
import { forceSignOutActiveDevicesMetadata } from "@atlas/domain/reports/active-devices-roster.route-metadata";
import { forceSignOutLearner } from "@atlas/domain/devices/devices.service";

export const POST = createTenantRoute<
  z.output<typeof forceSignOutBodySchema>,
  z.output<typeof forceSignOutResponseSchema>
>({
  metadata: forceSignOutActiveDevicesMetadata,
  body: forceSignOutBodySchema,
  output: forceSignOutResponseSchema,
  handler: async ({ tx, ctx, input }) => forceSignOutLearner(tx, ctx, input),
});
