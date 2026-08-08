import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  activeDevicesAlertDetailResponseSchema,
  activeDevicesAlertParamsSchema,
} from "@atlas/domain/reports/active-devices-alerts.dto";
import { getActiveDevicesAlertDetailMetadata } from "@atlas/domain/reports/active-devices-alerts.route-metadata";
import { getActiveDevicesAlertDetail } from "@atlas/domain/reports/active-devices-alerts.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof activeDevicesAlertDetailResponseSchema>,
  typeof activeDevicesAlertParamsSchema
>({
  metadata: getActiveDevicesAlertDetailMetadata,
  params: activeDevicesAlertParamsSchema,
  output: activeDevicesAlertDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getActiveDevicesAlertDetail(tx, ctx, params.alertId),
});
