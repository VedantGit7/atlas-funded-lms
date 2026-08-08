import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  referredLearnersListResponseSchema,
  referredLearnersQuerySchema,
  referrerMembershipIdParamsSchema,
} from "@atlas/domain/reports/sales-marketing-roster.dto";
import { listSalesMarketingRosterMetadata } from "@atlas/domain/reports/sales-marketing-roster.route-metadata";
import { listReferredLearners } from "@atlas/domain/reports/sales-marketing-roster.service";

export const GET = createTenantRoute<
  z.output<typeof referredLearnersQuerySchema>,
  z.output<typeof referredLearnersListResponseSchema>,
  typeof referrerMembershipIdParamsSchema
>({
  metadata: listSalesMarketingRosterMetadata,
  input: referredLearnersQuerySchema,
  params: referrerMembershipIdParamsSchema,
  output: referredLearnersListResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    listReferredLearners(tx, ctx, params["membershipId"], input),
});
