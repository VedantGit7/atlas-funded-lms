import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  affiliateProductsListResponseSchema,
  affiliateProductsQuerySchema,
} from "@atlas/domain/reports/sales-marketing-roster.dto";
import { listSalesMarketingRosterMetadata } from "@atlas/domain/reports/sales-marketing-roster.route-metadata";
import { listAffiliateProductsRoster } from "@atlas/domain/reports/sales-marketing-roster.service";

export const GET = createTenantRoute<
  z.output<typeof affiliateProductsQuerySchema>,
  z.output<typeof affiliateProductsListResponseSchema>
>({
  metadata: listSalesMarketingRosterMetadata,
  input: affiliateProductsQuerySchema,
  output: affiliateProductsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listAffiliateProductsRoster(tx, ctx, input),
});
