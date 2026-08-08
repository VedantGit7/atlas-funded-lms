import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  checkoutPurchaseBodySchema,
  checkoutPurchaseResponseSchema,
} from "../../../../../server/sales-coupons/sales-coupons.schemas";
import { learnerCouponMetadata } from "../../../../../server/sales-coupons/sales-coupons.route-metadata";
import { purchaseCheckout } from "../../../../../server/sales-coupons/sales-coupons.service";

export const POST = createTenantRoute<
  z.output<typeof checkoutPurchaseBodySchema>,
  z.output<typeof checkoutPurchaseResponseSchema>
>({
  metadata: learnerCouponMetadata,
  body: checkoutPurchaseBodySchema,
  output: checkoutPurchaseResponseSchema,
  handler: async ({ tx, ctx, input }) => purchaseCheckout(tx, ctx, input),
});
