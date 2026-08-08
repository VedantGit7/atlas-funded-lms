import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  referralStatsQuerySchema,
  referralStatsResponseSchema,
} from "../../../../../../server/sales-referrals/sales-referrals.schemas";
import { adminReferralReadMetadata } from "../../../../../../server/sales-referrals/sales-referrals.route-metadata";
import { listReferralStats } from "../../../../../../server/sales-referrals/sales-referrals.service";

export const GET = createTenantRoute<
  z.output<typeof referralStatsQuerySchema>,
  z.output<typeof referralStatsResponseSchema>
>({
  metadata: adminReferralReadMetadata,
  input: referralStatsQuerySchema,
  output: referralStatsResponseSchema,
  handler: async ({ tx, ctx, input }) => listReferralStats(tx, ctx, input),
});
