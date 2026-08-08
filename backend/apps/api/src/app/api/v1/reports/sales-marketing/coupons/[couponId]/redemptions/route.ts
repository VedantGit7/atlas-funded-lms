import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  couponIdParamsSchema,
  couponRedemptionsListResponseSchema,
  couponRedemptionsQuerySchema,
} from "@atlas/domain/reports/sales-marketing-roster.dto";
import { listSalesMarketingRosterMetadata } from "@atlas/domain/reports/sales-marketing-roster.route-metadata";
import { listCouponRedemptions } from "@atlas/domain/reports/sales-marketing-roster.service";

export const GET = createTenantRoute<
  z.output<typeof couponRedemptionsQuerySchema>,
  z.output<typeof couponRedemptionsListResponseSchema>,
  typeof couponIdParamsSchema
>({
  metadata: listSalesMarketingRosterMetadata,
  input: couponRedemptionsQuerySchema,
  params: couponIdParamsSchema,
  output: couponRedemptionsListResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    listCouponRedemptions(tx, ctx, params.couponId, input),
});
