import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  resourceUsageDormantQuerySchema,
  resourceUsageDormantResponseSchema,
} from "@atlas/domain/reports/resource-usage-roster.dto";
import { listResourceUsageRosterMetadata } from "@atlas/domain/reports/resource-usage-roster.route-metadata";
import { listResourceUsageDormant } from "@atlas/domain/reports/resource-usage-roster.service";

export const GET = createTenantRoute<
  z.output<typeof resourceUsageDormantQuerySchema>,
  z.output<typeof resourceUsageDormantResponseSchema>
>({
  metadata: listResourceUsageRosterMetadata,
  input: resourceUsageDormantQuerySchema,
  output: resourceUsageDormantResponseSchema,
  handler: async ({ tx, ctx, input }) => listResourceUsageDormant(tx, ctx, input),
});
