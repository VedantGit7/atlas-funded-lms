import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  pollOptionDetailResponseSchema,
  pollOptionParamsSchema,
} from "@atlas/domain/reports/polls-roster.dto";
import { listPollsRosterMetadata } from "@atlas/domain/reports/polls-roster.route-metadata";
import { getPollOptionDetail } from "@atlas/domain/reports/polls-roster.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof pollOptionDetailResponseSchema>,
  typeof pollOptionParamsSchema
>({
  metadata: listPollsRosterMetadata,
  input: noBodySchema,
  params: pollOptionParamsSchema,
  output: pollOptionDetailResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    getPollOptionDetail(tx, ctx, params.pollId, params.optionId),
});
