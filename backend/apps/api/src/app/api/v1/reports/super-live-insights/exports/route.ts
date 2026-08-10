import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  createSuperLiveInsightsExportBodySchema,
  createSuperLiveInsightsExportResponseSchema,
  superLiveInsightsExportsResponseSchema,
} from "@atlas/domain/reports/super-live-insights-exports.dto";
import {
  createSuperLiveInsightsExportMetadata,
  getSuperLiveInsightsExportsMetadata,
} from "@atlas/domain/reports/super-live-insights-exports.route-metadata";
import {
  createSuperLiveInsightsExport,
  getSuperLiveInsightsExports,
} from "@atlas/domain/reports/super-live-insights-exports.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof superLiveInsightsExportsResponseSchema>
>({
  metadata: getSuperLiveInsightsExportsMetadata,
  input: noBodySchema,
  output: superLiveInsightsExportsResponseSchema,
  handler: async ({ tx, ctx }) => getSuperLiveInsightsExports(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createSuperLiveInsightsExportBodySchema>,
  z.output<typeof createSuperLiveInsightsExportResponseSchema>
>({
  metadata: createSuperLiveInsightsExportMetadata,
  body: createSuperLiveInsightsExportBodySchema,
  output: createSuperLiveInsightsExportResponseSchema,
  handler: async ({ tx, ctx, input }) => createSuperLiveInsightsExport(tx, ctx, input),
});
