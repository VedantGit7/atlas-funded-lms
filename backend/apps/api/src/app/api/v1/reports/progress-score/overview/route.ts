import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  progressScoreOverviewQuerySchema,
  progressScoreOverviewResponseSchema,
} from "@atlas/domain/reports/progress-score-overview.dto";
import { getProgressScoreOverview } from "@atlas/domain/reports/progress-score-overview.service";
import { listProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";

export const GET = createTenantRoute<
  z.output<typeof progressScoreOverviewQuerySchema>,
  z.output<typeof progressScoreOverviewResponseSchema>
>({
  metadata: listProgressScoreRosterMetadata,
  input: progressScoreOverviewQuerySchema,
  output: progressScoreOverviewResponseSchema,
  handler: async ({ tx, ctx, input }) => getProgressScoreOverview(tx, ctx, input),
});
