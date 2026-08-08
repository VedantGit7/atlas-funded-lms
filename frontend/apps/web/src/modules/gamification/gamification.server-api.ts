import { serverApi } from "../../lib/server-api";
import type { z } from "zod";
import type {
  badgeListResponseSchema,
  badgeProgressResponseSchema,
  gamificationProfileResponseSchema,
  gamificationPublicConfigResponseSchema,
  leaderboardDetailResponseSchema,
  leaderboardListResponseSchema,
  myActivityResponseSchema,
  myLedgerResponseSchema,
  streakListResponseSchema,
} from "@atlas/contracts/gamification/gamification.schemas";
import type { myQuestsResponseSchema } from "@atlas/contracts/gamification/quest.schemas";
import type { myRewardsResponseSchema } from "@atlas/contracts/gamification/rewards.schemas";
import type { myActiveSeasonalEventResponseSchema } from "@atlas/contracts/gamification/seasonal.schemas";

type GamificationProfileResponse = z.infer<typeof gamificationProfileResponseSchema>;
type StreakListResponse = z.infer<typeof streakListResponseSchema>;
type BadgeListResponse = z.infer<typeof badgeListResponseSchema>;
type LeaderboardListResponse = z.infer<typeof leaderboardListResponseSchema>;
type LeaderboardDetailResponse = z.infer<typeof leaderboardDetailResponseSchema>;
type GamificationPublicConfigResponse = z.infer<typeof gamificationPublicConfigResponseSchema>;
type MyLedgerResponse = z.infer<typeof myLedgerResponseSchema>;
type MyActivityResponse = z.infer<typeof myActivityResponseSchema>;
type MyQuestsResponse = z.infer<typeof myQuestsResponseSchema>;
type MyRewardsResponse = z.infer<typeof myRewardsResponseSchema>;
type MyActiveSeasonalEventResponse = z.infer<typeof myActiveSeasonalEventResponseSchema>;
type BadgeProgressResponse = z.infer<typeof badgeProgressResponseSchema>;

export const gamificationServerApi = {
  async getPublicConfig(): Promise<GamificationPublicConfigResponse> {
    return serverApi.get<GamificationPublicConfigResponse>("/api/v1/gamification/config");
  },

  async getMyGamification(): Promise<GamificationProfileResponse> {
    return serverApi.get<GamificationProfileResponse>("/api/v1/me/gamification");
  },

  async getMyLedger(limit = 10): Promise<MyLedgerResponse> {
    return serverApi.get<MyLedgerResponse>(`/api/v1/me/gamification/ledger?limit=${String(limit)}`);
  },

  async getMyActivity(): Promise<MyActivityResponse> {
    return serverApi.get<MyActivityResponse>("/api/v1/me/activity");
  },

  async getMyQuests(): Promise<MyQuestsResponse> {
    return serverApi.get<MyQuestsResponse>("/api/v1/me/quests");
  },

  async getMyRewards(): Promise<MyRewardsResponse> {
    return serverApi.get<MyRewardsResponse>("/api/v1/me/rewards");
  },

  async getMyActiveSeasonalEvent(): Promise<MyActiveSeasonalEventResponse> {
    return serverApi.get<MyActiveSeasonalEventResponse>("/api/v1/me/seasonal-events/active");
  },

  async getMyStreaks(): Promise<StreakListResponse> {
    return serverApi.get<StreakListResponse>("/api/v1/me/streaks");
  },

  async getMyBadgeProgress(): Promise<BadgeProgressResponse> {
    return serverApi.get<BadgeProgressResponse>("/api/v1/me/badges/progress");
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
