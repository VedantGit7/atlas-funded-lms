import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  resourceUsageStorageQuerySchema,
  resourceUsageStorageResponseSchema,
} from "@atlas/domain/reports/resource-usage-roster.dto";
import { listResourceUsageRosterMetadata } from "@atlas/domain/reports/resource-usage-roster.route-metadata";
import { getResourceUsageStorageBreakdown } from "@atlas/domain/reports/resource-usage-roster.service";

export const GET = createTenantRoute<
  z.output<typeof resourceUsageStorageQuerySchema>,
  z.output<typeof resourceUsageStorageResponseSchema>
>({
  metadata: listResourceUsageRosterMetadata,
  input: resourceUsageStorageQuerySchema,
  output: resourceUsageStorageResponseSchema,
  handler: async ({ tx, ctx, input }) => getResourceUsageStorageBreakdown(tx, ctx, input),
});
