import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { ProgressReveal } from "../../../features/progress/components/ProgressReveal";
import { AchievementStatStrip } from "../../../features/gamification/components/AchievementStatStrip";
import { AchievementToastListener } from "../../../features/gamification/components/AchievementToastListener";
import { BadgeGrid } from "../../../features/gamification/components/BadgeGrid";
import { QuestProgressPanel } from "../../../features/gamification/components/QuestProgressPanel";
import { RewardsCatalog } from "../../../features/gamification/components/RewardsCatalog";
import { SeasonalEventBanner } from "../../../features/gamification/components/SeasonalEventBanner";
import { StreakPanel } from "../../../features/gamification/components/StreakPanel";
import { XpLedgerTimeline } from "../../../features/gamification/components/XpLedgerTimeline";
import { ServerApiError } from "../../../lib/server-api";
import { gamificationServerApi } from "@atlas/contracts-modules/gamification/gamification.server-api";

export default async function AchievementsPage() {
  try {
    const [profile, badges, streaks, ledger, quests, rewards, seasonal, badgeProgress] =
      await Promise.all([
        gamificationServerApi.getMyGamification(),
        gamificationServerApi.listBadges(),
        gamificationServerApi.getMyStreaks(),
        gamificationServerApi
          .getMyLedger(10)
          .catch(() => ({ data: { items: [], nextCursor: null } })),
        gamificationServerApi.getMyQuests().catch(() => ({ data: { items: [] } })),
        gamificationServerApi
          .getMyRewards()
          .catch(() => ({ data: { balances: [], items: [], redemptions: [] } })),
        gamificationServerApi.getMyActiveSeasonalEvent().catch(() => ({ data: { event: null } })),
        gamificationServerApi.getMyBadgeProgress().catch(() => null),
      ]);

    const dailyStreak =
      streaks.data.items.find((item) => item.streakKey === "daily_learning") ??
      streaks.data.items[0] ??
      null;

    return (
      <PageGate state="ready" title="Achievements">
        <AchievementToastListener />
        <main className="mx-auto w-full max-w-6xl space-y-8">
          <PageHeader
            title="Achievements"
            description="Your league standing, XP, badges, quests, and rewards in one place."
          />

          <ProgressReveal>
            <AchievementStatStrip
              league={profile.data.league}
              weeklyRank={profile.data.weeklyRank}
              rankedMembers={profile.data.rankedMembers}
              xpTotal={profile.data.xpTotal}
              levelNumber={profile.data.levelProgress?.levelNumber ?? null}
              levelKey={profile.data.levelKey}
              streak={
                dailyStreak
                  ? {
                      currentCount: dailyStreak.currentCount,
                      longestCount: dailyStreak.longestCount,
                    }
                  : null
              }
            />
          </ProgressReveal>

          {seasonal.data.event ? (
            <ProgressReveal delay={0.05}>
              <SeasonalEventBanner event={seasonal.data.event} />
            </ProgressReveal>
          ) : null}

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="space-y-8 lg:col-span-2">
              <ProgressReveal delay={0.05}>
                <BadgeGrid badges={badgeProgress ? badgeProgress.data.items : badges.data.items} />
              </ProgressReveal>

              <ProgressReveal delay={0.05}>
                <QuestProgressPanel quests={quests.data.items} />
              </ProgressReveal>
            </div>

            <div className="space-y-8">
              <ProgressReveal delay={0.05}>
                <RewardsCatalog
                  balances={rewards.data.balances}
                  items={rewards.data.items}
                  redemptions={rewards.data.redemptions}
                />
              </ProgressReveal>

              {dailyStreak ? (
                <ProgressReveal delay={0.05}>
                  <StreakPanel
                    streakKey={dailyStreak.streakKey}
                    currentCount={dailyStreak.currentCount}
                    longestCount={dailyStreak.longestCount}
                    lastActivityDate={dailyStreak.lastActivityDate}
                    availableFreezes={dailyStreak.availableFreezes}
                  />
                </ProgressReveal>
              ) : null}
            </div>
          </div>

          <ProgressReveal delay={0.05}>
            <XpLedgerTimeline
              initialItems={ledger.data.items}
              initialCursor={ledger.data.nextCursor}
            />
          </ProgressReveal>
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError) {
      if (error.code === "ENTITLEMENT_REQUIRED") {
        return (
          <PageGate
            state="denied"
            title="Achievements"
            deniedMessage="Gamification is not enabled for this tenant."
          />
        );
      }

      if (error.status === 401 || error.status === 403) {
        return (
          <PageGate
            state="denied"
            title="Achievements"
            deniedMessage="You do not have permission to view achievements."
          />
        );
      }

      return (
        <PageGate
          state="error"
          title="Achievements"
          errorMessage={`Failed to load achievements. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
