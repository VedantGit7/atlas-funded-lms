import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  pollsCompareQuerySchema,
  pollsCompareResponseSchema,
} from "@atlas/domain/reports/polls-roster.dto";
import { listPollsRosterMetadata } from "@atlas/domain/reports/polls-roster.route-metadata";
import { comparePolls } from "@atlas/domain/reports/polls-roster.service";

export const GET = createTenantRoute<
  z.output<typeof pollsCompareQuerySchema>,
  z.output<typeof pollsCompareResponseSchema>
>({
  metadata: listPollsRosterMetadata,
  input: pollsCompareQuerySchema,
  output: pollsCompareResponseSchema,
  handler: async ({ tx, ctx, input }) => comparePolls(tx, ctx, input),
});
