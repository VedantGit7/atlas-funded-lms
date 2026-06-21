import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { ProgressDashboard } from "../../../features/analytics/components/progress-dashboard";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import { competencyServerApi } from "../../../modules/competency/competency.server-api";
import { gamificationServerApi } from "../../../modules/gamification/gamification.server-api";
import type { certificateListResponseSchema } from "../../../server/certificates/certificate.dto";
import type { z } from "zod";

type CertificateListResponse = z.infer<typeof certificateListResponseSchema>;

export default async function ProgressPage() {
  try {
    const [competency, history, gamification, streaks, certificates] = await Promise.all([
      competencyServerApi.getMyCompetency(),
      competencyServerApi.getMyCompetencyHistory({ limit: 20 }),
      gamificationServerApi.getMyGamification().catch(() => null),
      gamificationServerApi.getMyStreaks().catch(() => null),
      serverApi
        .get<CertificateListResponse>("/api/v1/certificates?limit=10")
        .catch(() => ({ data: [], page: { nextCursor: null, hasMore: false } })),
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
            description="Track competency scores, learning streaks, and certificates earned over time."
          />
          <ProgressDashboard
            scores={competency.data.scores}
            history={history.data.items}
            gamification={
              gamification
                ? {
                    levelKey: gamification.data.levelKey ?? "starter",
                    xpTotal: gamification.data.xpTotal,
                  }
                : null
            }
            streakCount={dailyStreak?.currentCount ?? 0}
            certificates={certificates.data}
          />
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
