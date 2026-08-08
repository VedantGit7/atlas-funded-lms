import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  salesMarketingOverviewQuerySchema,
  salesMarketingOverviewResponseSchema,
} from "@atlas/domain/reports/sales-marketing-roster.dto";
import { listSalesMarketingRosterMetadata } from "@atlas/domain/reports/sales-marketing-roster.route-metadata";
import { getSalesMarketingOverview } from "@atlas/domain/reports/sales-marketing-roster.service";

export const GET = createTenantRoute<
  z.output<typeof salesMarketingOverviewQuerySchema>,
  z.output<typeof salesMarketingOverviewResponseSchema>
>({
  metadata: listSalesMarketingRosterMetadata,
  input: salesMarketingOverviewQuerySchema,
  output: salesMarketingOverviewResponseSchema,
  handler: async ({ tx, ctx, input }) => getSalesMarketingOverview(tx, ctx, input),
});
