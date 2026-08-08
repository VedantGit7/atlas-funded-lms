import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  blockedFingerprintParamsSchema,
  devicePolicyMutationResponseSchema,
} from "@atlas/domain/reports/active-devices-policies.dto";
import { mutateBlockedFingerprintMetadata } from "@atlas/domain/reports/active-devices-policies.route-metadata";
import { unblockFingerprint } from "@atlas/domain/reports/active-devices-policies.service";

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof devicePolicyMutationResponseSchema>,
  typeof blockedFingerprintParamsSchema
>({
  metadata: mutateBlockedFingerprintMetadata,
  params: blockedFingerprintParamsSchema,
  input: noBodySchema,
  output: devicePolicyMutationResponseSchema,
  handler: async ({ tx, ctx, params }) => unblockFingerprint(tx, ctx, params["blockId"]),
});
