import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  extendProgressLearnerBodySchema,
  extendProgressLearnerResponseSchema,
  progressLearnerDetailParamsSchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { mutateProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";
import { extendProgressLearnerAccess } from "@atlas/domain/reports/progress-score-learner-detail.service";

export const POST = createTenantRoute<
  z.output<typeof extendProgressLearnerBodySchema>,
  z.output<typeof extendProgressLearnerResponseSchema>,
  typeof progressLearnerDetailParamsSchema
>({
  metadata: mutateProgressScoreRosterMetadata,
  body: extendProgressLearnerBodySchema,
  params: progressLearnerDetailParamsSchema,
  output: extendProgressLearnerResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    extendProgressLearnerAccess(
      tx,
      ctx,
      params["productType"],
      params["productId"],
      params["enrollmentId"],
      input,
    ),
});
