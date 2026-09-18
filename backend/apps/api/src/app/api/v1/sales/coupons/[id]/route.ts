import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  couponResponseSchema,
  updateCouponBodySchema,
} from "../../../../../../server/sales-coupons/sales-coupons.schemas";
import {
  listCouponsMetadata,
  mutateCouponsMetadata,
} from "../../../../../../server/sales-coupons/sales-coupons.route-metadata";
import {
  getCoupon,
  updateCoupon,
} from "../../../../../../server/sales-coupons/sales-coupons.service";

const paramsSchema = zod.object({ id: zod.uuid() });

export const GET = createTenantRoute<
  undefined,
  z.output<typeof couponResponseSchema>,
  typeof paramsSchema
>({
  metadata: listCouponsMetadata,
  params: paramsSchema,
  output: couponResponseSchema,
  handler: async ({ tx, ctx, params }) => getCoupon(tx, ctx, params["id"]),
});

export const PATCH = createTenantRoute<
  z.output<typeof updateCouponBodySchema>,
  z.output<typeof couponResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateCouponsMetadata,
  params: paramsSchema,
  body: updateCouponBodySchema,
  output: couponResponseSchema,
  handler: async ({ tx, ctx, params, input }) => updateCoupon(tx, ctx, params["id"], input),
});
