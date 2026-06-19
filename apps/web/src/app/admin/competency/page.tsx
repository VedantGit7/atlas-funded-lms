import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { CompetencyConfigPanel } from "../../../features/competency/components/CompetencyConfigPanel";
import { competencyConfigServerApi } from "../../../modules/competency/competency-config.server-api";
import { ServerApiError } from "../../../lib/server-api";

export default async function AdminCompetencyPage() {
  try {
    const [dimensions, profiles] = await Promise.all([
      competencyConfigServerApi.listDimensions(),
      competencyConfigServerApi.listScoringProfiles(),
    ]);

    return (
      <PageGate state="ready" title="Competency & Scoring">
        <main className="space-y-6">
          <PageHeader
            title="Competency & Scoring"
            description="Configure generic competency dimensions, scoring profiles, bands, and publish versioned scoring config."
          />
          <CompetencyConfigPanel
            initialDimensions={dimensions.data}
            initialProfiles={profiles.data}
            canManageDimensions
            canCreateProfiles
            canUpdateProfiles
            canManageBands
            canPublish
          />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Competency & Scoring"
          deniedMessage="You do not have permission to manage competency scoring configuration."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Competency & Scoring"
          errorMessage={`Failed to load competency configuration. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
