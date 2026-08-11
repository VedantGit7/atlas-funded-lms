import type { InsightDashboardRange } from "./insights-range";
import type { SchoolVitalsSnapshot } from "./insights.repository";

export const SCHOOL_VITALS_WINDOW_FOOTNOTE = "Window is the last 30 days.";
export const SCHOOL_VITALS_INVERT_FOOTNOTE = "Higher is worse.";
export const SCHOOL_VITALS_FUNNEL_FOOTNOTE =
  "Event counts in the selected window, not a single cohort. Stages are independent and may overlap.";
export const SCHOOL_VITALS_FUNNEL_CAVEAT =
  "These are event counts over the window, not a single cohort moving through steps. A learner can appear in several stages, and later stages are not subsets of earlier ones.";
export const SCHOOL_VITALS_HEALTH_CAVEAT =
  "These four signals are reported separately and deliberately not combined into a single score.";

export function schoolVitalsWindowFootnote(range: InsightDashboardRange): string {
  if (range === "30d") return SCHOOL_VITALS_WINDOW_FOOTNOTE;
  if (range === "ytd") return "Window is year to date.";
  return "Window is the last 12 months.";
}

export const SCHOOL_VITALS_POPULATION_KPI_IDS = [
  "learners",
  "active-enrollments",
  "current-mau",
  "active-users-30d",
  "inactive-learners",
  "assessment-pass-rate",
] as const;

export const SCHOOL_VITALS_ACTIVITY_KPI_IDS = [
  "lessons-completed",
  "assessments-submitted",
  "assessments-passed",
  "practice-sessions",
  "certificates-issued",
  "community-posts",
  "path-steps",
  "moderation-opened",
] as const;

export const SCHOOL_VITALS_INVERTED_KPI_IDS = new Set(["inactive-learners", "moderation-opened"]);

export type SeriesPoint = { period: string; value: number };

export type SeriesDelta = {
  deltaAbs: number | null;
  deltaPct: number | null;
  sparkline: number[];
};

function formatUtcDay(period: string): string {
  const date = new Date(period.includes("T") ? period : `${period}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return period.slice(0, 10);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function downsampleSparkline(values: number[], maxPoints = 24): number[] {
  if (values.length <= maxPoints) return values;
  const bucket = values.length / maxPoints;
  const out: number[] = [];
  for (let index = 0; index < maxPoints; index += 1) {
    const start = Math.floor(index * bucket);
    const end = Math.max(Math.floor((index + 1) * bucket), start + 1);
    const slice = values.slice(start, end);
    out.push(Math.round(sum(slice) / Math.max(slice.length, 1)));
  }
  return out;
}

export function seriesHalfDelta(series: SeriesPoint[]): SeriesDelta {
  const values = series.map((row) => row.value);
  const sparkline = downsampleSparkline(values);
  if (values.length < 4) {
    return { deltaAbs: null, deltaPct: null, sparkline };
  }
  const mid = Math.floor(values.length / 2);
  const first = sum(values.slice(0, mid));
  const second = sum(values.slice(mid));
  const deltaAbs = second - first;
  const deltaPct =
    first === 0 ? (second > 0 ? 100 : null) : Math.round(((second - first) / first) * 1000) / 10;
  return { deltaAbs, deltaPct, sparkline };
}

export function seriesPeakCaption(series: SeriesPoint[]): string | undefined {
  const first = series[0];
  if (!first) return undefined;
  let busiest = first;
  let quietest = first;
  for (const row of series) {
    if (row.value > busiest.value) busiest = row;
    if (row.value < quietest.value) quietest = row;
  }
  return `Busiest: ${formatUtcDay(busiest.period)} (${busiest.value.toLocaleString()}). Quietest: ${formatUtcDay(quietest.period)} (${quietest.value.toLocaleString()}).`;
}

export function weekdayWeekendCaption(series: SeriesPoint[]): string | undefined {
  const weekday: number[] = [];
  const weekend: number[] = [];
  let peak = series[0];
  if (!peak) return undefined;

  for (const row of series) {
    if (row.value > peak.value) peak = row;
    const date = new Date(row.period.includes("T") ? row.period : `${row.period}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) continue;
    const day = date.getUTCDay();
    if (day === 0 || day === 6) weekend.push(row.value);
    else weekday.push(row.value);
  }

  if (weekday.length === 0 || weekend.length === 0) {
    return `Peak ${formatUtcDay(peak.period)} (${peak.value.toLocaleString()}).`;
  }

  const weekdayMean = Math.round(sum(weekday) / weekday.length);
  const weekendMean = Math.round(sum(weekend) / weekend.length);
  return `Peak ${formatUtcDay(peak.period)} (${peak.value.toLocaleString()}). Weekday mean ${weekdayMean.toLocaleString()}, weekend mean ${weekendMean.toLocaleString()}.`;
}

export function joinFootnotes(...parts: Array<string | undefined>): string | undefined {
  const present = parts.filter((part): part is string => Boolean(part && part.trim()));
  return present.length > 0 ? present.join(" ") : undefined;
}

export type ContentHealthTone = "warning" | "neutral";

export type ContentHealthRow = {
  id: "dormant-courses" | "inactive-learners" | "open-moderation" | "upcoming-live";
  signal: string;
  count: number;
  consequence: string;
  href: string;
  tone: ContentHealthTone;
};

export function contentHealthRows(snapshot: SchoolVitalsSnapshot): ContentHealthRow[] {
  return [
    {
      id: "dormant-courses",
      signal: "Dormant courses (30d)",
      count: snapshot.dormantCourseCount,
      consequence:
        snapshot.dormantCourseCount === 0
          ? "Every published course had learner activity."
          : "Published courses with no learner activity in 30 days.",
      href: "/admin/reports/resource-usage/dormant",
      tone: snapshot.dormantCourseCount > 0 ? "warning" : "neutral",
    },
    {
      id: "inactive-learners",
      signal: "Inactive learners (30d+)",
      count: snapshot.inactiveLearnerCount,
      consequence:
        snapshot.inactiveLearnerCount === 0
          ? "Every learner was active in the last 30 days."
          : "Still counted in your learner total.",
      href: "/admin/reports/resource-usage/inactive-learners",
      tone: snapshot.inactiveLearnerCount > 0 ? "warning" : "neutral",
    },
    {
      id: "open-moderation",
      signal: "Open moderation cases",
      count: snapshot.openModerationCases,
      consequence:
        snapshot.openModerationCases === 0
          ? "No cases waiting in the queue."
          : "Waiting in the moderation queue.",
      href: "/admin/moderation/cases",
      tone: snapshot.openModerationCases > 0 ? "warning" : "neutral",
    },
    {
      id: "upcoming-live",
      signal: "Upcoming live sessions",
      count: snapshot.upcomingLiveCount,
      consequence:
        snapshot.upcomingLiveCount === 0
          ? "No sessions scheduled in this window."
          : "Scheduled or currently live.",
      href: "/admin/live-sessions",
      tone: "neutral",
    },
  ];
}
