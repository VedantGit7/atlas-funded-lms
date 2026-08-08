import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createProgressGroupResponseSchema,
  createScoreGroupBodySchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { mutateProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";
import { createScoreGroup } from "@atlas/domain/reports/progress-score-roster.service";

export const POST = createTenantRoute<
  z.output<typeof createScoreGroupBodySchema>,
  z.output<typeof createProgressGroupResponseSchema>
>({
  metadata: mutateProgressScoreRosterMetadata,
  body: createScoreGroupBodySchema,
  output: createProgressGroupResponseSchema,
  handler: async ({ tx, ctx, input }) => createScoreGroup(tx, ctx, input),
});
