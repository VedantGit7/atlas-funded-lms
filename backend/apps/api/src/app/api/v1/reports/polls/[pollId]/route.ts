import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  pollDetailResponseSchema,
  pollIdParamsSchema,
} from "@atlas/domain/reports/polls-roster.dto";
import { listPollsRosterMetadata } from "@atlas/domain/reports/polls-roster.route-metadata";
import { getPollDetailedReport } from "@atlas/domain/reports/polls-roster.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof pollDetailResponseSchema>,
  typeof pollIdParamsSchema
>({
  metadata: listPollsRosterMetadata,
  input: noBodySchema,
  params: pollIdParamsSchema,
  output: pollDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getPollDetailedReport(tx, ctx, params.pollId),
});
