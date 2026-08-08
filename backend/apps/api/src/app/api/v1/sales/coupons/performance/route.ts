import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  couponPerformanceQuerySchema,
  couponPerformanceResponseSchema,
} from "../../../../../../server/sales-coupons/sales-coupons.schemas";
import { listCouponsMetadata } from "../../../../../../server/sales-coupons/sales-coupons.route-metadata";
import { getCouponPerformance } from "../../../../../../server/sales-coupons/sales-coupons.service";

export const GET = createTenantRoute<
  z.output<typeof couponPerformanceQuerySchema>,
  z.output<typeof couponPerformanceResponseSchema>
>({
  metadata: listCouponsMetadata,
  input: couponPerformanceQuerySchema,
  output: couponPerformanceResponseSchema,
  handler: async ({ tx, ctx, input }) => getCouponPerformance(tx, ctx, input),
});
