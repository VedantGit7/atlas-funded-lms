import { z } from "zod";
import type { z as Zod } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  insightDashboardQuerySchema,
  insightEngagementFunnelResponseSchema,
} from "../../../../../../server/insights/insights.schemas";
import { getInsightEngagementFunnel } from "../../../../../../server/insights/insights.service";
import { insightDashboardMetadata } from "../../../../../../server/insights/insights.route-metadata";

const paramsSchema = z.object({
  slug: z.string().min(1),
});

export const GET = createTenantRoute<
  Zod.output<typeof insightDashboardQuerySchema>,
  Zod.output<typeof insightEngagementFunnelResponseSchema>,
  typeof paramsSchema
>({
  metadata: insightDashboardMetadata,
  params: paramsSchema,
  input: insightDashboardQuerySchema,
  output: insightEngagementFunnelResponseSchema,
  handler: async ({ tx, params, input }) => ({
    data: await getInsightEngagementFunnel(tx, params.slug, input.range),
  }),
});
