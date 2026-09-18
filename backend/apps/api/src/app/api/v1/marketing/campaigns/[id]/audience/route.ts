import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  marketingCampaignResponseSchema,
  setMarketingCampaignAudienceBodySchema,
} from "../../../../../../../server/marketing-campaigns/marketing-campaigns.schemas";
import { mutateMarketingCampaignsMetadata } from "../../../../../../../server/marketing-campaigns/marketing-campaigns.route-metadata";
import { setMarketingCampaignAudience } from "../../../../../../../server/marketing-campaigns/marketing-campaigns.service";

const paramsSchema = zod.object({ id: zod.uuid() });

export const POST = createTenantRoute<
  z.output<typeof setMarketingCampaignAudienceBodySchema>,
  z.output<typeof marketingCampaignResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingCampaignsMetadata,
  params: paramsSchema,
  body: setMarketingCampaignAudienceBodySchema,
  output: marketingCampaignResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    setMarketingCampaignAudience(tx, ctx, params["id"], input),
});
