import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  affiliatePayoutsListQuerySchema,
  affiliatePayoutsListResponseSchema,
  markAffiliatePayoutPaidBodySchema,
  markAffiliatePayoutPaidResponseSchema,
} from "../../../../../../server/sales-affiliates/sales-affiliates.schemas";
import {
  adminAffiliateReadMetadata,
  adminAffiliateWriteMetadata,
} from "../../../../../../server/sales-affiliates/sales-affiliates.route-metadata";
import {
  listAffiliatePayouts,
  markAffiliatePayoutPaid,
} from "../../../../../../server/sales-affiliates/sales-affiliates.service";

export const GET = createTenantRoute<
  z.output<typeof affiliatePayoutsListQuerySchema>,
  z.output<typeof affiliatePayoutsListResponseSchema>
>({
  metadata: adminAffiliateReadMetadata,
  input: affiliatePayoutsListQuerySchema,
  output: affiliatePayoutsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listAffiliatePayouts(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof markAffiliatePayoutPaidBodySchema>,
  z.output<typeof markAffiliatePayoutPaidResponseSchema>
>({
  metadata: adminAffiliateWriteMetadata,
  body: markAffiliatePayoutPaidBodySchema,
  output: markAffiliatePayoutPaidResponseSchema,
  handler: async ({ tx, ctx, input }) => markAffiliatePayoutPaid(tx, ctx, input),
});
