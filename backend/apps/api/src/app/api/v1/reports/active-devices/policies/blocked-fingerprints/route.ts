import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createBlockedFingerprintBodySchema,
  deviceBlockedFingerprintMutationResponseSchema,
} from "@atlas/domain/reports/active-devices-policies.dto";
import { mutateBlockedFingerprintMetadata } from "@atlas/domain/reports/active-devices-policies.route-metadata";
import { createBlockedFingerprint } from "@atlas/domain/reports/active-devices-policies.service";

export const POST = createTenantRoute<
  z.output<typeof createBlockedFingerprintBodySchema>,
  z.output<typeof deviceBlockedFingerprintMutationResponseSchema>
>({
  metadata: mutateBlockedFingerprintMetadata,
  body: createBlockedFingerprintBodySchema,
  output: deviceBlockedFingerprintMutationResponseSchema,
  handler: async ({ tx, ctx, input }) => createBlockedFingerprint(tx, ctx, input),
});
