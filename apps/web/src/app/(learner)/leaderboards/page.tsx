import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { LeaderboardTable } from "../../../features/gamification/components/LeaderboardTable";
import { ServerApiError } from "../../../lib/server-api";
import { gamificationServerApi } from "../../../modules/gamification/gamification.server-api";

export default async function LeaderboardsPage() {
  try {
    const leaderboards = await gamificationServerApi.listLeaderboards();
    const first = leaderboards.data.items[0] ?? null;
    const detail = first ? await gamificationServerApi.getLeaderboard(first.id) : null;

    return (
      <PageGate state="ready" title="Leaderboards">
        <main className="space-y-6">
          <PageHeader
            title="Leaderboards"
            description="Privacy-safe standings for XP across your academy."
          />

          {leaderboards.data.items.length === 0 ? (
            <p className="text-sm opacity-80">No leaderboards are configured yet.</p>
          ) : (
            <LeaderboardTable
              leaderboards={leaderboards.data.items.map((item) => ({
                id: item.id,
                name: item.name,
                windowKey: item.windowKey,
              }))}
              initialLeaderboardId={first?.id ?? null}
              initialDetail={
                detail
                  ? {
                      periodKey: detail.data.periodKey,
                      calculatedAt: detail.data.calculatedAt,
                      entries: detail.data.entries,
                      callerRank: detail.data.callerRank,
                      callerMetricValue: detail.data.callerMetricValue,
                    }
                  : null
              }
            />
          )}
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError) {
      if (error.code === "ENTITLEMENT_REQUIRED") {
        return (
          <PageGate
            state="denied"
            title="Leaderboards"
            deniedMessage="Gamification is not enabled for this tenant."
          />
        );
      }

      if (error.status === 401 || error.status === 403) {
        return (
          <PageGate
            state="denied"
            title="Leaderboards"
            deniedMessage="You do not have permission to view leaderboards."
          />
        );
      }

      return (
        <PageGate
          state="error"
          title="Leaderboards"
          errorMessage={`Failed to load leaderboards. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
