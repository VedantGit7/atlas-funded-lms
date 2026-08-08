import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { z as zod } from "zod";
import { couponResponseSchema } from "../../../../../../../server/sales-coupons/sales-coupons.schemas";
import { mutateCouponsMetadata } from "../../../../../../../server/sales-coupons/sales-coupons.route-metadata";
import { deactivateCoupon } from "../../../../../../../server/sales-coupons/sales-coupons.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof couponResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateCouponsMetadata,
  params: paramsSchema,
  body: noBodySchema,
  output: couponResponseSchema,
  handler: async ({ tx, ctx, params }) => deactivateCoupon(tx, ctx, params["id"]),
});
