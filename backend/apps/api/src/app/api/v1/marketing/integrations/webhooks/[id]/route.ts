import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  deleteMarketingIntegrationWebhookResponseSchema,
  marketingIntegrationWebhookResponseSchema,
  updateMarketingIntegrationWebhookBodySchema,
} from "../../../../../../../server/marketing-integrations/marketing-integrations.schemas";
import { mutateMarketingIntegrationsMetadata } from "../../../../../../../server/marketing-integrations/marketing-integrations.route-metadata";
import {
  deleteMarketingIntegrationWebhook,
  updateMarketingIntegrationWebhook,
} from "../../../../../../../server/marketing-integrations/marketing-integrations.service";

const paramsSchema = zod.object({ id: zod.uuid() });

export const PATCH = createTenantRoute<
  z.output<typeof updateMarketingIntegrationWebhookBodySchema>,
  z.output<typeof marketingIntegrationWebhookResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingIntegrationsMetadata,
  params: paramsSchema,
  body: updateMarketingIntegrationWebhookBodySchema,
  output: marketingIntegrationWebhookResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateMarketingIntegrationWebhook(tx, ctx, params["id"], input),
});

export const DELETE = createTenantRoute<
  undefined,
  z.output<typeof deleteMarketingIntegrationWebhookResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingIntegrationsMetadata,
  params: paramsSchema,
  output: deleteMarketingIntegrationWebhookResponseSchema,
  handler: async ({ tx, ctx, params }) => deleteMarketingIntegrationWebhook(tx, ctx, params["id"]),
});
