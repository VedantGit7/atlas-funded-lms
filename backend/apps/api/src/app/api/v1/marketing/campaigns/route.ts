import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createMarketingCampaignBodySchema,
  marketingCampaignResponseSchema,
  marketingCampaignsListQuerySchema,
  marketingCampaignsListResponseSchema,
} from "../../../../../server/marketing-campaigns/marketing-campaigns.schemas";
import {
  listMarketingCampaignsMetadata,
  mutateMarketingCampaignsMetadata,
} from "../../../../../server/marketing-campaigns/marketing-campaigns.route-metadata";
import {
  createMarketingCampaign,
  listMarketingCampaigns,
} from "../../../../../server/marketing-campaigns/marketing-campaigns.service";

export const GET = createTenantRoute<
  z.output<typeof marketingCampaignsListQuerySchema>,
  z.output<typeof marketingCampaignsListResponseSchema>
>({
  metadata: listMarketingCampaignsMetadata,
  input: marketingCampaignsListQuerySchema,
  output: marketingCampaignsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listMarketingCampaigns(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof createMarketingCampaignBodySchema>,
  z.output<typeof marketingCampaignResponseSchema>
>({
  metadata: mutateMarketingCampaignsMetadata,
  body: createMarketingCampaignBodySchema,
  output: marketingCampaignResponseSchema,
  handler: async ({ tx, ctx, input }) => createMarketingCampaign(tx, ctx, input),
});
