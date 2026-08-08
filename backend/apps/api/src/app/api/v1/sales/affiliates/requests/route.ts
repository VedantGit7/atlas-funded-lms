import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  affiliateRequestsListQuerySchema,
  affiliateRequestsListResponseSchema,
} from "../../../../../../server/sales-affiliates/sales-affiliates.schemas";
import { adminAffiliateReadMetadata } from "../../../../../../server/sales-affiliates/sales-affiliates.route-metadata";
import { listAffiliateRequests } from "../../../../../../server/sales-affiliates/sales-affiliates.service";

export const GET = createTenantRoute<
  z.output<typeof affiliateRequestsListQuerySchema>,
  z.output<typeof affiliateRequestsListResponseSchema>
>({
  metadata: adminAffiliateReadMetadata,
  input: affiliateRequestsListQuerySchema,
  output: affiliateRequestsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listAffiliateRequests(tx, ctx, input),
});
