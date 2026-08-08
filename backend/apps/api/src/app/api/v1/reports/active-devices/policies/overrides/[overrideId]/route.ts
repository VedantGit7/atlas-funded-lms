import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  devicePolicyMutationResponseSchema,
  devicePolicyOverrideMutationResponseSchema,
  devicePolicyOverrideParamsSchema,
  updateDevicePolicyOverrideBodySchema,
} from "@atlas/domain/reports/active-devices-policies.dto";
import { mutateDevicePolicyOverrideMetadata } from "@atlas/domain/reports/active-devices-policies.route-metadata";
import {
  deleteDevicePolicyOverride,
  updateDevicePolicyOverride,
} from "@atlas/domain/reports/active-devices-policies.service";

export const PATCH = createTenantRoute<
  z.output<typeof updateDevicePolicyOverrideBodySchema>,
  z.output<typeof devicePolicyOverrideMutationResponseSchema>,
  typeof devicePolicyOverrideParamsSchema
>({
  metadata: mutateDevicePolicyOverrideMetadata,
  params: devicePolicyOverrideParamsSchema,
  body: updateDevicePolicyOverrideBodySchema,
  output: devicePolicyOverrideMutationResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateDevicePolicyOverride(tx, ctx, params["overrideId"], input),
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof devicePolicyMutationResponseSchema>,
  typeof devicePolicyOverrideParamsSchema
>({
  metadata: mutateDevicePolicyOverrideMetadata,
  params: devicePolicyOverrideParamsSchema,
  input: noBodySchema,
  output: devicePolicyMutationResponseSchema,
  handler: async ({ tx, ctx, params }) => deleteDevicePolicyOverride(tx, ctx, params["overrideId"]),
});
