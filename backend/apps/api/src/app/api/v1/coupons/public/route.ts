import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  publicCouponsForCourseQuerySchema,
  publicCouponsForCourseResponseSchema,
} from "../../../../../server/sales-coupons/sales-coupons.schemas";
import { learnerCouponReadMetadata } from "../../../../../server/sales-coupons/sales-coupons.route-metadata";
import { listPublicCouponsForCourse } from "../../../../../server/sales-coupons/checkout-pricing";

export const GET = createTenantRoute<
  z.output<typeof publicCouponsForCourseQuerySchema>,
  z.output<typeof publicCouponsForCourseResponseSchema>
>({
  metadata: learnerCouponReadMetadata,
  input: publicCouponsForCourseQuerySchema,
  output: publicCouponsForCourseResponseSchema,
  handler: async ({ tx, ctx, input }) => listPublicCouponsForCourse(tx, ctx, input),
});
