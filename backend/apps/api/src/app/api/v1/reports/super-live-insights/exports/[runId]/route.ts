import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  superLiveInsightsExportRunDetailResponseSchema,
  superLiveInsightsExportRunParamsSchema,
} from "@atlas/domain/reports/super-live-insights-exports.dto";
import { getSuperLiveInsightsExportsMetadata } from "@atlas/domain/reports/super-live-insights-exports.route-metadata";
import { getSuperLiveInsightsExportRun } from "@atlas/domain/reports/super-live-insights-exports.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof superLiveInsightsExportRunDetailResponseSchema>,
  typeof superLiveInsightsExportRunParamsSchema
>({
  metadata: getSuperLiveInsightsExportsMetadata,
  params: superLiveInsightsExportRunParamsSchema,
  input: noBodySchema,
  output: superLiveInsightsExportRunDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getSuperLiveInsightsExportRun(tx, ctx, params["runId"]),
});
