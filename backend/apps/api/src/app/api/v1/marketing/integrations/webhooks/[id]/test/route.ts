import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import { testMarketingIntegrationWebhookResponseSchema } from "../../../../../../../../server/marketing-integrations/marketing-integrations.schemas";
import { mutateMarketingIntegrationsMetadata } from "../../../../../../../../server/marketing-integrations/marketing-integrations.route-metadata";
import { testMarketingIntegrationWebhook } from "../../../../../../../../server/marketing-integrations/marketing-integrations.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const POST = createTenantRoute<
  undefined,
  z.output<typeof testMarketingIntegrationWebhookResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingIntegrationsMetadata,
  params: paramsSchema,
  output: testMarketingIntegrationWebhookResponseSchema,
  handler: async ({ tx, ctx, params }) => testMarketingIntegrationWebhook(tx, ctx, params["id"]),
});
