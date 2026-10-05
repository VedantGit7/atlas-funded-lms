import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  checkoutPurchaseBodySchema,
  checkoutPurchaseResponseSchema,
} from "../../../../../server/sales-coupons/sales-coupons.schemas";
import { checkoutPurchaseMetadata } from "../../../../../server/sales-coupons/sales-coupons.route-metadata";
import {
  completeCheckoutPurchase,
  planCheckoutPurchase,
  type CheckoutPurchasePlan,
} from "../../../../../server/sales-coupons/sales-coupons.service";

/**
 * Creates (or reuses) the learner's payment order in the request transaction,
 * then opens the gateway session after it commits, so no pooled connection is
 * held across the Stripe or Razorpay call (audit M4).
 */
export const POST = createTenantRoute<
  z.output<typeof checkoutPurchaseBodySchema>,
  CheckoutPurchasePlan
>({
  metadata: checkoutPurchaseMetadata,
  body: checkoutPurchaseBodySchema,
  output: checkoutPurchaseResponseSchema,
  handler: async ({ tx, ctx, input }) => planCheckoutPurchase(tx, ctx, input),
  // Replays rerun this; it returns the session already recorded on the order.
  afterCommitIsIdempotent: true,
  afterCommit: async ({ result, ctx }) => completeCheckoutPurchase(result, ctx),
});
