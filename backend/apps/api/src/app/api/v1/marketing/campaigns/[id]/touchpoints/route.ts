import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  marketingCampaignResponseSchema,
  updateMarketingCampaignTouchpointsBodySchema,
} from "../../../../../../../server/marketing-campaigns/marketing-campaigns.schemas";
import { mutateMarketingCampaignsMetadata } from "../../../../../../../server/marketing-campaigns/marketing-campaigns.route-metadata";
import { updateMarketingCampaignTouchpoints } from "../../../../../../../server/marketing-campaigns/marketing-campaigns.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const POST = createTenantRoute<
  z.output<typeof updateMarketingCampaignTouchpointsBodySchema>,
  z.output<typeof marketingCampaignResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingCampaignsMetadata,
  params: paramsSchema,
  body: updateMarketingCampaignTouchpointsBodySchema,
  output: marketingCampaignResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateMarketingCampaignTouchpoints(tx, ctx, params["id"], input),
});
