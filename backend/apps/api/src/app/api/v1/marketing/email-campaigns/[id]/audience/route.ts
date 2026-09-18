import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  marketingEmailCampaignResponseSchema,
  setMarketingEmailAudienceBodySchema,
} from "../../../../../../../server/marketing-email/marketing-email.schemas";
import { mutateMarketingEmailMetadata } from "../../../../../../../server/marketing-email/marketing-email.route-metadata";
import { setMarketingEmailAudience } from "../../../../../../../server/marketing-email/marketing-email.service";

const paramsSchema = zod.object({ id: zod.uuid() });

export const POST = createTenantRoute<
  z.output<typeof setMarketingEmailAudienceBodySchema>,
  z.output<typeof marketingEmailCampaignResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingEmailMetadata,
  params: paramsSchema,
  body: setMarketingEmailAudienceBodySchema,
  output: marketingEmailCampaignResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    setMarketingEmailAudience(tx, ctx, params["id"], input),
});
