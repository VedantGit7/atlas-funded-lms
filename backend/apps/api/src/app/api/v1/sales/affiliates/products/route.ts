import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  affiliateProductsResponseSchema,
  upsertAffiliateProductBodySchema,
} from "../../../../../../server/sales-affiliates/sales-affiliates.schemas";
import {
  adminAffiliateReadMetadata,
  adminAffiliateWriteMetadata,
} from "../../../../../../server/sales-affiliates/sales-affiliates.route-metadata";
import {
  listAffiliateProducts,
  upsertAffiliateProduct,
} from "../../../../../../server/sales-affiliates/sales-affiliates.service";

export const GET = createTenantRoute<undefined, z.output<typeof affiliateProductsResponseSchema>>({
  metadata: adminAffiliateReadMetadata,
  output: affiliateProductsResponseSchema,
  handler: async ({ tx, ctx }) => listAffiliateProducts(tx, ctx),
});

export const PUT = createTenantRoute<
  z.output<typeof upsertAffiliateProductBodySchema>,
  z.output<typeof affiliateProductsResponseSchema>
>({
  metadata: adminAffiliateWriteMetadata,
  body: upsertAffiliateProductBodySchema,
  output: affiliateProductsResponseSchema,
  handler: async ({ tx, ctx, input }) => upsertAffiliateProduct(tx, ctx, input),
});
