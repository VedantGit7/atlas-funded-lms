import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  affiliatesListQuerySchema,
  affiliatesListResponseSchema,
  createAffiliateBodySchema,
  affiliatePartnerResponseSchema,
} from "../../../../../../server/sales-affiliates/sales-affiliates.schemas";
import {
  adminAffiliateReadMetadata,
  adminAffiliateWriteMetadata,
} from "../../../../../../server/sales-affiliates/sales-affiliates.route-metadata";
import {
  createAffiliate,
  listAffiliates,
} from "../../../../../../server/sales-affiliates/sales-affiliates.service";

export const GET = createTenantRoute<
  z.output<typeof affiliatesListQuerySchema>,
  z.output<typeof affiliatesListResponseSchema>
>({
  metadata: adminAffiliateReadMetadata,
  input: affiliatesListQuerySchema,
  output: affiliatesListResponseSchema,
  handler: async ({ tx, ctx, input }) => listAffiliates(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof createAffiliateBodySchema>,
  z.output<typeof affiliatePartnerResponseSchema>
>({
  metadata: adminAffiliateWriteMetadata,
  body: createAffiliateBodySchema,
  output: affiliatePartnerResponseSchema,
  handler: async ({ tx, ctx, input }) => createAffiliate(tx, ctx, input),
});
