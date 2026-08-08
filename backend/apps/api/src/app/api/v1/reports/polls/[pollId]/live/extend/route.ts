import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  pollIdParamsSchema,
  pollLiveExtendBodySchema,
  pollLiveMonitorResponseSchema,
} from "@atlas/domain/reports/polls-roster.dto";
import { mutatePollLiveMetadata } from "@atlas/domain/reports/polls-roster.route-metadata";
import { extendPollLive } from "@atlas/domain/reports/polls-roster.service";

export const POST = createTenantRoute<
  z.output<typeof pollLiveExtendBodySchema>,
  z.output<typeof pollLiveMonitorResponseSchema>,
  typeof pollIdParamsSchema
>({
  metadata: mutatePollLiveMetadata,
  params: pollIdParamsSchema,
  body: pollLiveExtendBodySchema,
  output: pollLiveMonitorResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    extendPollLive(tx, ctx, params.pollId, input),
});
