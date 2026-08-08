import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { listMarketingEmailMetadata } from "../../../../../server/marketing-email/marketing-email.route-metadata";
import {
  marketingEmailAudienceEstimateQuerySchema,
  marketingEmailAudienceEstimateResponseSchema,
} from "../../../../../server/marketing-email/marketing-email.schemas";
import { estimateMarketingEmailAudience } from "../../../../../server/marketing-email/marketing-email-audience-estimate.service";

export const GET = createTenantRoute<
  z.output<typeof marketingEmailAudienceEstimateQuerySchema>,
  z.output<typeof marketingEmailAudienceEstimateResponseSchema>
>({
  metadata: listMarketingEmailMetadata,
  input: marketingEmailAudienceEstimateQuerySchema,
  output: marketingEmailAudienceEstimateResponseSchema,
  handler: async ({ tx, ctx, input }) => estimateMarketingEmailAudience(tx, ctx, input),
});
