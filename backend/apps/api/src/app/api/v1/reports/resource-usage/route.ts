import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { resourceUsageOverviewResponseSchema } from "@atlas/domain/reports/resource-usage-roster.dto";
import { listResourceUsageRosterMetadata } from "@atlas/domain/reports/resource-usage-roster.route-metadata";
import { getResourceUsageOverview } from "@atlas/domain/reports/resource-usage-roster.service";

export const GET = createTenantRoute<
  z.output<typeof noBodySchema>,
  z.output<typeof resourceUsageOverviewResponseSchema>
>({
  metadata: listResourceUsageRosterMetadata,
  input: noBodySchema,
  output: resourceUsageOverviewResponseSchema,
  handler: async ({ tx, ctx }) => getResourceUsageOverview(tx, ctx),
});
