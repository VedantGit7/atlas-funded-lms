import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import { marketingCampaignResponseSchema } from "../../../../../../server/marketing-campaigns/marketing-campaigns.schemas";
import { listMarketingCampaignsMetadata } from "../../../../../../server/marketing-campaigns/marketing-campaigns.route-metadata";
import { getMarketingCampaign } from "../../../../../../server/marketing-campaigns/marketing-campaigns.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof marketingCampaignResponseSchema>,
  typeof paramsSchema
>({
  metadata: listMarketingCampaignsMetadata,
  params: paramsSchema,
  output: marketingCampaignResponseSchema,
  handler: async ({ tx, ctx, params }) => getMarketingCampaign(tx, ctx, params["id"]),
});
