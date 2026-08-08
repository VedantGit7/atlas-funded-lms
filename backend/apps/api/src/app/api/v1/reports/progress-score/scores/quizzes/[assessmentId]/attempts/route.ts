import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  assessmentIdParamsSchema,
  scoreAttemptHistoryQuerySchema,
  scoreAttemptHistoryResponseSchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { listProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";
import { listScoreAttemptHistory } from "@atlas/domain/reports/progress-score-roster.service";

export const GET = createTenantRoute<
  z.output<typeof scoreAttemptHistoryQuerySchema>,
  z.output<typeof scoreAttemptHistoryResponseSchema>,
  typeof assessmentIdParamsSchema
>({
  metadata: listProgressScoreRosterMetadata,
  input: scoreAttemptHistoryQuerySchema,
  params: assessmentIdParamsSchema,
  output: scoreAttemptHistoryResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    listScoreAttemptHistory(tx, ctx, params["assessmentId"], input),
});
