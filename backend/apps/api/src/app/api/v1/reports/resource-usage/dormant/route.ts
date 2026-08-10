import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  resourceUsageDormantArchiveBodySchema,
  resourceUsageDormantArchiveResponseSchema,
  resourceUsageDormantQuerySchema,
  resourceUsageDormantResponseSchema,
} from "@atlas/domain/reports/resource-usage-roster.dto";
import {
  listResourceUsageRosterMetadata,
  mutateResourceUsageDormantMetadata,
} from "@atlas/domain/reports/resource-usage-roster.route-metadata";
import {
  archiveResourceUsageDormant,
  listResourceUsageDormant,
} from "@atlas/domain/reports/resource-usage-roster.service";

export const GET = createTenantRoute<
  z.output<typeof resourceUsageDormantQuerySchema>,
  z.output<typeof resourceUsageDormantResponseSchema>
>({
  metadata: listResourceUsageRosterMetadata,
  input: resourceUsageDormantQuerySchema,
  output: resourceUsageDormantResponseSchema,
  handler: async ({ tx, ctx, input }) => listResourceUsageDormant(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof resourceUsageDormantArchiveBodySchema>,
  z.output<typeof resourceUsageDormantArchiveResponseSchema>
>({
  metadata: mutateResourceUsageDormantMetadata,
  body: resourceUsageDormantArchiveBodySchema,
  output: resourceUsageDormantArchiveResponseSchema,
  handler: async ({ tx, ctx, input }) => archiveResourceUsageDormant(tx, ctx, input),
});
