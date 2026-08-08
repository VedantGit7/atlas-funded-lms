import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { listMarketingEmailMetadata } from "../../../../../server/marketing-email/marketing-email.route-metadata";
import { marketingEmailCampaignsSummaryResponseSchema } from "../../../../../server/marketing-email/marketing-email.schemas";
import { getMarketingEmailCampaignsSummary } from "../../../../../server/marketing-email/marketing-email.service";

export const GET = createTenantRoute<
  undefined,
  z.output<typeof marketingEmailCampaignsSummaryResponseSchema>
>({
  metadata: listMarketingEmailMetadata,
  output: marketingEmailCampaignsSummaryResponseSchema,
  handler: async ({ tx, ctx }) => getMarketingEmailCampaignsSummary(tx, ctx),
});
