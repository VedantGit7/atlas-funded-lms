import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  resourceUsageOverviewQuerySchema,
  resourceUsageOverviewResponseSchema,
} from "@atlas/domain/reports/resource-usage-roster.dto";
import { listResourceUsageRosterMetadata } from "@atlas/domain/reports/resource-usage-roster.route-metadata";
import { getResourceUsageOverview } from "@atlas/domain/reports/resource-usage-roster.service";

export const GET = createTenantRoute<
  z.output<typeof resourceUsageOverviewQuerySchema>,
  z.output<typeof resourceUsageOverviewResponseSchema>
>({
  metadata: listResourceUsageRosterMetadata,
  input: resourceUsageOverviewQuerySchema,
  output: resourceUsageOverviewResponseSchema,
  handler: async ({ tx, ctx, input }) => getResourceUsageOverview(tx, ctx, input),
});
