import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  activeDevicesPoliciesResponseSchema,
  updateActiveDevicesPoliciesBodySchema,
} from "@atlas/domain/reports/active-devices-policies.dto";
import {
  getActiveDevicesPoliciesMetadata,
  updateActiveDevicesPoliciesMetadata,
} from "@atlas/domain/reports/active-devices-policies.route-metadata";
import {
  getActiveDevicesPolicies,
  updateActiveDevicesPolicies,
} from "@atlas/domain/reports/active-devices-policies.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof activeDevicesPoliciesResponseSchema>
>({
  metadata: getActiveDevicesPoliciesMetadata,
  input: noBodySchema,
  output: activeDevicesPoliciesResponseSchema,
  handler: async ({ tx, ctx }) => getActiveDevicesPolicies(tx, ctx),
});

export const PATCH = createTenantRoute<
  z.output<typeof updateActiveDevicesPoliciesBodySchema>,
  z.output<typeof activeDevicesPoliciesResponseSchema>
>({
  metadata: updateActiveDevicesPoliciesMetadata,
  body: updateActiveDevicesPoliciesBodySchema,
  output: activeDevicesPoliciesResponseSchema,
  handler: async ({ tx, ctx, input }) => updateActiveDevicesPolicies(tx, ctx, input),
});
