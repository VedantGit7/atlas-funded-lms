import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  reviewAffiliateRequestBodySchema,
  reviewAffiliateRequestResponseSchema,
} from "../../../../../../../../server/sales-affiliates/sales-affiliates.schemas";
import { adminAffiliateWriteMetadata } from "../../../../../../../../server/sales-affiliates/sales-affiliates.route-metadata";
import { reviewAffiliateRequest } from "../../../../../../../../server/sales-affiliates/sales-affiliates.service";

const paramsSchema = zod.object({ id: zod.uuid() });

export const POST = createTenantRoute<
  z.output<typeof reviewAffiliateRequestBodySchema>,
  z.output<typeof reviewAffiliateRequestResponseSchema>,
  typeof paramsSchema
>({
  metadata: adminAffiliateWriteMetadata,
  params: paramsSchema,
  body: reviewAffiliateRequestBodySchema,
  output: reviewAffiliateRequestResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    reviewAffiliateRequest(tx, ctx, params["id"], input),
});
