import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { affiliateSummaryResponseSchema } from "../../../../../../server/sales-affiliates/sales-affiliates.schemas";
import { adminAffiliateReadMetadata } from "../../../../../../server/sales-affiliates/sales-affiliates.route-metadata";
import { getAffiliateSummary } from "../../../../../../server/sales-affiliates/sales-affiliates.service";

export const GET = createTenantRoute<undefined, z.output<typeof affiliateSummaryResponseSchema>>({
  metadata: adminAffiliateReadMetadata,
  output: affiliateSummaryResponseSchema,
  handler: async ({ tx, ctx }) => getAffiliateSummary(tx, ctx),
});
