import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  scoreAttemptReviewParamsSchema,
  voidAttemptBodySchema,
  voidAttemptResponseSchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { mutateProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";
import { voidScoreAttempt } from "../../../../../../../../../../../server/reports/progress-score-attempt-review.service";

export const POST = createTenantRoute<
  z.output<typeof voidAttemptBodySchema>,
  z.output<typeof voidAttemptResponseSchema>,
  typeof scoreAttemptReviewParamsSchema
>({
  metadata: mutateProgressScoreRosterMetadata,
  body: voidAttemptBodySchema,
  params: scoreAttemptReviewParamsSchema,
  output: voidAttemptResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    voidScoreAttempt(tx, ctx, params.assessmentId, params.attemptId, input),
});
