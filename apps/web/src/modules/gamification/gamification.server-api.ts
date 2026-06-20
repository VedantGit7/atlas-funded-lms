import { serverApi } from "../../lib/server-api";
import type { z } from "zod";
import type {
  badgeListResponseSchema,
  gamificationProfileResponseSchema,
  leaderboardDetailResponseSchema,
  leaderboardListResponseSchema,
  streakListResponseSchema,
} from "../../server/gamification/gamification.schemas";

type GamificationProfileResponse = z.infer<typeof gamificationProfileResponseSchema>;
type StreakListResponse = z.infer<typeof streakListResponseSchema>;
type BadgeListResponse = z.infer<typeof badgeListResponseSchema>;
type LeaderboardListResponse = z.infer<typeof leaderboardListResponseSchema>;
type LeaderboardDetailResponse = z.infer<typeof leaderboardDetailResponseSchema>;

export const gamificationServerApi = {
  async getMyGamification(): Promise<GamificationProfileResponse> {
    return serverApi.get<GamificationProfileResponse>("/api/v1/me/gamification");
  },

  async getMyStreaks(): Promise<StreakListResponse> {
    return serverApi.get<StreakListResponse>("/api/v1/me/streaks");
  },

  async listBadges(): Promise<BadgeListResponse> {
    return serverApi.get<BadgeListResponse>("/api/v1/badges");
  },

  async listLeaderboards(): Promise<LeaderboardListResponse> {
    return serverApi.get<LeaderboardListResponse>("/api/v1/leaderboards");
  },

  async getLeaderboard(id: string): Promise<LeaderboardDetailResponse> {
    return serverApi.get<LeaderboardDetailResponse>(`/api/v1/leaderboards/${id}`);
  },
};
