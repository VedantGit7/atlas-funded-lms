import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  progressScoreExportRunParamsSchema,
  retryProgressScoreExportResponseSchema,
} from "@atlas/domain/reports/progress-score-exports.dto";
import { retryProgressScoreExportMetadata } from "@atlas/domain/reports/progress-score-exports.route-metadata";
import { retryProgressScoreExport } from "@atlas/domain/reports/progress-score-exports.service";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof retryProgressScoreExportResponseSchema>,
  typeof progressScoreExportRunParamsSchema
>({
  metadata: retryProgressScoreExportMetadata,
  params: progressScoreExportRunParamsSchema,
  input: noBodySchema,
  output: retryProgressScoreExportResponseSchema,
  handler: async ({ tx, ctx, params }) => retryProgressScoreExport(tx, ctx, params["runId"]),
});
