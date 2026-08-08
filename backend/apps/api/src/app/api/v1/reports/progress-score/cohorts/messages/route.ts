import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  cohortMessagesQuerySchema,
  cohortMessagesResponseSchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { listProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";
import { listCohortMessages } from "@atlas/domain/reports/progress-score-cohorts.service";

export const GET = createTenantRoute<
  z.output<typeof cohortMessagesQuerySchema>,
  z.output<typeof cohortMessagesResponseSchema>
>({
  metadata: listProgressScoreRosterMetadata,
  input: cohortMessagesQuerySchema,
  output: cohortMessagesResponseSchema,
  handler: async ({ tx, ctx, input }) => listCohortMessages(tx, ctx, input),
});
