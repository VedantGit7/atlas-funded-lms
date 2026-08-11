import type { InsightDashboardRange } from "./insights-range";
import { downsampleSparkline, SCHOOL_VITALS_HEALTH_CAVEAT } from "./insights-school-vitals";
import type {
  ContentHealthDetail,
  LearningRollupBundle,
  SchoolVitalsSnapshot,
} from "./insights.repository";

export type InsightContentHealthChipTone = "warning" | "danger" | "success" | "neutral";

export type InsightContentHealthChip = {
  label: string;
  tone: InsightContentHealthChipTone;
};

export type InsightContentHealthSignalId =
  | "dormant-courses"
  | "inactive-learners"
  | "open-moderation"
  | "upcoming-live";

export type InsightContentHealthSignal = {
  id: InsightContentHealthSignalId;
  label: string;
  count: number;
  tone: "warning" | "neutral" | "success";
  inverted: boolean;
  informational: boolean;
  consequence: string;
  chips: InsightContentHealthChip[];
  href: string;
  primaryLabel: string;
  secondaryHref: string | null;
  secondaryLabel: string | null;
};

export type InsightContentHealthSession = {
  id: string;
  title: string;
  status: string;
  scheduledAt: string | null;
  registeredCount: number;
  href: string;
};

export type InsightContentHealthBoard = {
  slug: "school-vitals";
  title: string;
  range: InsightDashboardRange;
  rangeLabel: string;
  generatedAt: string;
  from: string;
  to: string;
  caveat: string;
  windowNote: string;
  allClear: boolean;
  signals: InsightContentHealthSignal[];
  sessions: InsightContentHealthSession[];
  openedSeries: Array<{ period: string; value: number }>;
  openedSparkline: number[];
  progressHref: string;
};

function rangeLabel(range: InsightDashboardRange): string {
  if (range === "30d") return "Last 30 days";
  if (range === "ytd") return "Year to date";
  return "Last 12 months";
}

function chip(label: string, tone: InsightContentHealthChipTone): InsightContentHealthChip {
  return { label, tone };
}

