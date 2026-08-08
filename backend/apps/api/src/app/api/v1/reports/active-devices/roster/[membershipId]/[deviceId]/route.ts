import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  activeDevicesSessionDetailResponseSchema,
  activeDevicesSessionParamsSchema,
} from "@atlas/domain/reports/active-devices-roster.dto";
import { getActiveDevicesSessionDetailMetadata } from "@atlas/domain/reports/active-devices-roster.route-metadata";
import { getActiveDevicesSessionDetail } from "@atlas/domain/reports/active-devices-roster.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof activeDevicesSessionDetailResponseSchema>,
  typeof activeDevicesSessionParamsSchema
>({
  metadata: getActiveDevicesSessionDetailMetadata,
  params: activeDevicesSessionParamsSchema,
  output: activeDevicesSessionDetailResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    getActiveDevicesSessionDetail(tx, ctx, params["membershipId"], params["deviceId"]),
});
