import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  composeMarketingEmailBodySchema,
  marketingEmailCampaignResponseSchema,
} from "../../../../../../../server/marketing-email/marketing-email.schemas";
import { mutateMarketingEmailMetadata } from "../../../../../../../server/marketing-email/marketing-email.route-metadata";
import { composeMarketingEmail } from "../../../../../../../server/marketing-email/marketing-email.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const POST = createTenantRoute<
  z.output<typeof composeMarketingEmailBodySchema>,
  z.output<typeof marketingEmailCampaignResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingEmailMetadata,
  params: paramsSchema,
  body: composeMarketingEmailBodySchema,
  output: marketingEmailCampaignResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    composeMarketingEmail(tx, ctx, params["id"], input),
});
