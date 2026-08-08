import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  devicePolicyTargetsQuerySchema,
  devicePolicyTargetsResponseSchema,
} from "@atlas/domain/reports/active-devices-policies.dto";
import { searchDevicePolicyTargetsMetadata } from "@atlas/domain/reports/active-devices-policies.route-metadata";
import { searchDevicePolicyTargets } from "@atlas/domain/reports/active-devices-policies.service";

export const GET = createTenantRoute<
  z.output<typeof devicePolicyTargetsQuerySchema>,
  z.output<typeof devicePolicyTargetsResponseSchema>
>({
  metadata: searchDevicePolicyTargetsMetadata,
  input: devicePolicyTargetsQuerySchema,
  output: devicePolicyTargetsResponseSchema,
  handler: async ({ tx, ctx, input }) => searchDevicePolicyTargets(tx, ctx, input),
});
