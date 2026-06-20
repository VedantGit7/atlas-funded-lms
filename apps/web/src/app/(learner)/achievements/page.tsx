import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { BadgeGrid } from "../../../features/gamification/components/BadgeGrid";
import { StreakPanel } from "../../../features/gamification/components/StreakPanel";
import { ServerApiError } from "../../../lib/server-api";
import { gamificationServerApi } from "../../../modules/gamification/gamification.server-api";

export default async function AchievementsPage() {
  try {
    const [profile, badges, streaks] = await Promise.all([
      gamificationServerApi.getMyGamification(),
      gamificationServerApi.listBadges(),
      gamificationServerApi.getMyStreaks(),
    ]);

    const dailyStreak =
      streaks.data.items.find((item) => item.streakKey === "daily_learning") ??
      streaks.data.items[0] ??
      null;

    return (
      <PageGate state="ready" title="Achievements">
        <main className="space-y-6">
          <PageHeader
            title="Achievements"
            description="Track XP, levels, badges, and learning streaks."
          />

          <section className="rounded border p-4">
            <h2 className="font-semibold">XP & Level</h2>
            <p className="mt-2 text-sm">
              Level {profile.data.levelKey ?? "—"} · {profile.data.xpTotal} XP ·{" "}
              {profile.data.badgeCount} badge(s) earned
            </p>
          </section>

          <BadgeGrid badges={badges.data.items} />

          {dailyStreak ? (
            <StreakPanel
              streakKey={dailyStreak.streakKey}
              currentCount={dailyStreak.currentCount}
              longestCount={dailyStreak.longestCount}
              lastActivityDate={dailyStreak.lastActivityDate}
              availableFreezes={dailyStreak.availableFreezes}
            />
          ) : null}
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
