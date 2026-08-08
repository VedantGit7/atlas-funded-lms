import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  validateCouponBodySchema,
  validateCouponResponseSchema,
} from "../../../../../server/sales-coupons/sales-coupons.schemas";
import { learnerCouponMetadata } from "../../../../../server/sales-coupons/sales-coupons.route-metadata";
import { validateCouponForLearner } from "../../../../../server/sales-coupons/sales-coupons.service";

export const POST = createTenantRoute<
  z.output<typeof validateCouponBodySchema>,
  z.output<typeof validateCouponResponseSchema>
>({
  metadata: learnerCouponMetadata,
  body: validateCouponBodySchema,
  output: validateCouponResponseSchema,
  handler: async ({ tx, ctx, input }) => validateCouponForLearner(tx, ctx, input),
});
