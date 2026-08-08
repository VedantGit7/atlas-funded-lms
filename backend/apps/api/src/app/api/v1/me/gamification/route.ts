import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { gamificationProfileResponseSchema } from "../../../../../server/gamification/gamification.schemas";
import { getMyGamificationProfile } from "../../../../../server/gamification/gamification.service";
import { routeMetadata } from "./route.metadata";

type GamificationProfileResponse = z.output<typeof gamificationProfileResponseSchema>;

export const GET = createTenantRoute<Record<string, never>, GamificationProfileResponse>({
  metadata: routeMetadata,
  output: gamificationProfileResponseSchema,
  handler: async ({ tx, ctx }) => getMyGamificationProfile(tx, ctx),
});
