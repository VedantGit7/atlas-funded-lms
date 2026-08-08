import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  leaderboardDetailQuerySchema,
  leaderboardDetailResponseSchema,
  leaderboardIdParamsSchema,
} from "../../../../../server/gamification/gamification.schemas";
import { getLeaderboardDetail } from "../../../../../server/gamification/gamification.service";
import { routeMetadata } from "./route.metadata";

type LeaderboardDetailQuery = z.output<typeof leaderboardDetailQuerySchema>;
type LeaderboardDetailResponse = z.output<typeof leaderboardDetailResponseSchema>;

export const GET = createTenantRoute<
  LeaderboardDetailQuery,
  LeaderboardDetailResponse,
  typeof leaderboardIdParamsSchema
>({
  metadata: routeMetadata,
  params: leaderboardIdParamsSchema,
  input: leaderboardDetailQuerySchema,
  output: leaderboardDetailResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const leaderboardId = params["id"];
    if (!leaderboardId) {
      throw new Error("Missing leaderboard id.");
    }
    return getLeaderboardDetail(tx, ctx, leaderboardId, {
      ...(input.league ? { league: input.league } : {}),
    });
  },
});
