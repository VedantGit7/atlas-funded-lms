import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createDevicePolicyOverrideBodySchema,
  devicePolicyOverrideMutationResponseSchema,
} from "@atlas/domain/reports/active-devices-policies.dto";
import { mutateDevicePolicyOverrideMetadata } from "@atlas/domain/reports/active-devices-policies.route-metadata";
import { createDevicePolicyOverride } from "@atlas/domain/reports/active-devices-policies.service";

export const POST = createTenantRoute<
  z.output<typeof createDevicePolicyOverrideBodySchema>,
  z.output<typeof devicePolicyOverrideMutationResponseSchema>
>({
  metadata: mutateDevicePolicyOverrideMetadata,
  body: createDevicePolicyOverrideBodySchema,
  output: devicePolicyOverrideMutationResponseSchema,
  handler: async ({ tx, ctx, input }) => createDevicePolicyOverride(tx, ctx, input),
});
