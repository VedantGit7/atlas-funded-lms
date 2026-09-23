import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { ProgressDashboard } from "../../../features/progress/components/ProgressDashboard";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import { competencyServerApi } from "@/modules/competency/competency.server-api";
import { gamificationServerApi } from "@/modules/gamification/gamification.server-api";
import type { certificateListResponseSchema } from "@atlas/contracts/certificates/certificate.dto";
import type { z } from "zod";

type CertificateListResponse = z.infer<typeof certificateListResponseSchema>;

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function ProgressPage() {
  try {
    const [competency, history, gamification, streaks, certificates, activity] = await Promise.all([
      competencyServerApi.getMyCompetency(),
      competencyServerApi.getMyCompetencyHistory({ limit: 20 }),
      gamificationServerApi.getMyGamification().catch(() => null),
      gamificationServerApi.getMyStreaks().catch(() => null),
      serverApi
        .get<CertificateListResponse>("/api/v1/certificates?limit=12")
        .catch(() => ({ data: [], page: { nextCursor: null, hasMore: false } })),
      gamificationServerApi.getMyActivity().catch(() => null),
    ]);

    const dailyStreak =
      streaks?.data.items.find((item) => item.streakKey === "daily_learning") ??
      streaks?.data.items[0] ??
      null;

    return (
      <PageGate state="ready" title="Progress">
        <main className="space-y-8">
          <div className="mx-auto max-w-6xl">
            <PageHeader
              title="Progress"
              description="Track your skill growth, learning consistency, and the credentials you have earned."
            />
          </div>
          <ProgressDashboard
            scores={competency.data.scores}
            history={history.data.items}
            levelProgress={gamification?.data.levelProgress ?? null}
            levelKey={gamification?.data.levelKey ?? null}
            xpTotal={gamification?.data.xpTotal ?? 0}
            weeklyXp={gamification?.data.weeklyXp ?? 0}
            streak={{
              currentCount: dailyStreak?.currentCount ?? 0,
              longestCount: dailyStreak?.longestCount ?? 0,
            }}
            certificates={certificates.data}
            certificatesHasMore={certificates.page.hasMore}
            activityDays={activity?.data.days ?? []}
            activityRangeEnd={activity?.data.rangeEnd ?? todayIsoDate()}
            activityActiveDays={activity?.data.activeDays ?? 0}
            activityTotalXp={activity?.data.totalXp ?? 0}
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
