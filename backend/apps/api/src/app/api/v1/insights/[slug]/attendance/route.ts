import { z } from "zod";
import type { z as Zod } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  insightLiveAttendanceQuerySchema,
  insightLiveAttendanceResponseSchema,
} from "../../../../../../server/insights/insights.schemas";
import { getInsightLiveAttendance } from "../../../../../../server/insights/insights.service";
import { insightDashboardMetadata } from "../../../../../../server/insights/insights.route-metadata";

const paramsSchema = z.object({
  slug: z.string().min(1),
});

export const GET = createTenantRoute<
  Zod.output<typeof insightLiveAttendanceQuerySchema>,
  Zod.output<typeof insightLiveAttendanceResponseSchema>,
  typeof paramsSchema
>({
  metadata: insightDashboardMetadata,
  params: paramsSchema,
  input: insightLiveAttendanceQuerySchema,
  output: insightLiveAttendanceResponseSchema,
  handler: async ({ tx, params, input }) => ({
    data: await getInsightLiveAttendance(tx, params.slug, input),
  }),
});
