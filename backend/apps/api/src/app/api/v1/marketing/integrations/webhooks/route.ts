import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createMarketingIntegrationWebhookBodySchema,
  marketingIntegrationWebhookResponseSchema,
  marketingIntegrationWebhooksListResponseSchema,
} from "../../../../../../server/marketing-integrations/marketing-integrations.schemas";
import {
  listMarketingIntegrationsMetadata,
  mutateMarketingIntegrationsMetadata,
} from "../../../../../../server/marketing-integrations/marketing-integrations.route-metadata";
import {
  createMarketingIntegrationWebhook,
  listMarketingIntegrationWebhooks,
} from "../../../../../../server/marketing-integrations/marketing-integrations.service";

export const GET = createTenantRoute<
  undefined,
  z.output<typeof marketingIntegrationWebhooksListResponseSchema>
>({
  metadata: listMarketingIntegrationsMetadata,
  output: marketingIntegrationWebhooksListResponseSchema,
  handler: async ({ tx, ctx }) => listMarketingIntegrationWebhooks(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createMarketingIntegrationWebhookBodySchema>,
  z.output<typeof marketingIntegrationWebhookResponseSchema>
>({
  metadata: mutateMarketingIntegrationsMetadata,
  body: createMarketingIntegrationWebhookBodySchema,
  output: marketingIntegrationWebhookResponseSchema,
  handler: async ({ tx, ctx, input }) => createMarketingIntegrationWebhook(tx, ctx, input),
});
