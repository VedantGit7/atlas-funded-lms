import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  affiliateDetailQuerySchema,
  affiliateDetailResponseSchema,
  affiliateIdParamsSchema,
} from "@atlas/domain/reports/sales-marketing-roster.dto";
import { listSalesMarketingRosterMetadata } from "@atlas/domain/reports/sales-marketing-roster.route-metadata";
import { getAffiliateDetail } from "@atlas/domain/reports/sales-marketing-roster.service";

export const GET = createTenantRoute<
  z.output<typeof affiliateDetailQuerySchema>,
  z.output<typeof affiliateDetailResponseSchema>,
  typeof affiliateIdParamsSchema
>({
  metadata: listSalesMarketingRosterMetadata,
  input: affiliateDetailQuerySchema,
  params: affiliateIdParamsSchema,
  output: affiliateDetailResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    getAffiliateDetail(tx, ctx, params.affiliateId, input),
});
