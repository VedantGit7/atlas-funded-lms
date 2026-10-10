import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  retrySuperLiveInsightsExportBodySchema,
  retrySuperLiveInsightsExportResponseSchema,
} from "@atlas/domain/reports/super-live-insights-exports.dto";
import { retrySuperLiveInsightsExport } from "@atlas/domain/reports/super-live-insights-exports.service";
import { reportExportRunParamsSchema } from "@atlas/domain/reports/report-exports.dto";
import { retryReportExportMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const POST = createTenantRoute<
  z.output<typeof retrySuperLiveInsightsExportBodySchema>,
  z.output<typeof retrySuperLiveInsightsExportResponseSchema>,
  typeof reportExportRunParamsSchema
>({
  metadata: retryReportExportMetadata,
  params: reportExportRunParamsSchema,
  body: retrySuperLiveInsightsExportBodySchema,
  output: retrySuperLiveInsightsExportResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    retrySuperLiveInsightsExport(tx, ctx, params["runId"], {
      ...(input.format != null ? { format: input.format } : {}),
    }),
});
