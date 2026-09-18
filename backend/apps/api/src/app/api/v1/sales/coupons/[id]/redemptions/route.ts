import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  couponRedemptionsListResponseSchema,
  couponRedemptionsQuerySchema,
} from "../../../../../../../server/sales-coupons/sales-coupons.schemas";
import { listCouponsMetadata } from "../../../../../../../server/sales-coupons/sales-coupons.route-metadata";
import { listCouponRedemptions } from "../../../../../../../server/sales-coupons/sales-coupons.service";

const paramsSchema = zod.object({ id: zod.uuid() });

export const GET = createTenantRoute<
  z.output<typeof couponRedemptionsQuerySchema>,
  z.output<typeof couponRedemptionsListResponseSchema>,
  typeof paramsSchema
>({
  metadata: listCouponsMetadata,
  params: paramsSchema,
  input: couponRedemptionsQuerySchema,
  output: couponRedemptionsListResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    listCouponRedemptions(tx, ctx, params["id"], input),
});
