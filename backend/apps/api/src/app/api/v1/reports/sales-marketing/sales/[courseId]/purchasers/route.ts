import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  salesCourseIdParamsSchema,
  salesPurchasersListResponseSchema,
  salesPurchasersQuerySchema,
} from "@atlas/domain/reports/sales-marketing-roster.dto";
import { listSalesMarketingRosterMetadata } from "@atlas/domain/reports/sales-marketing-roster.route-metadata";
import { listSalesPurchasers } from "@atlas/domain/reports/sales-marketing-roster.service";

export const GET = createTenantRoute<
  z.output<typeof salesPurchasersQuerySchema>,
  z.output<typeof salesPurchasersListResponseSchema>,
  typeof salesCourseIdParamsSchema
>({
  metadata: listSalesMarketingRosterMetadata,
  input: salesPurchasersQuerySchema,
  params: salesCourseIdParamsSchema,
  output: salesPurchasersListResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    listSalesPurchasers(tx, ctx, params["courseId"], input),
});
