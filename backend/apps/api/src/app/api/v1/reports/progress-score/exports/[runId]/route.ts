import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { progressScoreExportRunDetailResponseSchema } from "@atlas/domain/reports/progress-score-exports.dto";
import { getProgressScoreExportRun } from "@atlas/domain/reports/progress-score-exports.service";
import { reportExportRunParamsSchema } from "@atlas/domain/reports/report-exports.dto";
import { getReportExportsMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof progressScoreExportRunDetailResponseSchema>,
  typeof reportExportRunParamsSchema
>({
  metadata: getReportExportsMetadata,
  params: reportExportRunParamsSchema,
  input: noBodySchema,
  output: progressScoreExportRunDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getProgressScoreExportRun(tx, ctx, params["runId"]),
});
