import { z as zodEmpty } from "zod";
import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  assessmentIdParamsSchema,
  scoreItemAnalysisResponseSchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { listProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";
import { listScoreItemAnalysis } from "@atlas/domain/reports/progress-score-roster.service";

const emptyQuery = zodEmpty.object({}).loose();

export const GET = createTenantRoute<
  z.output<typeof emptyQuery>,
  z.output<typeof scoreItemAnalysisResponseSchema>,
  typeof assessmentIdParamsSchema
>({
  metadata: listProgressScoreRosterMetadata,
  input: emptyQuery,
  params: assessmentIdParamsSchema,
  output: scoreItemAnalysisResponseSchema,
  handler: async ({ tx, ctx, params }) => listScoreItemAnalysis(tx, ctx, params["assessmentId"]),
});
