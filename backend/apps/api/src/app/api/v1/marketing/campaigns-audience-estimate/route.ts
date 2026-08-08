import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  marketingCampaignAudienceEstimateQuerySchema,
  marketingCampaignAudienceEstimateResponseSchema,
} from "../../../../../server/marketing-campaigns/marketing-campaigns.schemas";
import { listMarketingCampaignsMetadata } from "../../../../../server/marketing-campaigns/marketing-campaigns.route-metadata";
import { estimateMarketingCampaignAudience } from "../../../../../server/marketing-campaigns/marketing-campaigns.service";

export const GET = createTenantRoute<
  z.output<typeof marketingCampaignAudienceEstimateQuerySchema>,
  z.output<typeof marketingCampaignAudienceEstimateResponseSchema>
>({
  metadata: listMarketingCampaignsMetadata,
  input: marketingCampaignAudienceEstimateQuerySchema,
  output: marketingCampaignAudienceEstimateResponseSchema,
  handler: async ({ tx, ctx, input }) =>
    estimateMarketingCampaignAudience(tx, ctx, input),
});
