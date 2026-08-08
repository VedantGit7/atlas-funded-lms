import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  resourceUsageInactiveQuerySchema,
  resourceUsageInactiveResponseSchema,
} from "@atlas/domain/reports/resource-usage-roster.dto";
import { listResourceUsageRosterMetadata } from "@atlas/domain/reports/resource-usage-roster.route-metadata";
import { listResourceUsageInactive } from "@atlas/domain/reports/resource-usage-roster.service";

export const GET = createTenantRoute<
  z.output<typeof resourceUsageInactiveQuerySchema>,
  z.output<typeof resourceUsageInactiveResponseSchema>
>({
  metadata: listResourceUsageRosterMetadata,
  input: resourceUsageInactiveQuerySchema,
  output: resourceUsageInactiveResponseSchema,
  handler: async ({ tx, ctx, input }) => listResourceUsageInactive(tx, ctx, input),
});
