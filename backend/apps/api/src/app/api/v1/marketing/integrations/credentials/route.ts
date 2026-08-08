import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  marketingIntegrationCredentialsResponseSchema,
  rotateMarketingIntegrationApiKeyResponseSchema,
} from "../../../../../../server/marketing-integrations/marketing-integrations.schemas";
import {
  listMarketingIntegrationsMetadata,
  mutateMarketingIntegrationsMetadata,
} from "../../../../../../server/marketing-integrations/marketing-integrations.route-metadata";
import {
  getMarketingIntegrationCredentials,
  rotateMarketingIntegrationApiKey,
} from "../../../../../../server/marketing-integrations/marketing-integrations.service";

export const GET = createTenantRoute<
  undefined,
  z.output<typeof marketingIntegrationCredentialsResponseSchema>
>({
  metadata: listMarketingIntegrationsMetadata,
  output: marketingIntegrationCredentialsResponseSchema,
  handler: async ({ tx, ctx }) => getMarketingIntegrationCredentials(tx, ctx),
});

export const POST = createTenantRoute<
  undefined,
  z.output<typeof rotateMarketingIntegrationApiKeyResponseSchema>
>({
  metadata: mutateMarketingIntegrationsMetadata,
  output: rotateMarketingIntegrationApiKeyResponseSchema,
  handler: async ({ tx, ctx }) => rotateMarketingIntegrationApiKey(tx, ctx),
});
