import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import { affiliatePayoutDetailsResponseSchema } from "../../../../../../../../server/sales-affiliates/sales-affiliates.schemas";
import { adminAffiliatePayoutRevealMetadata } from "../../../../../../../../server/sales-affiliates/sales-affiliates.route-metadata";
import { revealAffiliatePayoutDetails } from "../../../../../../../../server/sales-affiliates/sales-affiliates.service";

const paramsSchema = zod.object({ id: zod.uuid() });

/**
 * Full payout details for paying an affiliate (audit M6). A POST because each
 * reveal is recorded; screens otherwise only ever see masked values.
 */
export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof affiliatePayoutDetailsResponseSchema>,
  typeof paramsSchema
>({
  metadata: adminAffiliatePayoutRevealMetadata,
  params: paramsSchema,
  output: affiliatePayoutDetailsResponseSchema,
  handler: async ({ tx, ctx, params }) => revealAffiliatePayoutDetails(tx, ctx, params["id"]),
});
