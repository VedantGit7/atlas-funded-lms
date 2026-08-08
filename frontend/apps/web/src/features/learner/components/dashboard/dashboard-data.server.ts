import { serverApi } from "../../../../lib/server-api";
import { computeLevel, scoreBandLabel, scoreColor } from "./dashboard-model";
import type { LearnerDashboardData } from "./LearnerDashboard";

// Fields are marked optional: these are external API responses and we defend
// against shape drift so a mismatch degrades gracefully instead of crashing.
type CompetencyResp = {
  data: {
    scores?: Array<{ dimensionKey: string; score: number; bandKey: string | null }>;
    composites?: Array<{ compositeKey: string; score: number; bandKey: string }>;
  };
};
type GamificationResp = { data: { xpTotal: number; levelKey: string | null; badgeCount: number; weeklyXp: number } };
type ConfigResp = { data: { levelThresholds?: Array<{ levelKey: string; minXp: number }> } };
type StreaksResp = { data: { items?: Array<{ streakKey: string; currentCount: number; availableFreezes: number }> } };
type EnrollmentsResp = { data: { items: Array<{ id: string; courseId: string; displayName: string | null; status: string }> } };
type CertsResp = {
  data: {
    items: Array<{ id: string; templateName: string; credentialId: string; status: string; issuedAt: string; verificationUrl: string }>;
  };
};
type QuestsResp = {
  data: { items: Array<{ id: string; name?: string; title?: string; status?: string; rewards?: { xp?: number } }> };
};
type PathsResp = { data: { items: Array<{ id: string; title?: string; name?: string; slug?: string }> } };
/** Matches notificationInboxListResponseSchema — inbox list is `data: Item[]`, not `{ items }`. */
type NotificationsResp = {
  data?: Array<{ id: string; title: string; body: string; createdAt: string }>;
};
type PolicyResp = { data: { legalCopy?: { disclaimer?: string | null } | null } };
type BadgesResp = { data: { items: Array<{ id: string; name: string; iconKey: string | null; awarded: boolean }> } };
type HistoryResp = { data: { items?: Array<{ id: string; occurredAt: string; scores?: Array<{ score: number }> }> } };

function fulfilled<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

/** Competency/gamification scores may arrive as 0-1 or 0-100; normalise to 0-100. */
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

function parseLevelKey(levelKey: string | null): number | null {
  if (!levelKey) return null;
  const match = /(\d+)/.exec(levelKey);
  return match ? Number(match[1]) : null;
}

