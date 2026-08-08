import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  sendProgressMessageBodySchema,
  sendProgressMessageResponseSchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { mutateProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";
import { sendProgressRosterMessage } from "../../../../../../../server/reports/progress-score-roster-actions.service";

export const POST = createTenantRoute<
  z.output<typeof sendProgressMessageBodySchema>,
  z.output<typeof sendProgressMessageResponseSchema>
>({
  metadata: mutateProgressScoreRosterMetadata,
  body: sendProgressMessageBodySchema,
  output: sendProgressMessageResponseSchema,
  handler: async ({ tx, ctx, input }) => sendProgressRosterMessage(tx, ctx, input),
});
