import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  activeDevicesAlertsListResponseSchema,
  activeDevicesAlertsQuerySchema,
} from "@atlas/domain/reports/active-devices-alerts.dto";
import { listActiveDevicesAlertsMetadata } from "@atlas/domain/reports/active-devices-alerts.route-metadata";
import { listActiveDevicesAlerts } from "@atlas/domain/reports/active-devices-alerts.service";

export const GET = createTenantRoute<
  z.output<typeof activeDevicesAlertsQuerySchema>,
  z.output<typeof activeDevicesAlertsListResponseSchema>
>({
  metadata: listActiveDevicesAlertsMetadata,
  input: activeDevicesAlertsQuerySchema,
  output: activeDevicesAlertsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listActiveDevicesAlerts(tx, ctx, input),
});
