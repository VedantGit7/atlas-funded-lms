import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  marketingEmailCampaignResponseSchema,
  updateMarketingEmailCampaignTitleBodySchema,
} from "../../../../../../server/marketing-email/marketing-email.schemas";
import {
  listMarketingEmailMetadata,
  mutateMarketingEmailMetadata,
} from "../../../../../../server/marketing-email/marketing-email.route-metadata";
import {
  getMarketingEmailCampaign,
  updateMarketingEmailCampaignTitle,
} from "../../../../../../server/marketing-email/marketing-email.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof marketingEmailCampaignResponseSchema>,
  typeof paramsSchema
>({
  metadata: listMarketingEmailMetadata,
  params: paramsSchema,
  output: marketingEmailCampaignResponseSchema,
  handler: async ({ tx, ctx, params }) => getMarketingEmailCampaign(tx, ctx, params.id),
});

export const PATCH = createTenantRoute<
  z.output<typeof updateMarketingEmailCampaignTitleBodySchema>,
  z.output<typeof marketingEmailCampaignResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingEmailMetadata,
  params: paramsSchema,
  body: updateMarketingEmailCampaignTitleBodySchema,
  output: marketingEmailCampaignResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateMarketingEmailCampaignTitle(tx, ctx, params.id, input),
});
