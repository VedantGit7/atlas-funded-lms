import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  courseIdParamsSchema,
  scoreQuizzesListResponseSchema,
  scoreQuizzesQuerySchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { listProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";
import { listScoreQuizzes } from "@atlas/domain/reports/progress-score-roster.service";

export const GET = createTenantRoute<
  z.output<typeof scoreQuizzesQuerySchema>,
  z.output<typeof scoreQuizzesListResponseSchema>,
  typeof courseIdParamsSchema
>({
  metadata: listProgressScoreRosterMetadata,
  input: scoreQuizzesQuerySchema,
  params: courseIdParamsSchema,
  output: scoreQuizzesListResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    listScoreQuizzes(tx, ctx, params["courseId"], input),
});
