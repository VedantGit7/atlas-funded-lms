import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import { marketingCampaignAnalyticsResponseSchema } from "../../../../../../../server/marketing-campaigns/marketing-campaigns.schemas";
import { listMarketingCampaignsMetadata } from "../../../../../../../server/marketing-campaigns/marketing-campaigns.route-metadata";
import { getMarketingCampaignAnalytics } from "../../../../../../../server/marketing-campaigns/marketing-campaigns.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof marketingCampaignAnalyticsResponseSchema>,
  typeof paramsSchema
>({
  metadata: listMarketingCampaignsMetadata,
  params: paramsSchema,
  output: marketingCampaignAnalyticsResponseSchema,
  handler: async ({ tx, ctx, params }) => getMarketingCampaignAnalytics(tx, ctx, params["id"]),
});
