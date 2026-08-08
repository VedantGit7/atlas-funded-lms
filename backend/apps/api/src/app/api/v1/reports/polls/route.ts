import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  pollsListQuerySchema,
  pollsListResponseSchema,
} from "@atlas/domain/reports/polls-roster.dto";
import { listPollsRosterMetadata } from "@atlas/domain/reports/polls-roster.route-metadata";
import { listPollsRoster } from "@atlas/domain/reports/polls-roster.service";

export const GET = createTenantRoute<
  z.output<typeof pollsListQuerySchema>,
  z.output<typeof pollsListResponseSchema>
>({
  metadata: listPollsRosterMetadata,
  input: pollsListQuerySchema,
  output: pollsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listPollsRoster(tx, ctx, input),
});
