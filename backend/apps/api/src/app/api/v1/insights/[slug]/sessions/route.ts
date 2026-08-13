import { z } from "zod";
import type { z as Zod } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  insightLiveSessionsQuerySchema,
  insightLiveSessionsResponseSchema,
} from "../../../../../../server/insights/insights.schemas";
import { getInsightLiveSessions } from "../../../../../../server/insights/insights.service";
import { insightDashboardMetadata } from "../../../../../../server/insights/insights.route-metadata";

const paramsSchema = z.object({
  slug: z.string().min(1),
});

export const GET = createTenantRoute<
  Zod.output<typeof insightLiveSessionsQuerySchema>,
  Zod.output<typeof insightLiveSessionsResponseSchema>,
  typeof paramsSchema
>({
  metadata: insightDashboardMetadata,
  params: paramsSchema,
  input: insightLiveSessionsQuerySchema,
  output: insightLiveSessionsResponseSchema,
  handler: async ({ tx, params, input }) => ({
    data: await getInsightLiveSessions(tx, params.slug, input),
  }),
});
