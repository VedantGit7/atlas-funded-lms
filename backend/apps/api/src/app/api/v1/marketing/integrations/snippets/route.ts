import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  marketingIntegrationSnippetsResponseSchema,
  updateMarketingIntegrationSnippetsBodySchema,
} from "../../../../../../server/marketing-integrations/marketing-integrations.schemas";
import {
  listMarketingIntegrationsMetadata,
  mutateMarketingIntegrationsMetadata,
} from "../../../../../../server/marketing-integrations/marketing-integrations.route-metadata";
import {
  getMarketingIntegrationSnippets,
  updateMarketingIntegrationSnippets,
} from "../../../../../../server/marketing-integrations/marketing-integrations.service";

export const GET = createTenantRoute<
  undefined,
  z.output<typeof marketingIntegrationSnippetsResponseSchema>
>({
  metadata: listMarketingIntegrationsMetadata,
  output: marketingIntegrationSnippetsResponseSchema,
  handler: async ({ tx, ctx }) => getMarketingIntegrationSnippets(tx, ctx),
});

export const PUT = createTenantRoute<
  z.output<typeof updateMarketingIntegrationSnippetsBodySchema>,
  z.output<typeof marketingIntegrationSnippetsResponseSchema>
>({
  metadata: mutateMarketingIntegrationsMetadata,
  body: updateMarketingIntegrationSnippetsBodySchema,
  output: marketingIntegrationSnippetsResponseSchema,
  handler: async ({ tx, ctx, input }) => updateMarketingIntegrationSnippets(tx, ctx, input),
});
