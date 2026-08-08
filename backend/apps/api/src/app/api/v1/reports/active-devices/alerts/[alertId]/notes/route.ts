import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  activeDevicesAlertNoteBodySchema,
  activeDevicesAlertNoteResponseSchema,
  activeDevicesAlertParamsSchema,
} from "@atlas/domain/reports/active-devices-alerts.dto";
import { addActiveDevicesAlertNoteMetadata } from "@atlas/domain/reports/active-devices-alerts.route-metadata";
import { addActiveDevicesAlertNote } from "@atlas/domain/reports/active-devices-alerts.service";

export const POST = createTenantRoute<
  z.output<typeof activeDevicesAlertNoteBodySchema>,
  z.output<typeof activeDevicesAlertNoteResponseSchema>,
  typeof activeDevicesAlertParamsSchema
>({
  metadata: addActiveDevicesAlertNoteMetadata,
  params: activeDevicesAlertParamsSchema,
  body: activeDevicesAlertNoteBodySchema,
  output: activeDevicesAlertNoteResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    addActiveDevicesAlertNote(tx, ctx, params["alertId"], input),
});
