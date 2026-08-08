import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  analyticsFunnelQuerySchema,
  analyticsFunnelResponseSchema,
} from "@atlas/domain/analytics/analytics.dto";
import { queryAnalyticsFunnel } from "@atlas/domain/analytics/analytics.service";
import { analyticsFunnelMetadata } from "../../../../../server/analytics/analytics.route-metadata";

export const GET = createTenantRoute<
  z.output<typeof analyticsFunnelQuerySchema>,
  z.output<typeof analyticsFunnelResponseSchema>
>({
  metadata: analyticsFunnelMetadata,
  input: analyticsFunnelQuerySchema,
  output: analyticsFunnelResponseSchema,
  handler: async ({ tx, ctx, input }) => queryAnalyticsFunnel(tx, ctx, input),
});
