import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  activeDevicesOverviewQuerySchema,
  activeDevicesOverviewResponseSchema,
} from "@atlas/domain/reports/active-devices-roster.dto";
import { getActiveDevicesOverviewMetadata } from "@atlas/domain/reports/active-devices-roster.route-metadata";
import { getActiveDevicesOverview } from "@atlas/domain/reports/active-devices-roster.service";

export const GET = createTenantRoute<
  z.output<typeof activeDevicesOverviewQuerySchema>,
  z.output<typeof activeDevicesOverviewResponseSchema>
>({
  metadata: getActiveDevicesOverviewMetadata,
  input: activeDevicesOverviewQuerySchema,
  output: activeDevicesOverviewResponseSchema,
  handler: async ({ tx, ctx, input }) => getActiveDevicesOverview(tx, ctx, input),
});
