import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { gamificationPublicConfigResponseSchema } from "../../../../../server/gamification/gamification.schemas";
import { getGamificationPublicConfig } from "../../../../../server/gamification/gamification.service";
import { routeMetadata } from "./route.metadata";

type GamificationPublicConfigResponse = z.output<typeof gamificationPublicConfigResponseSchema>;

export const GET = createTenantRoute<Record<string, never>, GamificationPublicConfigResponse>({
  metadata: routeMetadata,
  output: gamificationPublicConfigResponseSchema,
  handler: async ({ tx }) => getGamificationPublicConfig(tx),
});
