import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import { marketingIntegrationDeliveriesListResponseSchema } from "../../../../../../../../server/marketing-integrations/marketing-integrations.schemas";
import { listMarketingIntegrationsMetadata } from "../../../../../../../../server/marketing-integrations/marketing-integrations.route-metadata";
import { listMarketingIntegrationWebhookDeliveries } from "../../../../../../../../server/marketing-integrations/marketing-integrations.service";

const paramsSchema = zod.object({ id: zod.uuid() });

export const GET = createTenantRoute<
  undefined,
  z.output<typeof marketingIntegrationDeliveriesListResponseSchema>,
  typeof paramsSchema
>({
  metadata: listMarketingIntegrationsMetadata,
  params: paramsSchema,
  output: marketingIntegrationDeliveriesListResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    listMarketingIntegrationWebhookDeliveries(tx, ctx, params["id"]),
});
