import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  retentionImpactQuerySchema,
  retentionImpactResponseSchema,
} from "@atlas/domain/reports/export-settings.dto";
import { retentionImpactMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";
import { getRetentionImpact } from "@atlas/domain/reports/export-settings.service";

export const GET = createTenantRoute<
  z.output<typeof retentionImpactQuerySchema>,
  z.output<typeof retentionImpactResponseSchema>
>({
  metadata: retentionImpactMetadata,
  input: retentionImpactQuerySchema,
  output: retentionImpactResponseSchema,
  handler: async ({ tx, ctx, input }) => getRetentionImpact(tx, ctx, input),
});
