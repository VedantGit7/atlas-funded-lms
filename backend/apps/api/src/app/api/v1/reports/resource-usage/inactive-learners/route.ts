import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  resourceUsageInactiveDeactivateBodySchema,
  resourceUsageInactiveDeactivateResponseSchema,
  resourceUsageInactiveQuerySchema,
  resourceUsageInactiveResponseSchema,
} from "@atlas/domain/reports/resource-usage-roster.dto";
import {
  listResourceUsageRosterMetadata,
  mutateResourceUsageInactiveMetadata,
} from "@atlas/domain/reports/resource-usage-roster.route-metadata";
import {
  deactivateResourceUsageInactive,
  listResourceUsageInactive,
} from "@atlas/domain/reports/resource-usage-roster.service";

export const GET = createTenantRoute<
  z.output<typeof resourceUsageInactiveQuerySchema>,
  z.output<typeof resourceUsageInactiveResponseSchema>
>({
  metadata: listResourceUsageRosterMetadata,
  input: resourceUsageInactiveQuerySchema,
  output: resourceUsageInactiveResponseSchema,
  handler: async ({ tx, ctx, input }) => listResourceUsageInactive(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof resourceUsageInactiveDeactivateBodySchema>,
  z.output<typeof resourceUsageInactiveDeactivateResponseSchema>
>({
  metadata: mutateResourceUsageInactiveMetadata,
  body: resourceUsageInactiveDeactivateBodySchema,
  output: resourceUsageInactiveDeactivateResponseSchema,
  handler: async ({ tx, ctx, input }) => deactivateResourceUsageInactive(tx, ctx, input),
});
