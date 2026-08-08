import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  streakFreezeBodySchema,
  streakFreezeParamsSchema,
  streakFreezeResponseSchema,
} from "../../../../../../../server/gamification/gamification.schemas";
import { freezeStreak } from "../../../../../../../server/gamification/gamification.service";
import { routeMetadata } from "./route.metadata";

type StreakFreezeResponse = z.output<typeof streakFreezeResponseSchema>;

export const POST = createTenantRoute<
  z.output<typeof streakFreezeBodySchema>,
  StreakFreezeResponse,
  typeof streakFreezeParamsSchema
>({
  metadata: routeMetadata,
  params: streakFreezeParamsSchema,
  body: streakFreezeBodySchema,
  output: streakFreezeResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const streakKey = params["key"];
    if (!streakKey) {
      throw new Error("Missing streak key.");
    }
    return freezeStreak(tx, ctx, streakKey);
  },
});
