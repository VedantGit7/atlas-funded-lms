import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { myReferralResponseSchema } from "../../../../../server/sales-referrals/sales-referrals.schemas";
import { learnerReferralReadMetadata } from "../../../../../server/sales-referrals/sales-referrals.route-metadata";
import { getMyReferral } from "../../../../../server/sales-referrals/sales-referrals.service";

export const GET = createTenantRoute<undefined, z.output<typeof myReferralResponseSchema>>({
  metadata: learnerReferralReadMetadata,
  output: myReferralResponseSchema,
  handler: async ({ tx, ctx }) => getMyReferral(tx, ctx),
});
