import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  exportProgressScoreBodySchema,
  exportProgressScoreResponseSchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { exportProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";
import { exportProgressScoreRoster } from "../../../../../../../server/reports/progress-score-roster-actions.service";

export const POST = createTenantRoute<
  z.output<typeof exportProgressScoreBodySchema>,
  z.output<typeof exportProgressScoreResponseSchema>
>({
  metadata: exportProgressScoreRosterMetadata,
  body: exportProgressScoreBodySchema,
  output: exportProgressScoreResponseSchema,
  handler: async ({ tx, ctx, input }) =>
    exportProgressScoreRoster(tx, ctx, { ...input, tab: "scores" }),
});
