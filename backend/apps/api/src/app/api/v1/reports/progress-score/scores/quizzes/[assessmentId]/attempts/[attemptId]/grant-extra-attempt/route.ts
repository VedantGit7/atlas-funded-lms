import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  grantExtraAttemptBodySchema,
  grantExtraAttemptResponseSchema,
  scoreAttemptReviewParamsSchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { mutateProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";
import { grantExtraScoreAttempt } from "../../../../../../../../../../../server/reports/progress-score-attempt-review.service";

export const POST = createTenantRoute<
  z.output<typeof grantExtraAttemptBodySchema>,
  z.output<typeof grantExtraAttemptResponseSchema>,
  typeof scoreAttemptReviewParamsSchema
>({
  metadata: mutateProgressScoreRosterMetadata,
  body: grantExtraAttemptBodySchema,
  params: scoreAttemptReviewParamsSchema,
  output: grantExtraAttemptResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    grantExtraScoreAttempt(tx, ctx, params.assessmentId, params.attemptId, input),
});
