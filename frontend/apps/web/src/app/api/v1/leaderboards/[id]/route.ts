import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  leaderboardDetailResponseSchema,
  leaderboardIdParamsSchema,
} from "../../../../../server/gamification/gamification.schemas";
import { getLeaderboardDetail } from "../../../../../server/gamification/gamification.service";
import { routeMetadata } from "./route.metadata";

type LeaderboardDetailResponse = z.output<typeof leaderboardDetailResponseSchema>;

export const GET = createTenantRoute<
  Record<string, never>,
  LeaderboardDetailResponse,
  typeof leaderboardIdParamsSchema
>({
  metadata: routeMetadata,
  params: leaderboardIdParamsSchema,
  output: leaderboardDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const leaderboardId = params["id"];
    if (!leaderboardId) {
      throw new Error("Missing leaderboard id.");
    }
    return getLeaderboardDetail(tx, ctx, leaderboardId);
  },
});
