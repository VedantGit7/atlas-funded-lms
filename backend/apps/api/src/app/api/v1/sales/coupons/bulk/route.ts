import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createBulkCouponsBodySchema,
  createBulkCouponsResponseSchema,
} from "../../../../../../server/sales-coupons/sales-coupons.schemas";
import { mutateCouponsMetadata } from "../../../../../../server/sales-coupons/sales-coupons.route-metadata";
import { createBulkCoupons } from "../../../../../../server/sales-coupons/sales-coupons.service";

export const POST = createTenantRoute<
  z.output<typeof createBulkCouponsBodySchema>,
  z.output<typeof createBulkCouponsResponseSchema>
>({
  metadata: mutateCouponsMetadata,
  body: createBulkCouponsBodySchema,
  output: createBulkCouponsResponseSchema,
  handler: async ({ tx, ctx, input }) => createBulkCoupons(tx, ctx, input),
});
