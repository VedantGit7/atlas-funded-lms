import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { HallOfFameView } from "../../../features/community/components/HallOfFameView";
import { loadHallOfFamePageData } from "../../../server/community/community.hall-of-fame-page-load";

export default async function HallOfFamePage() {
  try {
    const projection = await loadHallOfFamePageData();

    return (
      <PageGate state="ready" title="Hall of Fame">
        <main className="space-y-6">
          <PageHeader
            title="Hall of Fame"
            description="Consented community recognition, leaderboard standings, and verifiable credentials."
          />
          <HallOfFameView
            posts={projection.recognitionFeed?.data.items ?? []}
            leaderboard={
              projection.leaderboard
                ? {
                    periodKey: projection.leaderboard.data.periodKey,
                    entries: projection.leaderboard.data.entries,
                  }
                : null
            }
            gamificationAvailable={projection.gamificationAvailable}
          />
        </main>
      </PageGate>
    );
  } catch {
    return (
      <PageGate
        state="denied"
        title="Hall of Fame"
        deniedMessage="You do not have access to the Hall of Fame."
      />
    );
  }
}
