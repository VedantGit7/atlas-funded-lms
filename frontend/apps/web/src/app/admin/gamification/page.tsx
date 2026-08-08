import type { MembersListResponse } from "@atlas/contracts/membership/schemas/admin-members";
import type {
  badgeListResponseSchema,
  gamificationEventsResponseSchema,
  gamificationMetricsResponseSchema,
  gamificationRulesResponseSchema,
  leaderboardListResponseSchema,
} from "@atlas/contracts/gamification/gamification.schemas";
import type { z } from "zod";
import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { AdminGamificationEditor } from "../../../features/gamification/components/AdminGamificationEditor";
import type { AdminQuest } from "../../../features/gamification/components/QuestsAdminPanel";
import type {
  RewardCurrency,
  RewardItem,
} from "../../../features/gamification/components/RewardsShopPanel";
import type { SeasonalEventDto } from "../../../features/gamification/components/SeasonalEventsPanel";
import { ServerApiError, serverApi } from "../../../lib/server-api";

type MemberListItem = MembersListResponse["data"]["items"][number];
type LeaderboardListResponse = z.infer<typeof leaderboardListResponseSchema>;
type BadgeListResponse = z.infer<typeof badgeListResponseSchema>;
type GamificationMetricsResponse = z.infer<typeof gamificationMetricsResponseSchema>;
type GamificationRulesResponse = z.infer<typeof gamificationRulesResponseSchema>;
type GamificationEventsResponse = z.infer<typeof gamificationEventsResponseSchema>;
type QuestAdminListResponse = { data: { items: AdminQuest[] } };
type RewardsAdminResponse = { data: { currencies: RewardCurrency[]; items: RewardItem[] } };
type SeasonalEventsListResponse = { data: { items: SeasonalEventDto[] } };
type CourseListResponse = {
  data: { items: Array<{ id: string; title: string }> };
};

async function softGet<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

function memberLabel(member: MemberListItem): string {
  return member.profile?.displayName ?? member.invitedEmail ?? member.id;
}

export default async function AdminGamificationPage() {
  try {
    const membersResult = await serverApi.get<MembersListResponse>(
      "/api/v1/members?limit=25&status=ACTIVE",
    );
    const badgesResult = await serverApi.get<BadgeListResponse>("/api/v1/badges");

    const [leaderboards, metrics, courses, rules, events, quests, rewards, seasonalEvents] =
      await Promise.all([
        softGet(serverApi.get<LeaderboardListResponse>("/api/v1/leaderboards")),
        softGet(serverApi.get<GamificationMetricsResponse>("/api/v1/gamification/metrics")),
        softGet(serverApi.get<CourseListResponse>("/api/v1/courses?limit=100")),
        softGet(serverApi.get<GamificationRulesResponse>("/api/v1/gamification/rules")),
        softGet(serverApi.get<GamificationEventsResponse>("/api/v1/gamification/events")),
        softGet(serverApi.get<QuestAdminListResponse>("/api/v1/quests")),
        softGet(serverApi.get<RewardsAdminResponse>("/api/v1/rewards")),
        softGet(serverApi.get<SeasonalEventsListResponse>("/api/v1/seasonal-events")),
      ]);

    const memberOptions = membersResult.data.items.map((member) => ({
      id: member.id,
      label: memberLabel(member),
    }));

    return (
      <AdminPageGate screenId="T14" state="ready" title="Gamification Config">
        <main>
          <AdminGamificationEditor
            members={memberOptions}
            initialLeaderboards={leaderboards?.data.items ?? []}
            initialBadges={badgesResult.data.items}
            courses={(courses?.data.items ?? []).map(({ id, title }) => ({ id, title }))}
            metrics={metrics?.data ?? null}
            initialRules={rules?.data ?? null}
            gamificationEvents={events?.data.items ?? null}
            initialQuests={quests?.data.items ?? []}
            initialRewardCurrencies={rewards?.data.currencies ?? []}
            initialRewardItems={rewards?.data.items ?? []}
            initialSeasonalEvents={seasonalEvents?.data.items ?? []}
          />
        </main>
      </AdminPageGate>
    );
  } catch (error) {
    if (
      error instanceof ServerApiError &&
      error.status === 403 &&
      error.code === "ENTITLEMENT_REQUIRED"
    ) {
      return (
        <AdminPageGate
          screenId="T14"
          state="denied"
          title="Gamification Config"
          deniedMessage="Gamification requires the gamification.enable entitlement on your tenant plan."
        />
      );
    }

    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T14"
          state="denied"
          title="Gamification Config"
          deniedMessage="You do not have permission to manage gamification."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T14"
          state="error"
          title="Gamification Config"
          errorMessage={`Failed to load gamification config. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
