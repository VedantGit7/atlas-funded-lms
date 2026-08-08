import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  saveAttemptGradingBodySchema,
  saveAttemptGradingResponseSchema,
  scoreAttemptReviewParamsSchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { mutateProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";
import { saveAttemptGrading } from "../../../../../../../../../../../server/reports/progress-score-attempt-review.service";

export const POST = createTenantRoute<
  z.output<typeof saveAttemptGradingBodySchema>,
  z.output<typeof saveAttemptGradingResponseSchema>,
  typeof scoreAttemptReviewParamsSchema
>({
  metadata: mutateProgressScoreRosterMetadata,
  body: saveAttemptGradingBodySchema,
  params: scoreAttemptReviewParamsSchema,
  output: saveAttemptGradingResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    saveAttemptGrading(tx, ctx, params["assessmentId"], params["attemptId"], input),
});
