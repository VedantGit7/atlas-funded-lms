import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  referralConfigResponseSchema,
  updateReferralConfigBodySchema,
} from "../../../../../../server/sales-referrals/sales-referrals.schemas";
import {
  adminReferralReadMetadata,
  adminReferralWriteMetadata,
} from "../../../../../../server/sales-referrals/sales-referrals.route-metadata";
import {
  getReferralConfig,
  updateReferralConfig,
} from "../../../../../../server/sales-referrals/sales-referrals.service";

export const GET = createTenantRoute<undefined, z.output<typeof referralConfigResponseSchema>>({
  metadata: adminReferralReadMetadata,
  output: referralConfigResponseSchema,
  handler: async ({ tx, ctx }) => getReferralConfig(tx, ctx),
});

export const PUT = createTenantRoute<
  z.output<typeof updateReferralConfigBodySchema>,
  z.output<typeof referralConfigResponseSchema>
>({
  metadata: adminReferralWriteMetadata,
  body: updateReferralConfigBodySchema,
  output: referralConfigResponseSchema,
  handler: async ({ tx, ctx, input }) => updateReferralConfig(tx, ctx, input),
});
