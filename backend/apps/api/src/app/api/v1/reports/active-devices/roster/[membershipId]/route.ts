import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  activeDevicesLearnerDetailResponseSchema,
  activeDevicesLearnerParamsSchema,
} from "@atlas/domain/reports/active-devices-roster.dto";
import { getActiveDevicesLearnerDetailMetadata } from "@atlas/domain/reports/active-devices-roster.route-metadata";
import { getActiveDevicesLearnerDetail } from "@atlas/domain/reports/active-devices-roster.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof activeDevicesLearnerDetailResponseSchema>,
  typeof activeDevicesLearnerParamsSchema
>({
  metadata: getActiveDevicesLearnerDetailMetadata,
  params: activeDevicesLearnerParamsSchema,
  output: activeDevicesLearnerDetailResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    getActiveDevicesLearnerDetail(tx, ctx, params["membershipId"]),
});
