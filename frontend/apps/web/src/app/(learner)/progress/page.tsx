import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { ProgressDashboard } from "../../../features/progress/components/ProgressDashboard";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import { competencyServerApi } from "@/modules/competency/competency.server-api";
import { gamificationServerApi } from "@/modules/gamification/gamification.server-api";
import type { certificateListResponseSchema } from "@atlas/contracts/certificates/certificate.dto";
import type { MyCoursesResponse } from "@atlas/contracts/enrollments/my-courses.schemas";
import type { z } from "zod";

type CertificateListResponse = z.infer<typeof certificateListResponseSchema>;

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Course progress always; XP, streak, skills and certificates only when the
 * academy has them on (their APIs refuse otherwise), so none shows as zeros
 * (QA review 1 M31).
 */
export default async function ProgressPage() {
  try {
    // The course list decides the page: a sign-in or permission failure there
    // shows the denied/error state below.
    const courses = await serverApi.get<MyCoursesResponse>("/api/v1/me/courses");

    const [competency, history, gamification, streaks, certificates, activity] = await Promise.all([
      competencyServerApi.getMyCompetency().catch(() => null),
      competencyServerApi.getMyCompetencyHistory({ limit: 20 }).catch(() => null),
      gamificationServerApi.getMyGamification().catch(() => null),
      gamificationServerApi.getMyStreaks().catch(() => null),
      serverApi.get<CertificateListResponse>("/api/v1/certificates?limit=12").catch(() => null),
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
              description="How far you are in each course, from the lessons you've completed."
            />
          </div>
          <ProgressDashboard
            courses={courses.data}
            gamification={
              gamification
                ? {
                    levelProgress: gamification.data.levelProgress ?? null,
                    levelKey: gamification.data.levelKey ?? null,
                    xpTotal: gamification.data.xpTotal,
                    weeklyXp: gamification.data.weeklyXp,
                    streak: {
                      currentCount: dailyStreak?.currentCount ?? 0,
                      longestCount: dailyStreak?.longestCount ?? 0,
                    },
                    activity: activity
                      ? {
                          days: activity.data.days,
                          rangeEnd: activity.data.rangeEnd || todayIsoDate(),
                          activeDays: activity.data.activeDays,
                          totalXp: activity.data.totalXp,
                        }
                      : null,
                  }
                : null
            }
            competency={
              competency
                ? { scores: competency.data.scores, history: history?.data.items ?? [] }
                : null
            }
            certificates={
              certificates ? { items: certificates.data, hasMore: certificates.page.hasMore } : null
            }
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
