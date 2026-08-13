import { z } from "zod";
import type { z as Zod } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { insightMarketingWorkflowsResponseSchema } from "../../../../../../server/insights/insights.schemas";
import { getInsightMarketingWorkflows } from "../../../../../../server/insights/insights.service";
import { insightDashboardMetadata } from "../../../../../../server/insights/insights.route-metadata";

const paramsSchema = z.object({
  slug: z.string().min(1),
});

export const GET = createTenantRoute<
  Zod.output<typeof noBodySchema>,
  Zod.output<typeof insightMarketingWorkflowsResponseSchema>,
  typeof paramsSchema
>({
  metadata: insightDashboardMetadata,
  params: paramsSchema,
  input: noBodySchema,
  output: insightMarketingWorkflowsResponseSchema,
  handler: async ({ tx, params }) => ({
    data: await getInsightMarketingWorkflows(tx, params.slug),
  }),
});