export async function loadLearnerDashboardData(displayName: string | null): Promise<LearnerDashboardData> {
  const [
    competency,
    gamification,
    config,
    streaks,
    enrollments,
    certificates,
    quests,
    paths,
    notifications,
    policy,
    badgesRes,
    historyRes,
  ] = await Promise.allSettled([
    serverApi.get<CompetencyResp>("/api/v1/me/competency"),
    serverApi.get<GamificationResp>("/api/v1/me/gamification"),
    serverApi.get<ConfigResp>("/api/v1/gamification/config"),
    serverApi.get<StreaksResp>("/api/v1/me/streaks"),
    serverApi.get<EnrollmentsResp>("/api/v1/enrollments?limit=8"),
    serverApi.get<CertsResp>("/api/v1/certificates?limit=5"),
    serverApi.get<QuestsResp>("/api/v1/me/quests"),
    serverApi.get<PathsResp>("/api/v1/learning-paths?type=roadmap&limit=4"),
    serverApi.get<NotificationsResp>("/api/v1/me/notifications?limit=1"),
    serverApi.get<PolicyResp>("/api/v1/readiness/policy"),
    serverApi.get<BadgesResp>("/api/v1/me/badges/progress"),
    serverApi.get<HistoryResp>("/api/v1/me/competency/history?limit=8"),
  ]);

  const comp = fulfilled(competency);
  const game = fulfilled(gamification);
  const cfg = fulfilled(config);
  const strk = fulfilled(streaks);
  const enr = fulfilled(enrollments);
  const certs = fulfilled(certificates);
  const qst = fulfilled(quests);
  const pth = fulfilled(paths);
  const notif = fulfilled(notifications);
  const pol = fulfilled(policy);
  const bdg = fulfilled(badgesRes);
  const hist = fulfilled(historyRes);

  // Readiness (overall) from the primary composite.
  const overallRaw = comp?.data.composites?.[0]?.score ?? null;
  const scorePercent = toPercent(overallRaw);
  const readiness =
    scorePercent != null
      ? {
          scorePercent,
          label: scoreBandLabel(scorePercent),
          color: scoreColor(scorePercent),
          energy: scorePercent / 100,
        }
      : null;

  // Mastery rings from dimension scores.
  const mastery = (comp?.data.scores ?? [])
    .map((s) => ({ key: s.dimensionKey, label: humanize(s.dimensionKey), score: toPercent(s.score) }))
    .filter((m): m is { key: string; label: string; score: number } => m.score != null)
    .slice(0, 6);

  // Level from XP + tenant thresholds.
  const xpTotal = game?.data.xpTotal ?? null;
  const thresholds = cfg?.data.levelThresholds ?? [];
  const levelInfo =
    xpTotal != null && thresholds.length > 0
      ? computeLevel(xpTotal, thresholds)
      : {
          level: parseLevelKey(game?.data.levelKey ?? null) ?? 1,
          xpIntoLevel: null as number | null,
          xpForNextLevel: null as number | null,
          progressPercent: 0,
        };

  const streakItems = strk?.data.items ?? [];
  const dailyStreak =
    streakItems.find((i) => i.streakKey === "daily_learning") ?? streakItems.at(0);

  const badges = (bdg?.data.items ?? [])
    .filter((b) => b.awarded)
    .slice(0, 4)
    .map((b) => ({ id: b.id, name: b.name, icon: b.iconKey }));

  const trend = (hist?.data.items ?? [])
    .slice(0, 7)
    .reverse()
    .map((snap, index) => {
      const scores = snap.scores ?? [];
      const avg = scores.length ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length : 0;
      return { label: `W${String(index + 1)}`, value: toPercent(avg) ?? 0 };
    });

  const courses = (enr?.data.items ?? [])
    .filter((e) => e.status === "active")
    .map((e) => ({ id: e.id, courseId: e.courseId, title: e.displayName ?? "Untitled course", status: e.status }))
    .slice(0, 6);

  const queue = (qst?.data.items ?? [])
    .filter((q) => q.status == null || q.status === "ACTIVE")
    .slice(0, 3)
    .map((q, index) => {
      const kind: "due" | "next" = index === 0 ? "due" : "next";
      return {
        id: q.id,
        title: q.name ?? q.title ?? "Quest",
        meta: q.rewards?.xp ? `${String(q.rewards.xp)} XP reward` : "In progress",
        kind,
      };
    });

  const recommended = (pth?.data.items ?? []).slice(0, 4).map((p) => ({
    id: p.id,
    title: p.title ?? p.name ?? "Mastery path",
    reason: "Recommended path",
    href: "/roadmap",
  }));

  const latest = notif?.data?.[0] ?? null;
  const announcement = latest?.title ? { id: latest.id, title: latest.title, at: latest.createdAt } : null;

  return {
    displayName,
    readiness,
    level: levelInfo.level,
    xpTotal,
    weeklyXp: game?.data.weeklyXp ?? null,
    xpIntoLevel: levelInfo.xpIntoLevel,
    xpForNextLevel: levelInfo.xpForNextLevel,
    levelProgressPercent: levelInfo.progressPercent,
    streakCount: dailyStreak?.currentCount ?? null,
    streakFreezes: dailyStreak?.availableFreezes ?? null,
    badgeCount: game?.data.badgeCount ?? null,
    badges,
    trend,
    mastery,
    courses,
    queue,
    certificates: (certs?.data.items ?? []).map((c) => ({
      id: c.id,
      name: c.templateName,
      credentialId: c.credentialId,
      status: c.status,
      issuedAt: c.issuedAt,
      verificationUrl: c.verificationUrl,
    })),
    recommended,
    announcement,
    legalCopy: pol?.data.legalCopy ? { disclaimer: pol.data.legalCopy.disclaimer ?? null } : null,
  };
}
