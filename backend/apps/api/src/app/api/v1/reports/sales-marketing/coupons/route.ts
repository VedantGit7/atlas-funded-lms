import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  couponsListQuerySchema,
  couponsListResponseSchema,
} from "@atlas/domain/reports/sales-marketing-roster.dto";
import { listSalesMarketingRosterMetadata } from "@atlas/domain/reports/sales-marketing-roster.route-metadata";
import { listSalesCoupons } from "@atlas/domain/reports/sales-marketing-roster.service";

export const GET = createTenantRoute<
  z.output<typeof couponsListQuerySchema>,
  z.output<typeof couponsListResponseSchema>
>({
  metadata: listSalesMarketingRosterMetadata,
  input: couponsListQuerySchema,
  output: couponsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listSalesCoupons(tx, ctx, input),
});
