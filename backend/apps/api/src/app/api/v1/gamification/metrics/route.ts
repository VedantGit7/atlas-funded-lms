import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { gamificationMetricsResponseSchema } from "../../../../../server/gamification/gamification.schemas";
import { getGamificationMetrics } from "../../../../../server/gamification/gamification.service";
import { routeMetadata } from "./route.metadata";

type GamificationMetricsResponse = z.output<typeof gamificationMetricsResponseSchema>;

export const GET = createTenantRoute<Record<string, never>, GamificationMetricsResponse>({
  metadata: routeMetadata,
  output: gamificationMetricsResponseSchema,
  handler: async ({ tx }) => getGamificationMetrics(tx),
});
