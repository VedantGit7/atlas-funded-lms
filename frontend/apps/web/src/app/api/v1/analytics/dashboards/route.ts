import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  analyticsDashboardQuerySchema,
  analyticsDashboardResponseSchema,
} from "@atlas/domain/analytics/analytics.dto";
import { queryAnalyticsDashboard } from "@atlas/domain/analytics/analytics.service";
import { analyticsDashboardMetadata } from "../../../../../server/analytics/analytics.route-metadata";

export const GET = createTenantRoute<
  z.output<typeof analyticsDashboardQuerySchema>,
  z.output<typeof analyticsDashboardResponseSchema>
>({
  metadata: analyticsDashboardMetadata,
  input: analyticsDashboardQuerySchema,
  output: analyticsDashboardResponseSchema,
  handler: async ({ tx, ctx, input }) => queryAnalyticsDashboard(tx, ctx, input),
});
