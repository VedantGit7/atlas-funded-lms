import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  activeDevicesAlertActionBodySchema,
  activeDevicesAlertActionResponseSchema,
} from "@atlas/domain/reports/active-devices-alerts.dto";
import { dismissActiveDevicesAlertsMetadata } from "@atlas/domain/reports/active-devices-alerts.route-metadata";
import { dismissActiveDevicesAlerts } from "@atlas/domain/reports/active-devices-alerts.service";

export const POST = createTenantRoute<
  z.output<typeof activeDevicesAlertActionBodySchema>,
  z.output<typeof activeDevicesAlertActionResponseSchema>
>({
  metadata: dismissActiveDevicesAlertsMetadata,
  body: activeDevicesAlertActionBodySchema,
  output: activeDevicesAlertActionResponseSchema,
  handler: async ({ tx, ctx, input }) => dismissActiveDevicesAlerts(tx, ctx, input),
});
