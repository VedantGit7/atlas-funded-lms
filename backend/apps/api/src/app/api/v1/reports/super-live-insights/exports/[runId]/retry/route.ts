import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  retrySuperLiveInsightsExportBodySchema,
  retrySuperLiveInsightsExportResponseSchema,
  superLiveInsightsExportRunParamsSchema,
} from "@atlas/domain/reports/super-live-insights-exports.dto";
import { retrySuperLiveInsightsExportMetadata } from "@atlas/domain/reports/super-live-insights-exports.route-metadata";
import { retrySuperLiveInsightsExport } from "@atlas/domain/reports/super-live-insights-exports.service";

export const POST = createTenantRoute<
  z.output<typeof retrySuperLiveInsightsExportBodySchema>,
  z.output<typeof retrySuperLiveInsightsExportResponseSchema>,
  typeof superLiveInsightsExportRunParamsSchema
>({
  metadata: retrySuperLiveInsightsExportMetadata,
  params: superLiveInsightsExportRunParamsSchema,
  body: retrySuperLiveInsightsExportBodySchema,
  output: retrySuperLiveInsightsExportResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    retrySuperLiveInsightsExport(tx, ctx, params["runId"], {
      ...(input.format != null ? { format: input.format } : {}),
    }),
});
