import { z } from "zod";
import type { z as Zod } from "zod";
import { createTenantRoute } from "@atlas/api";
import { insightDashboardResponseSchema } from "../../../../../server/insights/insights.schemas";
import { getInsightDashboard } from "../../../../../server/insights/insights.service";
import { insightDashboardMetadata } from "../../../../../server/insights/insights.route-metadata";

const paramsSchema = z.object({ slug: z.string().min(1) });

export const GET = createTenantRoute<
  Record<string, never>,
  Zod.output<typeof insightDashboardResponseSchema>,
  typeof paramsSchema
>({
  metadata: insightDashboardMetadata,
  params: paramsSchema,
  output: insightDashboardResponseSchema,
  handler: async ({ tx, ctx, params }) => ({
    data: await getInsightDashboard(tx, ctx, params["slug"] ?? ""),
  }),
});
