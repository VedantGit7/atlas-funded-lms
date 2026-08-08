import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  deleteCouponBodySchema,
  deleteCouponResponseSchema,
} from "../../../../../../../server/sales-coupons/sales-coupons.schemas";
import { mutateCouponsMetadata } from "../../../../../../../server/sales-coupons/sales-coupons.route-metadata";
import { deleteCoupon } from "../../../../../../../server/sales-coupons/sales-coupons.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const POST = createTenantRoute<
  z.output<typeof deleteCouponBodySchema>,
  z.output<typeof deleteCouponResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateCouponsMetadata,
  params: paramsSchema,
  body: deleteCouponBodySchema,
  output: deleteCouponResponseSchema,
  handler: async ({ tx, ctx, params, input }) => deleteCoupon(tx, ctx, params.id, input),
});
