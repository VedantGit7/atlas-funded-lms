import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { HallOfFameView } from "../../../features/community/components/HallOfFameView";
import { ServerApiError } from "../../../lib/server-api";
import { loadHallOfFamePageData } from "../../../lib/server/hall-of-fame-projection";

export default async function HallOfFamePage() {
  try {
    const projection = await loadHallOfFamePageData();

    return (
      <PageGate state="ready" title="Hall of Fame">
        <main className="mx-auto w-full max-w-6xl space-y-10">
          <PageHeader
            title="Hall of Fame"
            description="Top standings and consented community recognition. Leaderboard rankings are anonymized to protect learner privacy."
          />
          <HallOfFameView
            posts={projection.recognitionFeed?.data.items ?? []}
            leaderboard={projection.leaderboard?.data ?? null}
            boards={projection.boards}
            gamificationAvailable={projection.gamificationAvailable}
          />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError) {
      if (error.code === "ENTITLEMENT_REQUIRED") {
        return (
          <PageGate
            state="denied"
            title="Hall of Fame"
            deniedMessage="Community recognition is not enabled for this tenant."
          />
        );
      }

      if (error.status === 401 || error.status === 403 || error.status === 404) {
        return (
          <PageGate
            state="denied"
            title="Hall of Fame"
            deniedMessage="You do not have access to the Hall of Fame."
          />
        );
      }

      return (
        <PageGate
          state="error"
          title="Hall of Fame"
          errorMessage={`Failed to load Hall of Fame. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
