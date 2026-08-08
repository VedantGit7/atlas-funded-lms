import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  resourceUsageHistoryQuerySchema,
  resourceUsageHistoryResponseSchema,
} from "@atlas/domain/reports/resource-usage-roster.dto";
import { listResourceUsageRosterMetadata } from "@atlas/domain/reports/resource-usage-roster.route-metadata";
import { listResourceUsageHistory } from "@atlas/domain/reports/resource-usage-roster.service";

export const GET = createTenantRoute<
  z.output<typeof resourceUsageHistoryQuerySchema>,
  z.output<typeof resourceUsageHistoryResponseSchema>
>({
  metadata: listResourceUsageRosterMetadata,
  input: resourceUsageHistoryQuerySchema,
  output: resourceUsageHistoryResponseSchema,
  handler: async ({ tx, ctx, input }) => listResourceUsageHistory(tx, ctx, input),
});
