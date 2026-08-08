import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  affiliateConfigResponseSchema,
  updateAffiliateConfigBodySchema,
} from "../../../../../../server/sales-affiliates/sales-affiliates.schemas";
import {
  adminAffiliateReadMetadata,
  adminAffiliateWriteMetadata,
} from "../../../../../../server/sales-affiliates/sales-affiliates.route-metadata";
import {
  getAffiliateConfig,
  updateAffiliateConfig,
} from "../../../../../../server/sales-affiliates/sales-affiliates.service";

export const GET = createTenantRoute<undefined, z.output<typeof affiliateConfigResponseSchema>>({
  metadata: adminAffiliateReadMetadata,
  output: affiliateConfigResponseSchema,
  handler: async ({ tx, ctx }) => getAffiliateConfig(tx, ctx),
});

export const PUT = createTenantRoute<
  z.output<typeof updateAffiliateConfigBodySchema>,
  z.output<typeof affiliateConfigResponseSchema>
>({
  metadata: adminAffiliateWriteMetadata,
  body: updateAffiliateConfigBodySchema,
  output: affiliateConfigResponseSchema,
  handler: async ({ tx, ctx, input }) => updateAffiliateConfig(tx, ctx, input),
});
