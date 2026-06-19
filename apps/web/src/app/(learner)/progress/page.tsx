import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { CompetencyHistoryChart } from "../../../features/competency/components/CompetencyHistoryChart";
import { CompetencyScoreCards } from "../../../features/competency/components/CompetencyScoreCards";
import { ServerApiError } from "../../../lib/server-api";
import { competencyServerApi } from "../../../modules/competency/competency.server-api";

export default async function ProgressPage() {
  try {
    const [competency, history] = await Promise.all([
      competencyServerApi.getMyCompetency(),
      competencyServerApi.getMyCompetencyHistory({ limit: 20 }),
    ]);

    return (
      <PageGate state="ready" title="Progress">
        <main className="space-y-6">
          <PageHeader
            title="Progress"
            description="Track competency scores and improvement over time."
          />
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
