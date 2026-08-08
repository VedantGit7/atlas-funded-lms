import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  courseIdParamsSchema,
  progressLearnersListResponseSchema,
  progressLearnersQuerySchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { listProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";
import { listProgressLearners } from "@atlas/domain/reports/progress-score-roster.service";

export const GET = createTenantRoute<
  z.output<typeof progressLearnersQuerySchema>,
  z.output<typeof progressLearnersListResponseSchema>,
  typeof courseIdParamsSchema
>({
  metadata: listProgressScoreRosterMetadata,
  input: progressLearnersQuerySchema,
  params: courseIdParamsSchema,
  output: progressLearnersListResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    listProgressLearners(tx, ctx, params.courseId, input),
});
