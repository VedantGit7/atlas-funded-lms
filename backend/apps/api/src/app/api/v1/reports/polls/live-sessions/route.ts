import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  liveSessionsPollsListQuerySchema,
  liveSessionsPollsListResponseSchema,
} from "@atlas/domain/reports/polls-roster.dto";
import { listPollsRosterMetadata } from "@atlas/domain/reports/polls-roster.route-metadata";
import { listLiveSessionsWithPolls } from "@atlas/domain/reports/polls-roster.service";

export const GET = createTenantRoute<
  z.output<typeof liveSessionsPollsListQuerySchema>,
  z.output<typeof liveSessionsPollsListResponseSchema>
>({
  metadata: listPollsRosterMetadata,
  input: liveSessionsPollsListQuerySchema,
  output: liveSessionsPollsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listLiveSessionsWithPolls(tx, ctx, input),
});
