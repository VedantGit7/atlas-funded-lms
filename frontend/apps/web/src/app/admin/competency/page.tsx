import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { CompetencyConfigPanel } from "../../../features/competency/components/CompetencyConfigPanel";
import { competencyConfigServerApi } from "@atlas/contracts-modules/competency/competency-config.server-api";
import { ServerApiError } from "../../../lib/server-api";

export default async function AdminCompetencyPage() {
  try {
    const [dimensions, profiles] = await Promise.all([
      competencyConfigServerApi.listDimensions(),
      competencyConfigServerApi.listScoringProfiles(),
    ]);

    return (
      <AdminPageGate screenId="T11" state="ready" title="Competency & Scoring">
        <CompetencyConfigPanel
          initialDimensions={dimensions.data}
          initialProfiles={profiles.data}
          canManageDimensions
          canCreateProfiles
          canUpdateProfiles
          canManageBands
          canPublish
        />
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T11"
          state="denied"
          title="Competency & Scoring"
          deniedMessage="You do not have permission to manage competency scoring configuration."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T11"
          state="error"
          title="Competency & Scoring"
          errorMessage={`Failed to load competency configuration. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