export function buildInsightContentHealth(
  snapshot: SchoolVitalsSnapshot,
  detail: ContentHealthDetail,
  rollups: LearningRollupBundle,
  range: InsightDashboardRange,
  generatedAt = new Date().toISOString(),
): InsightContentHealthBoard {
  const dormant = snapshot.dormantCourseCount;
  const inactive = snapshot.inactiveLearnerCount;
  const openCases = snapshot.openModerationCases;
  const upcoming = snapshot.upcomingLiveCount;

  const dormantChips: InsightContentHealthChip[] = [];
  if (dormant > 0 && detail.dormantLessonCount > 0) {
    dormantChips.push(chip(`${detail.dormantLessonCount.toLocaleString()} lessons`, "neutral"));
  }

  const inactiveChips: InsightContentHealthChip[] = [];
  if (inactive > 0 && detail.neverActiveLearnerCount > 0) {
    inactiveChips.push(
      chip(`${detail.neverActiveLearnerCount.toLocaleString()} never active`, "warning"),
    );
  }
  if (inactive > 0 && detail.inactivePaidCount > 0) {
    inactiveChips.push(chip(`${detail.inactivePaidCount.toLocaleString()} have paid`, "neutral"));
  }
  if (inactive > 0 && detail.inactiveEnrollmentCount > 0) {
    inactiveChips.push(
      chip(`${detail.inactiveEnrollmentCount.toLocaleString()} enrollments held`, "neutral"),
    );
  }

  const moderationChips: InsightContentHealthChip[] = [];
  if (openCases > 0 && detail.moderationOver72hCount > 0) {
    moderationChips.push(
      chip(`${detail.moderationOver72hCount.toLocaleString()} over 72 hours`, "danger"),
    );
  }
  if (openCases > 0 && detail.moderationReviewingCount > 0) {
    moderationChips.push(
      chip(`${detail.moderationReviewingCount.toLocaleString()} in review`, "warning"),
    );
  }

  const liveChips: InsightContentHealthChip[] = [];
  if (detail.liveNowCount > 0) {
    liveChips.push(chip(`${detail.liveNowCount.toLocaleString()} live now`, "success"));
  }
  if (upcoming > 0 && detail.upcomingRegisteredCount > 0) {
    liveChips.push(
      chip(`${detail.upcomingRegisteredCount.toLocaleString()} registered`, "neutral"),
    );
  }

  const moderationConsequence =
    openCases === 0
      ? "No cases waiting in the queue."
      : detail.moderationOldestOpenDays == null
        ? "Waiting in the moderation queue."
        : `Community reports waiting on a decision. The oldest has been open for ${detail.moderationOldestOpenDays} ${
            detail.moderationOldestOpenDays === 1 ? "day" : "days"
          }.`;

  const signals: InsightContentHealthSignal[] = [
    {
      id: "dormant-courses",
      label: "Dormant courses (30d)",
      count: dormant,
      tone: dormant > 0 ? "warning" : "success",
      inverted: true,
      informational: false,
      consequence:
        dormant === 0
          ? "Every published course had learner activity."
          : "Published courses with no learner activity for 30 days.",
      chips: dormantChips,
      href: "/admin/reports/resource-usage/dormant",
      primaryLabel: "Review in Resource Usage",
      secondaryHref: null,
      secondaryLabel: null,
    },
    {
      id: "inactive-learners",
      label: "Inactive learners (30d+)",
      count: inactive,
      tone: inactive > 0 ? "warning" : "success",
      inverted: true,
      informational: false,
      consequence:
        inactive === 0
          ? "Every learner was active in the last 30 days."
          : "Still counted in your learner total and in MAU denominators, but not learning.",
      chips: inactiveChips,
      href: "/admin/reports/resource-usage/inactive-learners",
      primaryLabel: "Review in Resource Usage",
      secondaryHref: inactive > 0 ? "/admin/reports/resource-usage/inactive-learners" : null,
      secondaryLabel: inactive > 0 ? "Message them" : null,
    },
    {
      id: "open-moderation",
      label: "Open moderation cases",
      count: openCases,
      tone: openCases > 0 ? "warning" : "success",
      inverted: true,
      informational: false,
      consequence: moderationConsequence,
      chips: moderationChips,
      href: "/admin/moderation/cases",
      primaryLabel: "Open the moderation queue",
      secondaryHref: null,
      secondaryLabel: null,
    },
    {
      id: "upcoming-live",
      label: "Upcoming live sessions",
      count: upcoming,
      tone: "neutral",
      inverted: false,
      informational: true,
      consequence:
        upcoming === 0
          ? "No sessions scheduled or currently live."
          : "Scheduled or currently live. This signal is informational and not a problem.",
      chips: liveChips,
      href: "/admin/reports/live-class-attendance",
      primaryLabel: "Open Live Class Attendance",
      secondaryHref: "/admin/live-sessions",
      secondaryLabel: "Manage schedule",
    },
  ];

  const openedSeries = rollups.seriesByKey.moderation_cases_opened;
  return {
    slug: "school-vitals",
    title: "Content health",
    range,
    rangeLabel: rangeLabel(range),
    generatedAt,
    from: rollups.from,
    to: rollups.to,
    caveat: SCHOOL_VITALS_HEALTH_CAVEAT,
    windowNote:
      "Dormant courses and inactive learners always use a 30-day lookback. The range selector applies to cases opened.",
    allClear: dormant === 0 && inactive === 0 && openCases === 0,
    signals,
    sessions: detail.upcomingSessions.map((session) => ({
      ...session,
      href: `/admin/reports/live-class-attendance/${session.id}`,
    })),
    openedSeries,
    openedSparkline: downsampleSparkline(openedSeries.map((point) => point.value)),
    progressHref: "/admin/reports/resource-usage",
  };
}
