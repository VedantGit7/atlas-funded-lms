import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { ReadinessBandHeader } from "../../../features/readiness/components/ReadinessBandHeader";
import { ReadinessChecklist } from "../../../features/readiness/components/ReadinessChecklist";
import { ReadinessCtaCard } from "../../../features/readiness/components/ReadinessCtaCard";
import { ReadinessLegalNotice } from "../../../features/readiness/components/ReadinessLegalNotice";
import {
  ReadinessMomentumChart,
  type MomentumPoint,
} from "../../../features/readiness/components/ReadinessMomentumChart";
import { ReadinessReveal } from "../../../features/readiness/components/ReadinessReveal";
import { ReadinessScoreSummary } from "../../../features/readiness/components/ReadinessScoreSummary";
import { ReadinessPageViewTracker } from "../../../features/readiness/components/ReadinessPageViewTracker";
import { formatShortDate } from "../../../features/readiness/readiness-view";
import { ServerApiError } from "../../../lib/server-api";
import { competencyServerApi } from "@/modules/competency/competency.server-api";
import { readinessServerApi } from "@/modules/readiness/readiness.server-api";
import { deriveProminence } from "@atlas/contracts/readiness/readiness.schemas";
import { DEFAULT_COMPOSITE_KEY } from "@atlas/contracts/readiness/readiness.types";

type HistoryItem = Awaited<
  ReturnType<typeof competencyServerApi.getMyCompetencyHistory>
>["data"]["items"][number];

/** Composite momentum = mean dimension score per snapshot, oldest to newest, last 8. */
function buildMomentumPoints(items: HistoryItem[]): MomentumPoint[] {
  return [...items]
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
    .map((snapshot) => {
      const values = snapshot.scores.map((score) => score.score);
      const average =
        values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
      return { label: formatShortDate(snapshot.occurredAt), value: average };
    })
    .slice(-8);
}

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

    const compositeProjection = composite
      ? {
          compositeKey: composite.compositeKey,
          scoringProfileId: composite.scoringProfileId,
          score: composite.score,
          bandKey: composite.bandKey,
          prominence: policy ? prominence : ("hidden" as const),
          calculatedAt: composite.calculatedAt,
        }
      : null;

    const momentumPoints = buildMomentumPoints(history.data.items);

    return (
      <PageGate state="ready" title="Competency & Readiness">
        <ReadinessPageViewTracker />
        <div className="mx-auto w-full max-w-6xl space-y-10 md:space-y-12">
          <PageHeader
            title="Competency & Readiness"
            description="Track your competency signals, readiness band, and next steps. Education stays available at every band."
          />

          <ReadinessReveal>
            <ReadinessBandHeader
              composite={compositeProjection}
              legalCopy={policy?.legalCopy ?? null}
            />
          </ReadinessReveal>

          <ReadinessReveal delay={0.05}>
            <ReadinessScoreSummary scores={competency.data.scores} />
          </ReadinessReveal>

          <ReadinessReveal delay={0.1}>
            <div className="grid gap-6 lg:grid-cols-2">
              <ReadinessChecklist scores={competency.data.scores} />
              <ReadinessMomentumChart points={momentumPoints} />
            </div>
          </ReadinessReveal>

          <ReadinessReveal delay={0.05}>
            <ReadinessCtaCard prominence={prominence} ctaPolicy={policy?.ctaPolicy ?? null} />
          </ReadinessReveal>

          <ReadinessReveal>
            <ReadinessLegalNotice legalCopy={policy?.legalCopy ?? null} />
          </ReadinessReveal>
        </div>
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
