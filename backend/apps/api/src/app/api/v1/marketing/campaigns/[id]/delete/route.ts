import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  deleteMarketingCampaignBodySchema,
  deleteMarketingCampaignResponseSchema,
} from "../../../../../../../server/marketing-campaigns/marketing-campaigns.schemas";
import { mutateMarketingCampaignsMetadata } from "../../../../../../../server/marketing-campaigns/marketing-campaigns.route-metadata";
import { deleteMarketingCampaign } from "../../../../../../../server/marketing-campaigns/marketing-campaigns.service";

const paramsSchema = zod.object({ id: zod.uuid() });

export const POST = createTenantRoute<
  z.output<typeof deleteMarketingCampaignBodySchema>,
  z.output<typeof deleteMarketingCampaignResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingCampaignsMetadata,
  params: paramsSchema,
  body: deleteMarketingCampaignBodySchema,
  output: deleteMarketingCampaignResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    deleteMarketingCampaign(tx, ctx, params["id"], input),
});
