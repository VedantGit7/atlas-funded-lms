import { z } from "zod";
import type { z as Zod } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { insightMessengerInboxResponseSchema } from "../../../../../../server/insights/insights.schemas";
import { getInsightMessengerInbox } from "../../../../../../server/insights/insights.service";
import { insightDashboardMetadata } from "../../../../../../server/insights/insights.route-metadata";

const paramsSchema = z.object({
  slug: z.string().min(1),
});

export const GET = createTenantRoute<
  Zod.output<typeof noBodySchema>,
  Zod.output<typeof insightMessengerInboxResponseSchema>,
  typeof paramsSchema
>({
  metadata: insightDashboardMetadata,
  params: paramsSchema,
  input: noBodySchema,
  output: insightMessengerInboxResponseSchema,
  handler: async ({ tx, params }) => ({
    data: await getInsightMessengerInbox(tx, params.slug),
  }),
});
