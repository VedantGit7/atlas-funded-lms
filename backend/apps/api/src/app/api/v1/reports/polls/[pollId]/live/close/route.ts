import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  pollIdParamsSchema,
  pollLiveMonitorResponseSchema,
} from "@atlas/domain/reports/polls-roster.dto";
import { mutatePollLiveMetadata } from "@atlas/domain/reports/polls-roster.route-metadata";
import { closePollLive } from "@atlas/domain/reports/polls-roster.service";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof pollLiveMonitorResponseSchema>,
  typeof pollIdParamsSchema
>({
  metadata: mutatePollLiveMetadata,
  params: pollIdParamsSchema,
  body: noBodySchema,
  output: pollLiveMonitorResponseSchema,
  handler: async ({ tx, ctx, params }) => closePollLive(tx, ctx, params.pollId),
});
