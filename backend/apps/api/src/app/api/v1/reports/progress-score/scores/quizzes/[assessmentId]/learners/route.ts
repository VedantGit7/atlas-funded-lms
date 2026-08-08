import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  assessmentIdParamsSchema,
  scoreLearnersListResponseSchema,
  scoreLearnersQuerySchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { listProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";
import { listScoreLearners } from "@atlas/domain/reports/progress-score-roster.service";

export const GET = createTenantRoute<
  z.output<typeof scoreLearnersQuerySchema>,
  z.output<typeof scoreLearnersListResponseSchema>,
  typeof assessmentIdParamsSchema
>({
  metadata: listProgressScoreRosterMetadata,
  input: scoreLearnersQuerySchema,
  params: assessmentIdParamsSchema,
  output: scoreLearnersListResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    listScoreLearners(tx, ctx, params.assessmentId, input),
});
