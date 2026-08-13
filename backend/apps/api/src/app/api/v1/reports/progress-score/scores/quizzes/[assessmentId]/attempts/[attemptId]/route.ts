import type { z } from "zod";
import { z as zodEmpty } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  scoreAttemptReviewParamsSchema,
  scoreAttemptReviewResponseSchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { listProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";
import { getScoreAttemptReview } from "../../../../../../../../../../server/reports/progress-score-attempt-review.service";

const emptyQuery = zodEmpty.object({}).loose();

export const GET = createTenantRoute<
  z.output<typeof emptyQuery>,
  z.output<typeof scoreAttemptReviewResponseSchema>,
  typeof scoreAttemptReviewParamsSchema
>({
  metadata: listProgressScoreRosterMetadata,
  input: emptyQuery,
  params: scoreAttemptReviewParamsSchema,
  output: scoreAttemptReviewResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    getScoreAttemptReview(tx, ctx, params["assessmentId"], params["attemptId"]),
});
