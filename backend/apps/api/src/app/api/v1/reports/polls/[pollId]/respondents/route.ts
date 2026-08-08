import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  pollIdParamsSchema,
  pollRespondentsListResponseSchema,
  pollRespondentsQuerySchema,
} from "@atlas/domain/reports/polls-roster.dto";
import { listPollsRosterMetadata } from "@atlas/domain/reports/polls-roster.route-metadata";
import { listPollRespondents } from "@atlas/domain/reports/polls-roster.service";

export const GET = createTenantRoute<
  z.output<typeof pollRespondentsQuerySchema>,
  z.output<typeof pollRespondentsListResponseSchema>,
  typeof pollIdParamsSchema
>({
  metadata: listPollsRosterMetadata,
  input: pollRespondentsQuerySchema,
  params: pollIdParamsSchema,
  output: pollRespondentsListResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    listPollRespondents(tx, ctx, params.pollId, input),
});
