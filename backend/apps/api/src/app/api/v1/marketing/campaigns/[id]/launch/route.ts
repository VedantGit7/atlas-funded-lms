import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  launchMarketingCampaignBodySchema,
  marketingCampaignResponseSchema,
} from "../../../../../../../server/marketing-campaigns/marketing-campaigns.schemas";
import { mutateMarketingCampaignsMetadata } from "../../../../../../../server/marketing-campaigns/marketing-campaigns.route-metadata";
import { launchMarketingCampaign } from "../../../../../../../server/marketing-campaigns/marketing-campaigns.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const POST = createTenantRoute<
  z.output<typeof launchMarketingCampaignBodySchema>,
  z.output<typeof marketingCampaignResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingCampaignsMetadata,
  params: paramsSchema,
  body: launchMarketingCampaignBodySchema,
  output: marketingCampaignResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    launchMarketingCampaign(tx, ctx, params.id, input),
});
