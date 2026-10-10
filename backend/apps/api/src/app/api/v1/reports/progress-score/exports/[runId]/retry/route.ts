import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { retryProgressScoreExportResponseSchema } from "@atlas/domain/reports/progress-score-exports.dto";
import { retryProgressScoreExport } from "@atlas/domain/reports/progress-score-exports.service";
import { reportExportRunParamsSchema } from "@atlas/domain/reports/report-exports.dto";
import { retryReportExportMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof retryProgressScoreExportResponseSchema>,
  typeof reportExportRunParamsSchema
>({
  metadata: retryReportExportMetadata,
  params: reportExportRunParamsSchema,
  input: noBodySchema,
  output: retryProgressScoreExportResponseSchema,
  handler: async ({ tx, ctx, params }) => retryProgressScoreExport(tx, ctx, params["runId"]),
});
