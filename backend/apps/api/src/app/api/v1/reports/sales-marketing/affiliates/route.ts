import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  affiliatesListResponseSchema,
  affiliatesQuerySchema,
} from "@atlas/domain/reports/sales-marketing-roster.dto";
import { listSalesMarketingRosterMetadata } from "@atlas/domain/reports/sales-marketing-roster.route-metadata";
import { listAffiliatesRoster } from "@atlas/domain/reports/sales-marketing-roster.service";

export const GET = createTenantRoute<
  z.output<typeof affiliatesQuerySchema>,
  z.output<typeof affiliatesListResponseSchema>
>({
  metadata: listSalesMarketingRosterMetadata,
  input: affiliatesQuerySchema,
  output: affiliatesListResponseSchema,
  handler: async ({ tx, ctx, input }) => listAffiliatesRoster(tx, ctx, input),
});
