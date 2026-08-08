import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  progressScoreExportRunDetailResponseSchema,
  progressScoreExportRunParamsSchema,
} from "@atlas/domain/reports/progress-score-exports.dto";
import { getProgressScoreExportsMetadata } from "@atlas/domain/reports/progress-score-exports.route-metadata";
import { getProgressScoreExportRun } from "@atlas/domain/reports/progress-score-exports.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof progressScoreExportRunDetailResponseSchema>,
  typeof progressScoreExportRunParamsSchema
>({
  metadata: getProgressScoreExportsMetadata,
  params: progressScoreExportRunParamsSchema,
  input: noBodySchema,
  output: progressScoreExportRunDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getProgressScoreExportRun(tx, ctx, params.runId),
});
