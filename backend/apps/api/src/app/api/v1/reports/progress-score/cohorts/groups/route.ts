import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  cohortGroupsQuerySchema,
  cohortGroupsResponseSchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { listProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";
import { listCohortGroups } from "@atlas/domain/reports/progress-score-cohorts.service";

export const GET = createTenantRoute<
  z.output<typeof cohortGroupsQuerySchema>,
  z.output<typeof cohortGroupsResponseSchema>
>({
  metadata: listProgressScoreRosterMetadata,
  input: cohortGroupsQuerySchema,
  output: cohortGroupsResponseSchema,
  handler: async ({ tx, ctx, input }) => listCohortGroups(tx, ctx, input),
});
