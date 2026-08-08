import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  salesProductsListResponseSchema,
  salesProductsQuerySchema,
} from "@atlas/domain/reports/sales-marketing-roster.dto";
import { listSalesMarketingRosterMetadata } from "@atlas/domain/reports/sales-marketing-roster.route-metadata";
import { listSalesProducts } from "@atlas/domain/reports/sales-marketing-roster.service";

export const GET = createTenantRoute<
  z.output<typeof salesProductsQuerySchema>,
  z.output<typeof salesProductsListResponseSchema>
>({
  metadata: listSalesMarketingRosterMetadata,
  input: salesProductsQuerySchema,
  output: salesProductsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listSalesProducts(tx, ctx, input),
});
