import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  sendProgressMessageResponseSchema,
  sendScoreMessageBodySchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { mutateProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";
import { sendScoreRosterMessage } from "../../../../../../../server/reports/progress-score-roster-actions.service";

export const POST = createTenantRoute<
  z.output<typeof sendScoreMessageBodySchema>,
  z.output<typeof sendProgressMessageResponseSchema>
>({
  metadata: mutateProgressScoreRosterMetadata,
  body: sendScoreMessageBodySchema,
  output: sendProgressMessageResponseSchema,
  handler: async ({ tx, ctx, input }) => sendScoreRosterMessage(tx, ctx, input),
});
