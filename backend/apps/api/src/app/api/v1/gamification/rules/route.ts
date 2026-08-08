import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  gamificationRulesResponseSchema,
  updateGamificationRulesBodySchema,
} from "../../../../../server/gamification/gamification.schemas";
import {
  getGamificationRules,
  updateGamificationRules,
} from "../../../../../server/gamification/gamification.service";
import { getRouteMetadata, putRouteMetadata } from "./route.metadata";

type GamificationRulesResponse = z.output<typeof gamificationRulesResponseSchema>;
type UpdateGamificationRulesBody = z.output<typeof updateGamificationRulesBodySchema>;

export const GET = createTenantRoute<Record<string, never>, GamificationRulesResponse>({
  metadata: getRouteMetadata,
  output: gamificationRulesResponseSchema,
  handler: async ({ tx }) => getGamificationRules(tx),
});

export const PUT = createTenantRoute<UpdateGamificationRulesBody, GamificationRulesResponse>({
  metadata: putRouteMetadata,
  body: updateGamificationRulesBodySchema,
  output: gamificationRulesResponseSchema,
  handler: async ({ tx, ctx, input }) => updateGamificationRules(tx, ctx, input),
});
