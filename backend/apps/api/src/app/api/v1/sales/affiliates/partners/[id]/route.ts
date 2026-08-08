import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  affiliatePartnerResponseSchema,
  updateAffiliateBodySchema,
} from "../../../../../../../server/sales-affiliates/sales-affiliates.schemas";
import { adminAffiliateWriteMetadata } from "../../../../../../../server/sales-affiliates/sales-affiliates.route-metadata";
import { updateAffiliate } from "../../../../../../../server/sales-affiliates/sales-affiliates.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const PUT = createTenantRoute<
  z.output<typeof updateAffiliateBodySchema>,
  z.output<typeof affiliatePartnerResponseSchema>,
  typeof paramsSchema
>({
  metadata: adminAffiliateWriteMetadata,
  params: paramsSchema,
  body: updateAffiliateBodySchema,
  output: affiliatePartnerResponseSchema,
  handler: async ({ tx, ctx, input, params }) => updateAffiliate(tx, ctx, params.id, input),
});
