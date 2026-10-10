import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { superLiveInsightsExportRunDetailResponseSchema } from "@atlas/domain/reports/super-live-insights-exports.dto";
import { getSuperLiveInsightsExportRun } from "@atlas/domain/reports/super-live-insights-exports.service";
import { reportExportRunParamsSchema } from "@atlas/domain/reports/report-exports.dto";
import { getReportExportsMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof superLiveInsightsExportRunDetailResponseSchema>,
  typeof reportExportRunParamsSchema
>({
  metadata: getReportExportsMetadata,
  params: reportExportRunParamsSchema,
  input: noBodySchema,
  output: superLiveInsightsExportRunDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getSuperLiveInsightsExportRun(tx, ctx, params["runId"]),
});
