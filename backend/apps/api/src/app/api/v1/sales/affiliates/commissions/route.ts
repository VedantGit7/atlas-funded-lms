import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  affiliateCommissionsListQuerySchema,
  affiliateCommissionsListResponseSchema,
} from "../../../../../../server/sales-affiliates/sales-affiliates.schemas";
import { adminAffiliateReadMetadata } from "../../../../../../server/sales-affiliates/sales-affiliates.route-metadata";
import { listAffiliateCommissions } from "../../../../../../server/sales-affiliates/sales-affiliates.service";

export const GET = createTenantRoute<
  z.output<typeof affiliateCommissionsListQuerySchema>,
  z.output<typeof affiliateCommissionsListResponseSchema>
>({
  metadata: adminAffiliateReadMetadata,
  input: affiliateCommissionsListQuerySchema,
  output: affiliateCommissionsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listAffiliateCommissions(tx, ctx, input),
});
