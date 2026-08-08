import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createCouponBodySchema,
  couponResponseSchema,
  couponsListQuerySchema,
  couponsListResponseSchema,
} from "../../../../../server/sales-coupons/sales-coupons.schemas";
import {
  listCouponsMetadata,
  mutateCouponsMetadata,
} from "../../../../../server/sales-coupons/sales-coupons.route-metadata";
import {
  createCoupon,
  listCoupons,
} from "../../../../../server/sales-coupons/sales-coupons.service";

export const GET = createTenantRoute<
  z.output<typeof couponsListQuerySchema>,
  z.output<typeof couponsListResponseSchema>
>({
  metadata: listCouponsMetadata,
  input: couponsListQuerySchema,
  output: couponsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listCoupons(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof createCouponBodySchema>,
  z.output<typeof couponResponseSchema>
>({
  metadata: mutateCouponsMetadata,
  body: createCouponBodySchema,
  output: couponResponseSchema,
  handler: async ({ tx, ctx, input }) => createCoupon(tx, ctx, input),
});
