import type { MyCourse, MyCoursesResponse } from "@atlas/contracts/enrollments/my-courses.schemas";
import { serverApi } from "../../../../lib/server-api";
import {
  homeAnnouncement,
  scoreBandLabel,
  scoreColor,
  type HomeAnnouncement,
  type LevelProgress,
} from "./dashboard-model";

// External API responses: fields are optional so shape drift degrades a
// section instead of the page.
type CompetencyResp = {
  data: {
    scores?: Array<{ dimensionKey: string; score: number; bandKey: string | null }>;
    composites?: Array<{ compositeKey: string; score: number; bandKey: string }>;
  };
};
type GamificationResp = {
  data: {
    xpTotal: number;
    weeklyXp: number;
    levelProgress?: (LevelProgress & { levelKey?: string }) | null;
  };
};
type StreaksResp = {
  data: { items?: Array<{ streakKey: string; currentCount: number; longestCount?: number }> };
};
type CertsResp = {
  data: Array<{
    id: string;
    templateName?: string;
    credentialId: string;
    status: string;
    issuedAt: string;
    verificationUrl: string;
  }>;
};
type PathsResp = {
  data: { items: Array<{ id: string; title?: string; name?: string }> };
};
/** The inbox list is `data: Item[]`, asked for announcements only. */
type AnnouncementsResp = {
  data?: Array<{ id: string; title: string; body: string; actionPath: string; createdAt: string }>;
};
type PolicyResp = { data: { legalCopy?: { disclaimer?: string | null } | null } };

export type LearnerDashboardData = {
  displayName: string | null;
  /** Null when the course list couldn't be read (the section says so). */
  courses: MyCourse[] | null;
  announcement: HomeAnnouncement | null;
  /** Null when gamification is off for this academy or couldn't be read. */
  gamification: {
    level: LevelProgress | null;
    xpTotal: number;
    weeklyXp: number;
    streakDays: number;
  } | null;
  readiness: { scorePercent: number; label: string; color: string } | null;
  mastery: Array<{ key: string; label: string; score: number }>;
  certificates: Array<{
    id: string;
    name: string;
    credentialId: string;
    issuedAt: string;
    verificationUrl: string;
  }>;
  paths: Array<{ id: string; title: string }>;
  readinessNote: string | null;
};

function fulfilled<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

/** Competency scores may arrive as 0-1 or 0-100; normalise to 0-100. */
function toPercent(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  const pct = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function humanize(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Everything the learner home shows, read in parallel. A section whose API is
 * switched off for the academy (or fails) is left out rather than shown as
 * zeros (QA review 1 M31; UX report: XP and streak widgets while gamification
 * is off).
 */
export async function loadLearnerDashboardData(
  displayName: string | null,
): Promise<LearnerDashboardData> {
  const [courses, announcements, gamification, streaks, competency, certificates, paths, policy] =
    await Promise.allSettled([
      serverApi.get<MyCoursesResponse>("/api/v1/me/courses"),
      serverApi.get<AnnouncementsResp>("/api/v1/me/notifications?kind=announcement&limit=1"),
      serverApi.get<GamificationResp>("/api/v1/me/gamification"),
      serverApi.get<StreaksResp>("/api/v1/me/streaks"),
      serverApi.get<CompetencyResp>("/api/v1/me/competency"),
      serverApi.get<CertsResp>("/api/v1/certificates?limit=3"),
      serverApi.get<PathsResp>("/api/v1/learning-paths?type=roadmap&limit=3"),
      serverApi.get<PolicyResp>("/api/v1/readiness/policy"),
    ]);

  const game = fulfilled(gamification);
  const streakItems = fulfilled(streaks)?.data.items ?? [];
  const dailyStreak =
    streakItems.find((item) => item.streakKey === "daily_learning") ?? streakItems.at(0);

  const comp = fulfilled(competency);
  const readinessScore = toPercent(comp?.data.composites?.[0]?.score ?? null);
  const mastery = (comp?.data.scores ?? [])
    .map((score) => ({
      key: score.dimensionKey,
      label: humanize(score.dimensionKey),
      score: toPercent(score.score),
    }))
    .filter((item): item is { key: string; label: string; score: number } => item.score != null)
    .slice(0, 6);

  return {
    displayName,
    courses: fulfilled(courses)?.data.items ?? null,
    announcement: homeAnnouncement(fulfilled(announcements)?.data?.[0] ?? null),
    gamification: game
      ? {
          level: game.data.levelProgress ?? null,
          xpTotal: game.data.xpTotal,
          weeklyXp: game.data.weeklyXp,
          streakDays: dailyStreak?.currentCount ?? 0,
        }
      : null,
    readiness:
      readinessScore != null
        ? {
            scorePercent: readinessScore,
            label: scoreBandLabel(readinessScore),
            color: scoreColor(readinessScore),
          }
        : null,
    mastery,
    certificates: (fulfilled(certificates)?.data ?? []).map((cert) => ({
      id: cert.id,
      name: cert.templateName ?? "Certificate",
      credentialId: cert.credentialId,
      issuedAt: cert.issuedAt,
      verificationUrl: cert.verificationUrl,
    })),
    paths: (fulfilled(paths)?.data.items ?? []).map((path) => ({
      id: path.id,
      title: path.title ?? path.name ?? "Learning path",
    })),
    readinessNote: fulfilled(policy)?.data.legalCopy?.disclaimer ?? null,
  };
}
