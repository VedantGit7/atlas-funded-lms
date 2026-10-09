import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  checkoutQuoteBodySchema,
  checkoutQuoteResponseSchema,
} from "../../../../../server/sales-coupons/sales-coupons.schemas";
import { learnerCouponMetadata } from "../../../../../server/sales-coupons/sales-coupons.route-metadata";
import { quoteCheckout } from "../../../../../server/sales-coupons/checkout-pricing";

export const POST = createTenantRoute<
  z.output<typeof checkoutQuoteBodySchema>,
  z.output<typeof checkoutQuoteResponseSchema>
>({
  metadata: learnerCouponMetadata,
  body: checkoutQuoteBodySchema,
  output: checkoutQuoteResponseSchema,
  handler: async ({ tx, ctx, input }) => quoteCheckout(tx, ctx, input),
});
