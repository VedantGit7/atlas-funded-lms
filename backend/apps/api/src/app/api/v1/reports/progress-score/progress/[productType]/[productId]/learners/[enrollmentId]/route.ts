import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  progressLearnerDetailParamsSchema,
  progressLearnerDetailResponseSchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { listProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";
import { getProgressLearnerDetail } from "@atlas/domain/reports/progress-score-learner-detail.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof progressLearnerDetailResponseSchema>,
  typeof progressLearnerDetailParamsSchema
>({
  metadata: listProgressScoreRosterMetadata,
  input: noBodySchema,
  params: progressLearnerDetailParamsSchema,
  output: progressLearnerDetailResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    getProgressLearnerDetail(
      tx,
      ctx,
      params.productType,
      params.productId,
      params.enrollmentId,
    ),
});
