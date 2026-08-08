import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  assessmentIdParamsSchema,
  regradeScoreAttemptsBodySchema,
  regradeScoreAttemptsResponseSchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { mutateProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";
import { regradeScoreAttempts } from "../../../../../../../../../server/reports/progress-score-regrade.service";

export const POST = createTenantRoute<
  z.output<typeof regradeScoreAttemptsBodySchema>,
  z.output<typeof regradeScoreAttemptsResponseSchema>,
  typeof assessmentIdParamsSchema
>({
  metadata: mutateProgressScoreRosterMetadata,
  body: regradeScoreAttemptsBodySchema,
  params: assessmentIdParamsSchema,
  output: regradeScoreAttemptsResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    regradeScoreAttempts(tx, ctx, params.assessmentId, input),
});
