import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  activeDevicesRosterListResponseSchema,
  activeDevicesRosterQuerySchema,
} from "@atlas/domain/reports/active-devices-roster.dto";
import { listActiveDevicesRosterMetadata } from "@atlas/domain/reports/active-devices-roster.route-metadata";
import {
  listActiveDevicesRoster,
} from "@atlas/domain/reports/active-devices-roster.service";

export const GET = createTenantRoute<
  z.output<typeof activeDevicesRosterQuerySchema>,
  z.output<typeof activeDevicesRosterListResponseSchema>
>({
  metadata: listActiveDevicesRosterMetadata,
  input: activeDevicesRosterQuerySchema,
  output: activeDevicesRosterListResponseSchema,
  handler: async ({ tx, ctx, input }) => listActiveDevicesRoster(tx, ctx, input),
});
