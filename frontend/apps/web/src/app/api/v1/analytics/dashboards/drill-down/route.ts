import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  analyticsDashboardDrillDownQuerySchema,
  analyticsDashboardDrillDownResponseSchema,
} from "@atlas/domain/analytics/analytics.dto";
import { queryDashboardDrillDown } from "@atlas/domain/analytics/analytics.service";
import { analyticsDashboardDrillDownMetadata } from "@/server/analytics/analytics.route-metadata";

export const GET = createTenantRoute<
  z.output<typeof analyticsDashboardDrillDownQuerySchema>,
  z.output<typeof analyticsDashboardDrillDownResponseSchema>
>({
  metadata: analyticsDashboardDrillDownMetadata,
  input: analyticsDashboardDrillDownQuerySchema,
  output: analyticsDashboardDrillDownResponseSchema,
  handler: async ({ tx, ctx, input }) => queryDashboardDrillDown(tx, ctx, input),
});
