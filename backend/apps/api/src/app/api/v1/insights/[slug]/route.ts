import { z } from "zod";
import type { z as Zod } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  insightDashboardQuerySchema,
  insightDashboardResponseSchema,
} from "../../../../../server/insights/insights.schemas";
import { getInsightDashboard } from "../../../../../server/insights/insights.service";
import { insightDashboardMetadata } from "../../../../../server/insights/insights.route-metadata";

const paramsSchema = z.object({ slug: z.string().min(1) });

export const GET = createTenantRoute<
  Zod.output<typeof insightDashboardQuerySchema>,
  Zod.output<typeof insightDashboardResponseSchema>,
  typeof paramsSchema
>({
  metadata: insightDashboardMetadata,
  params: paramsSchema,
  input: insightDashboardQuerySchema,
  output: insightDashboardResponseSchema,
  handler: async ({ tx, ctx, params, input }) => ({
    data: await getInsightDashboard(tx, ctx, params.slug, input.range),
  }),
});
