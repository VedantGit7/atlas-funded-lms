import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createProgressGroupBodySchema,
  createProgressGroupResponseSchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { mutateProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";
import { createProgressGroup } from "@atlas/domain/reports/progress-score-roster.service";

export const POST = createTenantRoute<
  z.output<typeof createProgressGroupBodySchema>,
  z.output<typeof createProgressGroupResponseSchema>
>({
  metadata: mutateProgressScoreRosterMetadata,
  body: createProgressGroupBodySchema,
  output: createProgressGroupResponseSchema,
  handler: async ({ tx, ctx, input }) => createProgressGroup(tx, ctx, input),
});
