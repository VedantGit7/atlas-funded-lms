import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { CompetencyHistoryChart } from "../../../features/competency/components/CompetencyHistoryChart";
import { CompetencyScoreCards } from "../../../features/competency/components/CompetencyScoreCards";
import { GamificationSummaryCard } from "../../../features/gamification/components/GamificationSummaryCard";
import { ServerApiError } from "../../../lib/server-api";
import { competencyServerApi } from "../../../modules/competency/competency.server-api";
import { gamificationServerApi } from "../../../modules/gamification/gamification.server-api";

export default async function ProgressPage() {
  try {
    const [competency, history, gamification, streaks] = await Promise.all([
      competencyServerApi.getMyCompetency(),
      competencyServerApi.getMyCompetencyHistory({ limit: 20 }),
      gamificationServerApi.getMyGamification().catch(() => null),
      gamificationServerApi.getMyStreaks().catch(() => null),
    ]);

    const dailyStreak =
      streaks?.data.items.find((item) => item.streakKey === "daily_learning") ??
      streaks?.data.items[0] ??
      null;

    return (
      <PageGate state="ready" title="Progress">
        <main className="space-y-6">
          <PageHeader
            title="Progress"
            description="Track competency scores and improvement over time."
          />
          {gamification ? (
            <GamificationSummaryCard
              levelKey={gamification.data.levelKey}
              xpTotal={gamification.data.xpTotal}
              streakCount={dailyStreak?.currentCount ?? 0}
            />
          ) : null}
          <CompetencyScoreCards scores={competency.data.scores} />
          <CompetencyHistoryChart snapshots={history.data.items} />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Progress"
          deniedMessage="You do not have permission to view progress."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Progress"
          errorMessage={`Failed to load progress. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
