import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  liveSessionIdParamsSchema,
  liveSessionPollReportResponseSchema,
} from "@atlas/domain/reports/polls-roster.dto";
import { listPollsRosterMetadata } from "@atlas/domain/reports/polls-roster.route-metadata";
import { getLiveSessionPollReport } from "@atlas/domain/reports/polls-roster.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof liveSessionPollReportResponseSchema>,
  typeof liveSessionIdParamsSchema
>({
  metadata: listPollsRosterMetadata,
  input: noBodySchema,
  params: liveSessionIdParamsSchema,
  output: liveSessionPollReportResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    getLiveSessionPollReport(tx, ctx, params["liveSessionId"]),
});
