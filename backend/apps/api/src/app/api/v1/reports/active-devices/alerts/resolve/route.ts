import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  activeDevicesAlertActionBodySchema,
  activeDevicesAlertActionResponseSchema,
} from "@atlas/domain/reports/active-devices-alerts.dto";
import { resolveActiveDevicesAlertsMetadata } from "@atlas/domain/reports/active-devices-alerts.route-metadata";
import { resolveActiveDevicesAlerts } from "@atlas/domain/reports/active-devices-alerts.service";

export const POST = createTenantRoute<
  z.output<typeof activeDevicesAlertActionBodySchema>,
  z.output<typeof activeDevicesAlertActionResponseSchema>
>({
  metadata: resolveActiveDevicesAlertsMetadata,
  body: activeDevicesAlertActionBodySchema,
  output: activeDevicesAlertActionResponseSchema,
  handler: async ({ tx, ctx, input }) => resolveActiveDevicesAlerts(tx, ctx, input),
});
