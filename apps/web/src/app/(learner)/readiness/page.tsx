import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { CompetencyHistoryChart } from "../../../features/competency/components/CompetencyHistoryChart";
import { ReadinessBandHeader } from "../../../features/readiness/components/ReadinessBandHeader";
import { ReadinessChecklist } from "../../../features/readiness/components/ReadinessChecklist";
import { ReadinessCtaCard } from "../../../features/readiness/components/ReadinessCtaCard";
import { ReadinessScoreSummary } from "../../../features/readiness/components/ReadinessScoreSummary";
import { ServerApiError } from "../../../lib/server-api";
import { competencyServerApi } from "../../../modules/competency/competency.server-api";
import { readinessServerApi } from "../../../modules/readiness/readiness.server-api";
import { deriveProminence } from "../../../server/readiness/readiness.schemas";
import { DEFAULT_COMPOSITE_KEY } from "../../../server/readiness/readiness.types";

export default async function ReadinessPage() {
  try {
    const [competency, history, policyResponse] = await Promise.all([
      competencyServerApi.getMyCompetency(),
      competencyServerApi.getMyCompetencyHistory({ limit: 20 }),
      readinessServerApi.getReadinessPolicy(),
    ]);

    const policy = policyResponse.data;
    const composite =
      competency.data.composites.find((entry) => entry.compositeKey === DEFAULT_COMPOSITE_KEY) ??
      competency.data.composites[0] ??
      null;

    const prominence =
      policy && composite
        ? deriveProminence(composite.bandKey, policy.ctaPolicy.bandProminenceRules)
        : "hidden";

    const compositeProjection =
      composite && policy
        ? {
            compositeKey: composite.compositeKey,
            scoringProfileId: composite.scoringProfileId,
            score: composite.score,
            bandKey: composite.bandKey,
            prominence,
            calculatedAt: composite.calculatedAt,
          }
        : composite
          ? {
              compositeKey: composite.compositeKey,
              scoringProfileId: composite.scoringProfileId,
              score: composite.score,
              bandKey: composite.bandKey,
              prominence: "hidden" as const,
              calculatedAt: composite.calculatedAt,
            }
          : null;

    return (
      <PageGate state="ready" title="Competency & Readiness">
        <main className="space-y-6">
          <PageHeader
            title="Competency & Readiness"
            description="Review competency signals, readiness band, and optional outbound educational handoff."
          />

          <ReadinessBandHeader
            composite={compositeProjection}
            legalCopy={policy?.legalCopy ?? null}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <ReadinessScoreSummary scores={competency.data.scores} />
            <ReadinessChecklist scores={competency.data.scores} />
          </div>

          <CompetencyHistoryChart snapshots={history.data.items} />

          <ReadinessCtaCard prominence={prominence} ctaPolicy={policy?.ctaPolicy ?? null} />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Competency & Readiness"
          deniedMessage="You do not have permission to view readiness."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Competency & Readiness"
          errorMessage={`Failed to load readiness. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
