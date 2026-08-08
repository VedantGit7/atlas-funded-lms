import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  resetAttemptBodySchema,
  resetAttemptResponseSchema,
  scoreAttemptReviewParamsSchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { mutateProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";
import { resetScoreAttempt } from "../../../../../../../../../../../server/reports/progress-score-attempt-review.service";

export const POST = createTenantRoute<
  z.output<typeof resetAttemptBodySchema>,
  z.output<typeof resetAttemptResponseSchema>,
  typeof scoreAttemptReviewParamsSchema
>({
  metadata: mutateProgressScoreRosterMetadata,
  body: resetAttemptBodySchema,
  params: scoreAttemptReviewParamsSchema,
  output: resetAttemptResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    resetScoreAttempt(tx, ctx, params["assessmentId"], params["attemptId"], input),
});
