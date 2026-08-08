import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  pollIdParamsSchema,
  pollLiveMonitorResponseSchema,
} from "@atlas/domain/reports/polls-roster.dto";
import { listPollsRosterMetadata } from "@atlas/domain/reports/polls-roster.route-metadata";
import { getPollLiveMonitor } from "@atlas/domain/reports/polls-roster.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof pollLiveMonitorResponseSchema>,
  typeof pollIdParamsSchema
>({
  metadata: listPollsRosterMetadata,
  input: noBodySchema,
  params: pollIdParamsSchema,
  output: pollLiveMonitorResponseSchema,
  handler: async ({ tx, ctx, params }) => getPollLiveMonitor(tx, ctx, params.pollId),
});
