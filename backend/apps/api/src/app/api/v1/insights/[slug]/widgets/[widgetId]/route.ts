import { z } from "zod";
import type { z as Zod } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  insightDashboardQuerySchema,
  insightWidgetDetailResponseSchema,
} from "../../../../../../../server/insights/insights.schemas";
import { getInsightWidgetDetail } from "../../../../../../../server/insights/insights.service";
import { insightDashboardMetadata } from "../../../../../../../server/insights/insights.route-metadata";

const paramsSchema = z.object({
  slug: z.string().min(1),
  widgetId: z.string().min(1),
});

export const GET = createTenantRoute<
  Zod.output<typeof insightDashboardQuerySchema>,
  Zod.output<typeof insightWidgetDetailResponseSchema>,
  typeof paramsSchema
>({
  metadata: insightDashboardMetadata,
  params: paramsSchema,
  input: insightDashboardQuerySchema,
  output: insightWidgetDetailResponseSchema,
  handler: async ({ tx, ctx, params, input }) => ({
    data: await getInsightWidgetDetail(tx, ctx, params.slug, params.widgetId, input.range),
  }),
});
