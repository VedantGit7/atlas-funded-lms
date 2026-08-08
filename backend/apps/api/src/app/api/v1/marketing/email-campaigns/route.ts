import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createMarketingEmailCampaignBodySchema,
  marketingEmailCampaignResponseSchema,
  marketingEmailCampaignsListQuerySchema,
  marketingEmailCampaignsListResponseSchema,
} from "../../../../../server/marketing-email/marketing-email.schemas";
import {
  listMarketingEmailMetadata,
  mutateMarketingEmailMetadata,
} from "../../../../../server/marketing-email/marketing-email.route-metadata";
import {
  createMarketingEmailCampaign,
  listMarketingEmailCampaigns,
} from "../../../../../server/marketing-email/marketing-email.service";

export const GET = createTenantRoute<
  z.output<typeof marketingEmailCampaignsListQuerySchema>,
  z.output<typeof marketingEmailCampaignsListResponseSchema>
>({
  metadata: listMarketingEmailMetadata,
  input: marketingEmailCampaignsListQuerySchema,
  output: marketingEmailCampaignsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listMarketingEmailCampaigns(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof createMarketingEmailCampaignBodySchema>,
  z.output<typeof marketingEmailCampaignResponseSchema>
>({
  metadata: mutateMarketingEmailMetadata,
  body: createMarketingEmailCampaignBodySchema,
  output: marketingEmailCampaignResponseSchema,
  handler: async ({ tx, ctx, input }) => createMarketingEmailCampaign(tx, ctx, input),
});
