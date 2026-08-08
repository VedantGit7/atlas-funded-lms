import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  pollIdParamsSchema,
  pollNonRespondentsListResponseSchema,
  pollNonRespondentsQuerySchema,
} from "@atlas/domain/reports/polls-roster.dto";
import { listPollsRosterMetadata } from "@atlas/domain/reports/polls-roster.route-metadata";
import { listPollNonRespondents } from "@atlas/domain/reports/polls-roster.service";

export const GET = createTenantRoute<
  z.output<typeof pollNonRespondentsQuerySchema>,
  z.output<typeof pollNonRespondentsListResponseSchema>,
  typeof pollIdParamsSchema
>({
  metadata: listPollsRosterMetadata,
  input: pollNonRespondentsQuerySchema,
  params: pollIdParamsSchema,
  output: pollNonRespondentsListResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    listPollNonRespondents(tx, ctx, params["pollId"], input),
});
