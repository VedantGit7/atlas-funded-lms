import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  exportPollRosterBodySchema,
  exportPollRosterResponseSchema,
} from "@atlas/domain/reports/polls-roster.dto";
import { exportPollsRosterMetadata } from "@atlas/domain/reports/polls-roster.route-metadata";
import { exportPollRoster } from "../../../../../../../server/reports/polls-roster-actions.service";

export const POST = createTenantRoute<
  z.output<typeof exportPollRosterBodySchema>,
  z.output<typeof exportPollRosterResponseSchema>
>({
  metadata: exportPollsRosterMetadata,
  body: exportPollRosterBodySchema,
  output: exportPollRosterResponseSchema,
  handler: async ({ tx, ctx, input }) => exportPollRoster(tx, ctx, input),
});
