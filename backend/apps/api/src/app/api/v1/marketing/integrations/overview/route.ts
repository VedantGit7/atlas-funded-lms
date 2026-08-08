import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { marketingIntegrationOverviewResponseSchema } from "../../../../../../server/marketing-integrations/marketing-integrations.schemas";
import { listMarketingIntegrationsMetadata } from "../../../../../../server/marketing-integrations/marketing-integrations.route-metadata";
import { getMarketingIntegrationOverview } from "../../../../../../server/marketing-integrations/marketing-integrations.service";

export const GET = createTenantRoute<
  undefined,
  z.output<typeof marketingIntegrationOverviewResponseSchema>
>({
  metadata: listMarketingIntegrationsMetadata,
  output: marketingIntegrationOverviewResponseSchema,
  handler: async ({ tx, ctx }) => getMarketingIntegrationOverview(tx, ctx),
});
