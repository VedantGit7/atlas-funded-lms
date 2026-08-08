import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  retryCohortMessageBodySchema,
  retryCohortMessageParamsSchema,
  retryCohortMessageResponseSchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { mutateProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";
import { retryCohortMessage } from "@atlas/api-server/reports/progress-score-roster-actions.service";

export const POST = createTenantRoute<
  z.output<typeof retryCohortMessageBodySchema>,
  z.output<typeof retryCohortMessageResponseSchema>,
  typeof retryCohortMessageParamsSchema
>({
  metadata: mutateProgressScoreRosterMetadata,
  body: retryCohortMessageBodySchema,
  params: retryCohortMessageParamsSchema,
  output: retryCohortMessageResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    retryCohortMessage(tx, ctx, params["campaignId"], input),
});
