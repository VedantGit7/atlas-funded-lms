import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  progressLearnerDetailParamsSchema,
  resetProgressLearnerBodySchema,
  resetProgressLearnerResponseSchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { mutateProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";
import { resetProgressLearner } from "@atlas/domain/reports/progress-score-learner-detail.service";

export const POST = createTenantRoute<
  z.output<typeof resetProgressLearnerBodySchema>,
  z.output<typeof resetProgressLearnerResponseSchema>,
  typeof progressLearnerDetailParamsSchema
>({
  metadata: mutateProgressScoreRosterMetadata,
  body: resetProgressLearnerBodySchema,
  params: progressLearnerDetailParamsSchema,
  output: resetProgressLearnerResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    resetProgressLearner(
      tx,
      ctx,
      params.productType,
      params.productId,
      params.enrollmentId,
      input,
    ),
});
