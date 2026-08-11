import type { TenantTx } from "@atlas/db";
import { queryAnalyticsFunnel } from "@atlas/domain/analytics/analytics.service";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type {
  InsightAlert,
  InsightAlertsBoard,
  InsightAlertsMutationBody,
  InsightLayoutBoard,
  InsightLayoutMutationBody,
  InsightLibraryBoard,
  InsightLibraryMutationBody,
  InsightDigestsBoard,
  InsightDigestsMutationBody,
  InsightSettingsBoard,
  InsightSettingsMutationBody,
  InsightWidget,
  InsightWidgetDetail,
  InsightEngagementFunnelBoard,
  InsightSalesPipelineBoard,
  InsightSalesAttributionBoard,
  InsightSalesOpportunityBoard,
  InsightContentHealthBoard,
} from "./insights.schemas";
import type { NormalizedResult } from "../reports/reports.schemas";
import {
  computeDeltaPct,
  insightRangeDayCount,
  type InsightDashboardRange,
} from "./insights-range";
import { buildInsightWidgetDetail } from "./insights-widget-detail";
import { buildInsightEngagementFunnel } from "./insights-engagement-funnel";
import { buildInsightSalesPipeline } from "./insights-sales-pipeline";
import {
  buildInsightSalesAttribution,
  SALES_ATTRIBUTION_EMPTY_CAPTION,
} from "./insights-sales-attribution";
import { buildInsightSalesOpportunity } from "./insights-sales-opportunity";
import { buildInsightContentHealth } from "./insights-content-health";
import {
  applyInsightAlertMutation,
  findInsightAlertRule,
  muteUntilIso,
  openAlertsFromBoard,
  parseInsightAlertState,
  projectInsightAlertBoard,
  type InsightAlertMetrics,
} from "./insights-alerts";
import {
  allowedVizFor,
  applyInsightLayoutMutation,
  factoryLayout,
  mergeLayoutWithCatalog,
  parseInsightLayoutState,
  resolveStoredLayout,
  setLayoutWidgetsHidden,
  summarizeLayout,
  widgetsToCatalog,
} from "./insights-layout";
import { INSIGHT_LIBRARY_CATEGORIES, buildLibraryItem } from "./insights-library";
import {
  INSIGHT_DIGEST_TIMEZONES,
  INSIGHT_DIGEST_WEEKDAYS,
  applyDigestMutation,
  createDigest,
  digestList,
  digestPreviewSelection,
  emailDomain,
  parseInsightDigestState,
  projectDigestItem,
  projectDigestSummary,
  type InsightDigest,
} from "./insights-digests";
import {
  applyInsightSettingsMutation,
  describeLayoutReset,
  insightDataClass,
  insightSectionSlugs,
  insightSectionTitle,
  numberFormatSample,
  parseInsightSettings,
} from "./insights-settings";
import {
  contentHealthRows,
  joinFootnotes,
  SCHOOL_VITALS_FUNNEL_FOOTNOTE,
  SCHOOL_VITALS_INVERT_FOOTNOTE,
  schoolVitalsWindowFootnote,
  seriesHalfDelta,
  seriesPeakCaption,
  weekdayWeekendCaption,
} from "./insights-school-vitals";
import {
  SALES_INVERT_FOOTNOTE,
  SALES_OPPORTUNITY_FOOTNOTE,
  SALES_PIPELINE_EMPTY_CAPTION,
  salesConversionRate,
  salesMonthlyRevenueCaption,
  salesPipelineCaption,
} from "./insights-sales-insight";
import {
  loadInsightAlertStateJson,
  loadInsightDashboardSnapshot,
  loadInsightDigestStateJson,
  loadInsightDisplayCurrency,
  loadInsightLayoutStateJson,
  loadInsightSettingsJson,
  loadInsightViewerRoles,
  loadLearningRollupBundle,
  loadContentHealthDetail,
  loadLiveDashboardSnapshot,
  loadMarketingInsightSnapshot,
  loadMembershipDisplayName,
  loadMembershipEmail,
  loadMessengerInsightSnapshot,
  loadSalesAttributionSources,
  loadSalesInsightSnapshot,
  loadSalesOpportunityEvidence,
  loadSchoolVitalsSnapshot,
  loadTenantAcademyName,
  loadTenantEmailDomains,
  saveInsightAlertStateJson,
  saveInsightDigestStateJson,
  saveInsightLayoutStateJson,
  saveInsightSettingsJson,
  type InsightDashboardSnapshot,
  type LearningRollupBundle,
  type LiveDashboardSnapshot,
  type MarketingInsightSnapshot,
  type MessengerInsightSnapshot,
  type SalesInsightSnapshot,
  type SchoolVitalsSnapshot,
} from "./insights.repository";

type InsightsCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

const SLUG_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  "school-vitals": "School Vitals",
  "sales-insight": "Sales Insight",
  "live-dashboard": "Live Dashboard",
  "marketing-insight": "Marketing Insight",
  "messenger-insight": "Messenger Insight",
};

function periodSeriesResult(
  rows: Array<{ period: string; value: number }>,
  measureLabel: string,
): NormalizedResult {
  return {
    columns: [
      { key: "period", label: "Period", kind: "date" },
      { key: "value", label: measureLabel, kind: "measure" },
    ],
    rows,
    dimensions: ["period"],
    measures: ["value"],
  };
}

const FUNNEL_STAGE_LABELS: Record<string, string> = {
  lesson_completed: "Lessons completed",
  assessment_submitted: "Assessments submitted",
  assessment_passed: "Assessments passed",
  practice_session_completed: "Practice sessions",
  certificate_issued: "Certificates issued",
  community_post_created: "Community posts",
};

const ROLLUP_KPI_DEFS: Array<{
  key: keyof LearningRollupBundle["totals"];
  id: string;
  title: string;
}> = [
  { key: "lessons_completed", id: "lessons-completed", title: "Lessons completed" },
  { key: "assessments_submitted", id: "assessments-submitted", title: "Assessments submitted" },
  { key: "assessments_passed", id: "assessments-passed", title: "Assessments passed" },
  {
    key: "practice_sessions_completed",
    id: "practice-sessions",
    title: "Practice sessions",
  },
  { key: "certificates_issued", id: "certificates-issued", title: "Certificates issued" },
  { key: "community_posts_created", id: "community-posts", title: "Community posts" },
  { key: "path_steps_completed", id: "path-steps", title: "Path steps completed" },
  {
    key: "moderation_cases_opened",
    id: "moderation-opened",
    title: "Moderation cases opened",
  },
];

function kpiWidget(
  id: string,
  title: string,
  value: number,
  extras?: {
    deltaPct?: number | null | undefined;
    deltaAbs?: number | null | undefined;
    sparkline?: number[] | undefined;
    href?: string | null | undefined;
    footnote?: string | undefined;
  },
): InsightWidget {
  return {
    id,
    title,
    defaultViz: "kpi",
    span: "third",
    ...(extras?.deltaPct !== undefined ? { deltaPct: extras.deltaPct } : {}),
    ...(extras?.deltaAbs !== undefined ? { deltaAbs: extras.deltaAbs } : {}),
    ...(extras?.sparkline && extras.sparkline.length > 0 ? { sparkline: extras.sparkline } : {}),
    ...(extras?.href !== undefined ? { href: extras.href } : {}),
    ...(extras?.footnote ? { footnote: extras.footnote } : {}),
    data: {
      columns: [
        { key: "metric", label: "Metric", kind: "dimension" },
        { key: "value", label: title, kind: "measure" },
      ],
      rows: [{ metric: title, value }],
      measures: ["value"],
    },
  };
}

function rangeSeriesTitle(base: string, range: InsightDashboardRange): string {
  if (range === "30d") return `${base} (30 days)`;
  if (range === "ytd") return `${base} (year to date)`;
  return `${base} (12 months)`;
}

function seriesFootnote(rows: Array<{ period: string; value: number }>): string | undefined {
  const first = rows[0];
  if (!first) return undefined;
  let best = first;
  let worst = first;
  for (const row of rows) {
    if (row.value > best.value) best = row;
    if (row.value < worst.value) worst = row;
  }
  return `Best: ${best.period.slice(0, 7)} (${best.value.toLocaleString()})  |  Quietest: ${worst.period.slice(0, 7)} (${worst.value.toLocaleString()})`;
}

function emptyBarWidget(id: string, title: string): InsightWidget {
  return {
    id,
    title,
    defaultViz: "bar",
    span: "full",
    data: {
      columns: [
        { key: "label", label: "Segment", kind: "dimension" },
        { key: "value", label: "Count", kind: "measure" },
      ],
      rows: [],
      dimensions: ["label"],
      measures: ["value"],
    },
  };
}

function centsToMajor(cents: number): number {
  return Math.round(cents) / 100;
}

function dashboardAlertMetrics(snapshot: InsightDashboardSnapshot): InsightAlertMetrics {
  const failed = snapshot.paymentStatusCounts.find((row) => row.status === "failed")?.count ?? 0;
  const pending =
    snapshot.pendingTasks.publishReviews +
    snapshot.pendingTasks.moderationCases +
    snapshot.pendingTasks.deletionRequests +
    snapshot.pendingTasks.courseReviews;
  return {
    failedPayments: failed,
    pendingTasks: pending,
    enrollmentsInRange: snapshot.enrollmentsInRange,
    previousEnrollmentsInRange: snapshot.previousEnrollmentsInRange,
    paidRevenueInRange: snapshot.paidPaymentRevenueCentsInRange,
    previousPaidRevenue: snapshot.previousPaidPaymentRevenueCents,
    upcomingLive: snapshot.upcomingLiveSessions.length,
  };
}

function buildMainDashboardWidgets(
  snapshot: InsightDashboardSnapshot,
  learning: {
    lessonsCompleted: number;
    assessmentsSubmitted: number;
    activity: NormalizedResult;
  },
  range: InsightDashboardRange,
): InsightWidget[] {
  const revenueCents =
    snapshot.paidPaymentRevenueCentsInRange > 0
      ? snapshot.paidPaymentRevenueCentsInRange
      : snapshot.paidPaymentRevenueCents > 0
        ? snapshot.paidPaymentRevenueCents
        : snapshot.enrollmentValueCents;
  const previousRevenueCents = snapshot.previousPaidPaymentRevenueCents;
  const revenueSpark = snapshot.monthlyPaymentRevenue.map((row) => centsToMajor(row.amountCents));
  const enrollmentSpark = snapshot.monthlyEnrollments.map((row) => row.paid + row.free);
  const revenueSeries = snapshot.monthlyPaymentRevenue.map((row) => ({
    period: row.period,
    value: centsToMajor(row.amountCents),
  }));
  const revenueFootnote = seriesFootnote(revenueSeries);

  const widgets: InsightWidget[] = [
    kpiWidget("revenue", "Revenue", centsToMajor(revenueCents), {
      deltaPct: computeDeltaPct(revenueCents, previousRevenueCents),
      sparkline: revenueSpark,
    }),
    kpiWidget("products", "Products", snapshot.productCount, {
      deltaAbs: snapshot.newProductCountInRange,
    }),
    kpiWidget("learners", "Learners", snapshot.learnerCount, {
      deltaPct: computeDeltaPct(snapshot.newLearnerCountInRange, snapshot.previousNewLearnerCount),
      deltaAbs: snapshot.newLearnerCountInRange,
    }),
    kpiWidget("current-mau", "Current MAU", snapshot.currentMau),
    kpiWidget("active-users-30d", "Active (30d)", snapshot.activeUsers30d, {
      deltaPct: computeDeltaPct(snapshot.activeUsers30d, snapshot.previousActiveUsers30d),
      sparkline: snapshot.activeUsersSpark,
    }),
    kpiWidget("enrollments", "Enrollments", snapshot.enrollmentsInRange, {
      deltaPct: computeDeltaPct(snapshot.enrollmentsInRange, snapshot.previousEnrollmentsInRange),
      sparkline: enrollmentSpark,
    }),
    {
      id: "monthly-revenue",
      title: rangeSeriesTitle("Revenue", range),
      defaultViz: "line",
      span: "full",
      href: "/admin/reports/payments",
      deltaPct: computeDeltaPct(revenueCents, previousRevenueCents),
      deltaAbs: centsToMajor(revenueCents - previousRevenueCents),
      ...(revenueFootnote ? { footnote: revenueFootnote } : {}),
      data: {
        columns: [
          { key: "period", label: "Period", kind: "date" },
          { key: "value", label: "Revenue", kind: "measure" },
        ],
        rows: revenueSeries,
        dimensions: ["period"],
        measures: ["value"],
      },
    },
    {
      id: "monthly-enrollments",
      title: rangeSeriesTitle("Enrollments (paid vs free)", range),
      defaultViz: "bar",
      span: "full",
      href: "/admin/reports/enrollments",
      deltaPct: computeDeltaPct(snapshot.enrollmentsInRange, snapshot.previousEnrollmentsInRange),
      deltaAbs: snapshot.enrollmentsInRange - snapshot.previousEnrollmentsInRange,
      data: {
        columns: [
          { key: "period", label: "Period", kind: "date" },
          { key: "paid", label: "Paid", kind: "measure" },
          { key: "free", label: "Free", kind: "measure" },
        ],
        rows: snapshot.monthlyEnrollments.map((row) => ({
          period: row.period,
          paid: row.paid,
          free: row.free,
        })),
        dimensions: ["period"],
        measures: ["paid", "free"],
      },
    },
    {
      id: "top-products",
      title: "Top products",
      defaultViz: "table",
      span: "half",
      data: {
        columns: [
          { key: "title", label: "Product", kind: "string" },
          { key: "kind", label: "Type", kind: "dimension" },
          { key: "students", label: "Learners", kind: "measure" },
          { key: "revenue", label: "Revenue", kind: "measure" },
        ],
        rows: snapshot.topProducts.map((row) => ({
          title: row.title,
          kind: row.productType,
          students: row.studentCount,
          revenue: centsToMajor(row.revenueEstimateCents),
        })),
        measures: ["students", "revenue"],
      },
    },
    {
      id: "payment-orders",
      title: "Orders by status",
      defaultViz: "bar",
      span: "half",
      data: {
        columns: [
          { key: "label", label: "Status", kind: "dimension" },
          { key: "value", label: "Orders", kind: "measure" },
        ],
        rows: snapshot.paymentStatusCounts.map((row) => ({
          label: row.status,
          value: row.count,
        })),
        dimensions: ["label"],
        measures: ["value"],
      },
    },
    {
      id: "failed-payments",
      title: "Recent failed payments",
      defaultViz: "table",
      span: "full",
      href: "/admin/reports/payments/transactions",
      data: {
        columns: [
          { key: "learner", label: "Learner", kind: "string" },
          { key: "product", label: "Product", kind: "string" },
          { key: "amount", label: "Amount", kind: "measure" },
          { key: "gateway", label: "Gateway", kind: "dimension" },
          { key: "reason", label: "Failure reason", kind: "string" },
          { key: "attempted", label: "Attempted", kind: "date" },
          { key: "href", label: "View", kind: "string" },
        ],
        rows: snapshot.recentFailedPayments.map((row) => ({
          learner: row.learnerName,
          product: row.productTitle,
          amount: centsToMajor(row.amountCents),
          gateway: row.gatewayKey,
          reason: row.failureReason,
          attempted: row.createdAt,
          href: `/admin/reports/payments/transactions/${row.id}`,
        })),
        measures: ["amount"],
      },
    },
    kpiWidget("lessons-completed", "Lessons completed", learning.lessonsCompleted),
    kpiWidget("assessments-submitted", "Assessments submitted", learning.assessmentsSubmitted),
    {
      id: "learning-activity",
      title: "Learning activity",
      defaultViz: "line",
      span: "full",
      data: learning.activity,
    },
    {
      id: "pending-tasks",
      title: "Pending tasks",
      defaultViz: "table",
      span: "half",
      data: {
        columns: [
          { key: "task", label: "Task", kind: "dimension" },
          { key: "count", label: "Count", kind: "measure" },
        ],
        rows: [
          { task: "Publish reviews", count: snapshot.pendingTasks.publishReviews },
          { task: "Moderation cases", count: snapshot.pendingTasks.moderationCases },
          { task: "Deletion requests", count: snapshot.pendingTasks.deletionRequests },
          { task: "Course reviews", count: snapshot.pendingTasks.courseReviews },
        ],
        dimensions: ["task"],
        measures: ["count"],
      },
    },
    {
      id: "upcoming-live",
      title: "Upcoming live classes",
      defaultViz: "table",
      span: "half",
      data: {
        columns: [
          { key: "title", label: "Session", kind: "string" },
          { key: "status", label: "Status", kind: "dimension" },
          { key: "scheduled", label: "Scheduled", kind: "date" },
        ],
        rows: snapshot.upcomingLiveSessions.map((row) => ({
          title: row.title,
          status: row.status,
          scheduled: row.scheduledAt ? row.scheduledAt.slice(0, 16).replace("T", " ") : null,
        })),
      },
    },
  ];

  if (snapshot.scheduledEvents.length > 0) {
    widgets.push({
      id: "scheduled-events",
      title: "Scheduled seasonal events",
      defaultViz: "table",
      span: "full",
      data: {
        columns: [
          { key: "name", label: "Event", kind: "string" },
          { key: "status", label: "Status", kind: "dimension" },
          { key: "starts", label: "Starts", kind: "date" },
        ],
        rows: snapshot.scheduledEvents.map((row) => ({
          name: row.name,
          status: row.status,
          starts: row.startsAt.slice(0, 10),
        })),
      },
    });
  }

  return widgets;
}

async function buildLearningWidgets(_tx: TenantTx): Promise<{
  lessonsCompleted: number;
  assessmentsSubmitted: number;
  activity: NormalizedResult;
  widgets: InsightWidget[];
  rollups: LearningRollupBundle;
}> {
  const rollups = await loadLearningRollupBundle(_tx, 30);
  const lessonsCompleted = rollups.totals.lessons_completed;
  const assessmentsSubmitted = rollups.totals.assessments_submitted;
  const activity = periodSeriesResult(rollups.activitySeries, "Activity");

  return {
    lessonsCompleted,
    assessmentsSubmitted,
    activity,
    rollups,
    widgets: [
      kpiWidget("lessons-completed", "Lessons completed", lessonsCompleted),
      kpiWidget("assessments-submitted", "Assessments submitted", assessmentsSubmitted),
      {
        id: "learning-activity",
        title: "Learning activity",
        defaultViz: "line",
        span: "full",
        data: activity,
      },
    ],
  };
}

function assessmentPassRate(rollups: LearningRollupBundle): number {
  const submitted = rollups.totals.assessments_submitted;
  if (submitted <= 0) return 0;
  return Math.round((rollups.totals.assessments_passed / submitted) * 1000) / 10;
}

function schoolVitalsAlertMetrics(
  snapshot: SchoolVitalsSnapshot,
  rollups: LearningRollupBundle,
): InsightAlertMetrics {
  const totalActivity = Object.values(rollups.totals).reduce((sum, value) => sum + value, 0);
  return {
    learningActivity: totalActivity,
    inactiveLearners: snapshot.inactiveLearnerCount,
    dormantCourses: snapshot.dormantCourseCount,
    openModeration: snapshot.openModerationCases,
    assessmentsSubmitted: rollups.totals.assessments_submitted,
    passRate: assessmentPassRate(rollups),
    upcomingLive: snapshot.upcomingLiveCount,
  };
}

function buildSchoolVitalsWidgets(
  snapshot: SchoolVitalsSnapshot,
  rollups: LearningRollupBundle,
  funnelStages: Array<{ stage: string; count: number }>,
  range: InsightDashboardRange,
): InsightWidget[] {
  const passRate = assessmentPassRate(rollups);
  const windowNote = schoolVitalsWindowFootnote(range);
  const activityDelta = seriesHalfDelta(rollups.activitySeries);
  const dauDelta = seriesHalfDelta(snapshot.dailyActiveUsers);
  const lessonsDelta = seriesHalfDelta(rollups.seriesByKey.lessons_completed);
  const submittedDelta = seriesHalfDelta(rollups.seriesByKey.assessments_submitted);
  const passedDelta = seriesHalfDelta(rollups.seriesByKey.assessments_passed);
  const practiceDelta = seriesHalfDelta(rollups.seriesByKey.practice_sessions_completed);
  const certificatesDelta = seriesHalfDelta(rollups.seriesByKey.certificates_issued);
  const communityDelta = seriesHalfDelta(rollups.seriesByKey.community_posts_created);
  const pathDelta = seriesHalfDelta(rollups.seriesByKey.path_steps_completed);
  const moderationDelta = seriesHalfDelta(rollups.seriesByKey.moderation_cases_opened);
  const passRateSeries = rollups.seriesByKey.assessments_submitted.map((row, index) => {
    const submitted = row.value;
    const passed = rollups.seriesByKey.assessments_passed[index]?.value ?? 0;
    return {
      period: row.period,
      value: submitted > 0 ? Math.round((passed / submitted) * 1000) / 10 : 0,
    };
  });
  const passRateDelta = seriesHalfDelta(passRateSeries);

  const rollupDeltas: Record<string, ReturnType<typeof seriesHalfDelta>> = {
    "lessons-completed": lessonsDelta,
    "assessments-submitted": submittedDelta,
    "assessments-passed": passedDelta,
    "practice-sessions": practiceDelta,
    "certificates-issued": certificatesDelta,
    "community-posts": communityDelta,
    "path-steps": pathDelta,
    "moderation-opened": moderationDelta,
  };

  const widgets: InsightWidget[] = [
    kpiWidget("learners", "Learners", snapshot.learnerCount, {
      href: "/admin/reports/resource-usage/inactive-learners",
    }),
    kpiWidget("active-enrollments", "Active enrollments", snapshot.enrollmentCount),
    kpiWidget("current-mau", "Current MAU", snapshot.currentMau, {
      sparkline: dauDelta.sparkline,
      deltaAbs: dauDelta.deltaAbs,
      deltaPct: dauDelta.deltaPct,
    }),
    kpiWidget("active-users-30d", "Active users (30d)", snapshot.activeUsers30d, {
      sparkline: dauDelta.sparkline,
      deltaAbs: dauDelta.deltaAbs,
      deltaPct: dauDelta.deltaPct,
    }),
    kpiWidget("inactive-learners", "Inactive learners (30d+)", snapshot.inactiveLearnerCount, {
      href: "/admin/reports/resource-usage/inactive-learners",
      footnote: SCHOOL_VITALS_INVERT_FOOTNOTE,
    }),
    kpiWidget("assessment-pass-rate", "Assessment pass rate %", passRate, {
      href: "/admin/reports/progress-score",
      sparkline: passRateDelta.sparkline,
      deltaAbs: passRateDelta.deltaAbs,
      deltaPct: passRateDelta.deltaPct,
    }),
  ];

  for (const def of ROLLUP_KPI_DEFS) {
    const delta = rollupDeltas[def.id];
    widgets.push(
      kpiWidget(def.id, def.title, rollups.totals[def.key], {
        sparkline: delta?.sparkline,
        deltaAbs: delta?.deltaAbs ?? null,
        deltaPct: delta?.deltaPct ?? null,
        ...(def.id === "moderation-opened"
          ? {
              href: "/admin/moderation/cases",
              footnote: SCHOOL_VITALS_INVERT_FOOTNOTE,
            }
          : {}),
      }),
    );
  }

  const healthRows = contentHealthRows(snapshot);

  widgets.push(
    {
      id: "learning-activity",
      title: rangeSeriesTitle("Learning activity", range),
      defaultViz: "line",
      span: "full",
      footnote: joinFootnotes(windowNote, seriesPeakCaption(rollups.activitySeries)),
      data: periodSeriesResult(rollups.activitySeries, "Activity"),
      ...(activityDelta.deltaAbs != null ? { deltaAbs: activityDelta.deltaAbs } : {}),
      ...(activityDelta.deltaPct != null ? { deltaPct: activityDelta.deltaPct } : {}),
    },
    {
      id: "lessons-trend",
      title: rangeSeriesTitle("Lessons completed", range),
      defaultViz: "line",
      span: "half",
      footnote: joinFootnotes(windowNote, seriesPeakCaption(rollups.seriesByKey.lessons_completed)),
      data: periodSeriesResult(rollups.seriesByKey.lessons_completed, "Lessons"),
      ...(lessonsDelta.deltaAbs != null ? { deltaAbs: lessonsDelta.deltaAbs } : {}),
      ...(lessonsDelta.deltaPct != null ? { deltaPct: lessonsDelta.deltaPct } : {}),
    },
    {
      id: "assessments-trend",
      title: rangeSeriesTitle("Assessments submitted", range),
      defaultViz: "line",
      span: "half",
      footnote: joinFootnotes(
        windowNote,
        seriesPeakCaption(rollups.seriesByKey.assessments_submitted),
      ),
      data: periodSeriesResult(rollups.seriesByKey.assessments_submitted, "Assessments"),
      ...(submittedDelta.deltaAbs != null ? { deltaAbs: submittedDelta.deltaAbs } : {}),
      ...(submittedDelta.deltaPct != null ? { deltaPct: submittedDelta.deltaPct } : {}),
    },
    {
      id: "daily-active-users",
      title: rangeSeriesTitle("Daily active users", range),
      defaultViz: "area",
      span: "full",
      footnote: joinFootnotes(windowNote, weekdayWeekendCaption(snapshot.dailyActiveUsers)),
      data: periodSeriesResult(snapshot.dailyActiveUsers, "Active users"),
      ...(dauDelta.deltaAbs != null ? { deltaAbs: dauDelta.deltaAbs } : {}),
      ...(dauDelta.deltaPct != null ? { deltaPct: dauDelta.deltaPct } : {}),
    },
    {
      id: "engagement-funnel",
      title: rangeSeriesTitle("Learning engagement funnel", range),
      defaultViz: "funnel",
      span: "half",
      footnote: SCHOOL_VITALS_FUNNEL_FOOTNOTE,
      data: {
        columns: [
          { key: "stage", label: "Stage", kind: "dimension" },
          { key: "count", label: "Events", kind: "measure" },
        ],
        rows: funnelStages.map((row) => ({
          stage: row.stage,
          count: row.count,
        })),
        dimensions: ["stage"],
        measures: ["count"],
      },
    },
    {
      id: "content-health",
      title: "Content health",
      defaultViz: "table",
      span: "half",
      data: {
        columns: [
          { key: "signal", label: "Signal", kind: "dimension" },
          { key: "count", label: "Count", kind: "measure" },
          { key: "consequence", label: "Consequence", kind: "string" },
          { key: "href", label: "Report", kind: "string" },
          { key: "tone", label: "Tone", kind: "string" },
          { key: "id", label: "Id", kind: "string" },
        ],
        rows: healthRows.map((row) => ({
          id: row.id,
          signal: row.signal,
          count: row.count,
          consequence: row.consequence,
          href: row.href,
          tone: row.tone,
        })),
        dimensions: ["signal"],
        measures: ["count"],
      },
    },
    {
      id: "top-courses",
      title: rangeSeriesTitle("Top courses by learning", range),
      defaultViz: "table",
      span: "full",
      footnote: windowNote,
      data: {
        columns: [
          { key: "title", label: "Course", kind: "string" },
          { key: "completions", label: "Lesson completions", kind: "measure" },
          { key: "learners", label: "Active learners", kind: "measure" },
          { key: "avgProgress", label: "Avg progress %", kind: "measure" },
        ],
        rows: snapshot.topCourses.map((row) => ({
          title: row.title,
          completions: row.completions30d,
          learners: row.activeLearners,
          avgProgress: row.avgProgressPct,
        })),
        measures: ["completions", "learners", "avgProgress"],
      },
    },
  );

  return widgets;
}

async function loadEngagementFunnelStages(
  tx: TenantTx,
  ctx: InsightsCtx,
  from: string,
  to: string,
): Promise<Array<{ stage: string; count: number }>> {
  try {
    const funnel = await queryAnalyticsFunnel(tx, ctx, {
      funnelKey: "learning.engagement",
      from,
      to,
    });
    const totals = new Map<string, number>();
    for (const day of funnel.data.days) {
      for (const stage of day.stages) {
        totals.set(stage.stageKey, (totals.get(stage.stageKey) ?? 0) + stage.count);
      }
    }
    return [...totals.entries()].map(([stageKey, count]) => ({
      stage: FUNNEL_STAGE_LABELS[stageKey] ?? stageKey,
      count,
    }));
  } catch {
    return Object.entries(FUNNEL_STAGE_LABELS).map(([, stage]) => ({ stage, count: 0 }));
  }
}

function salesInsightAlertMetrics(snapshot: SalesInsightSnapshot): InsightAlertMetrics {
  return {
    failedPayments: snapshot.failedOrderCount,
    pendingOrders: snapshot.pendingOrderCount,
    pipelineVisited: snapshot.pipeline30d.visited,
    conversionRate:
      salesConversionRate(snapshot.pipeline30d.visited, snapshot.pipeline30d.enrolled) ?? 0,
  };
}

function buildSalesInsightWidgets(snapshot: SalesInsightSnapshot): InsightWidget[] {
  const conversionAll = salesConversionRate(snapshot.pipeline.visited, snapshot.pipeline.enrolled);
  const conversion30d = salesConversionRate(
    snapshot.pipeline30d.visited,
    snapshot.pipeline30d.enrolled,
  );
  const upsellPool = snapshot.freeEnrollmentCount + snapshot.trialEnrollmentCount;
  const monthlyRows = snapshot.monthlyPaymentRevenue.map((row) => ({
    period: row.period,
    value: centsToMajor(row.amountCents),
  }));
  const paymentsHref = "/admin/reports/payments";
  const enrollmentsHref = "/admin/reports/enrollments";
  const productsHref = "/admin/reports/sales-marketing";

  return [
    kpiWidget("revenue", "Total revenue", centsToMajor(snapshot.revenueCents), {
      href: paymentsHref,
    }),
    kpiWidget("revenue-30d", "Revenue (30d)", centsToMajor(snapshot.revenue30dCents), {
      href: paymentsHref,
    }),
    kpiWidget("paid-orders", "Paid orders", snapshot.paidOrderCount, {
      href: paymentsHref,
    }),
    kpiWidget("failed-orders", "Failed orders", snapshot.failedOrderCount, {
      href: paymentsHref,
      footnote: SALES_INVERT_FOOTNOTE,
    }),
    kpiWidget("products", "Products", snapshot.productCount, {
      href: productsHref,
    }),
    kpiWidget("learners", "Learners", snapshot.learnerCount, {
      href: enrollmentsHref,
    }),
    kpiWidget("paid-enrollments", "Paid enrollments", snapshot.paidEnrollmentCount, {
      href: enrollmentsHref,
    }),
    kpiWidget("trial-free-pool", "Trial + free pool", upsellPool, {
      href: enrollmentsHref,
    }),
    kpiWidget("conversion-rate", "Conversion rate %", conversionAll ?? 0, {
      footnote: conversionAll == null ? SALES_PIPELINE_EMPTY_CAPTION : undefined,
    }),
    kpiWidget("conversion-rate-30d", "Conversion rate % (30d)", conversion30d ?? 0, {
      footnote: conversion30d == null ? SALES_PIPELINE_EMPTY_CAPTION : undefined,
    }),
    kpiWidget("enrollments-30d", "Enrollments (30d)", snapshot.enrollments30d, {
      href: enrollmentsHref,
    }),
    kpiWidget("paid-enrollments-30d", "Paid enrollments (30d)", snapshot.paidEnrollments30d, {
      href: enrollmentsHref,
    }),
    {
      id: "monthly-revenue",
      title: "Monthly revenue (12 months)",
      defaultViz: "line",
      span: "full",
      href: paymentsHref,
      footnote: salesMonthlyRevenueCaption(
        monthlyRows.map((row) => ({ period: row.period, amountMajor: row.value })),
        snapshot.currency,
      ),
      data: {
        columns: [
          { key: "period", label: "Period", kind: "date" },
          { key: "value", label: "Revenue", kind: "measure" },
        ],
        rows: monthlyRows,
        dimensions: ["period"],
        measures: ["value"],
      },
    },
    {
      id: "pipeline",
      title: "Sales pipeline (all time)",
      defaultViz: "funnel",
      span: "half",
      href: "/admin/insights/sales-insight/pipeline",
      footnote: salesPipelineCaption(snapshot.pipeline),
      data: {
        columns: [
          { key: "stage", label: "Stage", kind: "dimension" },
          { key: "count", label: "Leads", kind: "measure" },
        ],
        rows: [
          { stage: "Visited", count: snapshot.pipeline.visited },
          { stage: "Started diagnostic", count: snapshot.pipeline.startedDiagnostic },
          { stage: "Enrolled", count: snapshot.pipeline.enrolled },
        ],
        dimensions: ["stage"],
        measures: ["count"],
      },
    },
    {
      id: "pipeline-30d",
      title: "Sales pipeline (30d)",
      defaultViz: "funnel",
      span: "half",
      href: "/admin/insights/sales-insight/pipeline",
      footnote: salesPipelineCaption(snapshot.pipeline30d),
      data: {
        columns: [
          { key: "stage", label: "Stage", kind: "dimension" },
          { key: "count", label: "Leads", kind: "measure" },
        ],
        rows: [
          { stage: "Visited", count: snapshot.pipeline30d.visited },
          { stage: "Started diagnostic", count: snapshot.pipeline30d.startedDiagnostic },
          { stage: "Enrolled", count: snapshot.pipeline30d.enrolled },
        ],
        dimensions: ["stage"],
        measures: ["count"],
      },
    },
    {
      id: "enrollment-channels",
      title: "Enrollments by channel",
      defaultViz: "bar",
      span: "half",
      href: enrollmentsHref,
      data: {
        columns: [
          { key: "label", label: "Channel", kind: "dimension" },
          { key: "value", label: "Enrollments", kind: "measure" },
        ],
        rows: snapshot.enrollmentChannel.map((row) => ({
          label: row.label,
          value: row.count,
        })),
        dimensions: ["label"],
        measures: ["value"],
      },
    },
    {
      id: "payment-orders",
      title: "Orders by status",
      defaultViz: "bar",
      span: "half",
      href: paymentsHref,
      data: {
        columns: [
          { key: "label", label: "Status", kind: "dimension" },
          { key: "value", label: "Orders", kind: "measure" },
        ],
        rows: snapshot.paymentStatusCounts.map((row) => ({
          label: row.status,
          value: row.count,
        })),
        dimensions: ["label"],
        measures: ["value"],
      },
    },
    {
      id: "top-products",
      title: "Top products by sales",
      defaultViz: "table",
      span: "full",
      href: productsHref,
      data: {
        columns: [
          { key: "title", label: "Product", kind: "string" },
          { key: "students", label: "Learners", kind: "measure" },
          { key: "paid", label: "Paid", kind: "measure" },
          { key: "trial", label: "Trial", kind: "measure" },
          { key: "revenue", label: "Revenue", kind: "measure" },
        ],
        rows: snapshot.topProducts.map((row) => ({
          title: row.title,
          students: row.studentCount,
          paid: row.paidCount,
          trial: row.trialCount,
          revenue: centsToMajor(row.revenueEstimateCents),
        })),
        measures: ["students", "paid", "trial", "revenue"],
      },
    },
    {
      id: "top-sources",
      title: "Top attribution sources",
      defaultViz: "table",
      span: "half",
      href: "/admin/insights/sales-insight/attribution",
      footnote: snapshot.topSources.length === 0 ? SALES_ATTRIBUTION_EMPTY_CAPTION : undefined,
      data: {
        columns: [
          { key: "source", label: "Source", kind: "string" },
          { key: "events", label: "Events", kind: "measure" },
          { key: "revenue", label: "Attributed revenue", kind: "measure" },
        ],
        rows: snapshot.topSources.map((row) => ({
          source: row.source,
          events: row.count,
          revenue: centsToMajor(row.revenueCents),
        })),
        measures: ["events", "revenue"],
      },
    },
    {
      id: "opportunity-pool",
      title: "Conversion opportunity",
      defaultViz: "table",
      span: "half",
      href: "/admin/insights/sales-insight/opportunity",
      footnote: SALES_OPPORTUNITY_FOOTNOTE,
      data: {
        columns: [
          { key: "segment", label: "Segment", kind: "dimension" },
          { key: "count", label: "Count", kind: "measure" },
        ],
        rows: [
          { segment: "Paid enrollments", count: snapshot.paidEnrollmentCount },
          { segment: "Trial enrollments", count: snapshot.trialEnrollmentCount },
          { segment: "Free enrollments", count: snapshot.freeEnrollmentCount },
          { segment: "Offline / manual", count: snapshot.offlineEnrollmentCount },
          { segment: "Online (paid+free+trial)", count: snapshot.onlineEnrollmentCount },
        ],
        dimensions: ["segment"],
        measures: ["count"],
      },
    },
    {
      id: "failed-payments",
      title: "Recent failed payments",
      defaultViz: "table",
      span: "full",
      href: paymentsHref,
      ...(snapshot.recentFailedPayments.length === 0
        ? { footnote: "No failed payments in this window." }
        : {}),
      data: {
        columns: [
          { key: "learner", label: "Learner", kind: "string" },
          { key: "product", label: "Product", kind: "string" },
          { key: "amount", label: "Amount", kind: "measure" },
          { key: "gateway", label: "Gateway", kind: "dimension" },
          { key: "reason", label: "Failure reason", kind: "string" },
          { key: "created", label: "Created", kind: "date" },
          { key: "href", label: "View", kind: "string" },
        ],
        rows: snapshot.recentFailedPayments.map((row) => ({
          learner: row.learnerName,
          product: row.productTitle,
          amount: centsToMajor(row.amountCents),
          gateway: row.gatewayKey,
          reason: row.failureReason,
          created: row.createdAt.slice(0, 10),
          href: `/admin/reports/payments/transactions/${row.id}`,
        })),
        measures: ["amount"],
      },
    },
  ];
}

function formatDurationMinutes(seconds: number): number {
  if (seconds <= 0) return 0;
  return Math.round((seconds / 60) * 10) / 10;
}

function liveDashboardAlertMetrics(snapshot: LiveDashboardSnapshot): InsightAlertMetrics {
  return {
    upcomingLive: snapshot.upcomingCount,
    lowAttendanceSessions: snapshot.lowAttendanceSessions.length,
  };
}

function buildLiveDashboardWidgets(snapshot: LiveDashboardSnapshot): InsightWidget[] {
  return [
    kpiWidget("sessions", "Total sessions", snapshot.sessionCount),
    kpiWidget("live-now", "Live now", snapshot.liveNowCount),
    kpiWidget("upcoming", "Upcoming", snapshot.upcomingCount),
    kpiWidget("ended", "Ended sessions", snapshot.endedCount),
    kpiWidget("total-attended", "Total attended", snapshot.totalAttended),
    kpiWidget("total-registered", "Registered / rostered", snapshot.totalRegistered),
    kpiWidget("attendance-rate", "Attendance rate %", snapshot.attendanceRate),
    kpiWidget("attendance-rate-30d", "Attendance rate % (30d)", snapshot.attendanceRate30d),
    kpiWidget(
      "avg-watch-minutes",
      "Avg watch (min)",
      formatDurationMinutes(snapshot.avgDurationSeconds),
    ),
    kpiWidget(
      "total-watch-hours",
      "Total watch (hrs)",
      Math.round((snapshot.totalWatchSeconds / 3600) * 10) / 10,
    ),
    kpiWidget("sessions-30d", "Sessions (30d)", snapshot.sessions30d),
    kpiWidget("attended-30d", "Attended (30d)", snapshot.attended30d),
    {
      id: "sessions-by-status",
      title: "Live sessions by status",
      defaultViz: "bar",
      span: "half",
      data: {
        columns: [
          { key: "label", label: "Status", kind: "dimension" },
          { key: "value", label: "Sessions", kind: "measure" },
        ],
        rows: snapshot.sessionsByStatus.map((row) => ({
          label: row.status,
          value: row.sessionCount,
        })),
        dimensions: ["label"],
        measures: ["value"],
      },
    },
    {
      id: "attended-by-status",
      title: "Attendance by session status",
      defaultViz: "bar",
      span: "half",
      data: {
        columns: [
          { key: "label", label: "Status", kind: "dimension" },
          { key: "value", label: "Attended", kind: "measure" },
        ],
        rows: snapshot.sessionsByStatus.map((row) => ({
          label: row.status,
          value: row.attendedCount,
        })),
        dimensions: ["label"],
        measures: ["value"],
      },
    },
    {
      id: "daily-attendance",
      title: "Daily attendance (30d)",
      defaultViz: "line",
      span: "full",
      data: {
        columns: [
          { key: "period", label: "Period", kind: "date" },
          { key: "attended", label: "Attended", kind: "measure" },
          { key: "registered", label: "Registered", kind: "measure" },
        ],
        rows: snapshot.dailyAttendance.map((row) => ({
          period: row.period,
          attended: row.attended,
          registered: row.registered,
        })),
        dimensions: ["period"],
        measures: ["attended", "registered"],
      },
    },
    {
      id: "upcoming-sessions",
      title: "Upcoming / live sessions",
      defaultViz: "table",
      span: "half",
      data: {
        columns: [
          { key: "title", label: "Session", kind: "string" },
          { key: "status", label: "Status", kind: "dimension" },
          { key: "scheduled", label: "Scheduled", kind: "date" },
          { key: "registered", label: "Registered", kind: "measure" },
        ],
        rows: snapshot.upcomingSessions.map((row) => ({
          title: row.title,
          status: row.status,
          scheduled: row.scheduledAt ? row.scheduledAt.slice(0, 16).replace("T", " ") : null,
          registered: row.registeredCount,
        })),
        measures: ["registered"],
      },
    },
    {
      id: "recent-sessions",
      title: "Recent sessions",
      defaultViz: "table",
      span: "half",
      data: {
        columns: [
          { key: "title", label: "Session", kind: "string" },
          { key: "status", label: "Status", kind: "dimension" },
          { key: "attended", label: "Attended", kind: "measure" },
          { key: "registered", label: "Registered", kind: "measure" },
          { key: "rate", label: "Rate %", kind: "measure" },
          { key: "avgMin", label: "Avg min", kind: "measure" },
        ],
        rows: snapshot.recentSessions.map((row) => ({
          title: row.title,
          status: row.status,
          attended: row.attendedCount,
          registered: row.registeredCount,
          rate: row.attendanceRate,
          avgMin: formatDurationMinutes(row.avgDurationSeconds),
        })),
        measures: ["attended", "registered", "rate", "avgMin"],
      },
    },
    {
      id: "low-attendance-sessions",
      title: "Low attendance sessions",
      defaultViz: "table",
      span: "full",
      data: {
        columns: [
          { key: "title", label: "Session", kind: "string" },
          { key: "attended", label: "Attended", kind: "measure" },
          { key: "registered", label: "Registered", kind: "measure" },
          { key: "rate", label: "Rate %", kind: "measure" },
        ],
        rows: snapshot.lowAttendanceSessions.map((row) => ({
          title: row.title,
          attended: row.attendedCount,
          registered: row.registeredCount,
          rate: row.attendanceRate,
        })),
        measures: ["attended", "registered", "rate"],
      },
    },
  ];
}

function ctaClickRate(views: number, clicks: number): number {
  if (views <= 0) return 0;
  return Math.round((clicks / views) * 100);
}

function marketingInsightAlertMetrics(snapshot: MarketingInsightSnapshot): InsightAlertMetrics {
  return {
    liveForms: snapshot.liveFormCount,
    submissions30d: snapshot.submissions30d,
    liveCtas: snapshot.liveCtaCount,
    ctaViews: snapshot.ctaViews,
    ctaClickRate: ctaClickRate(snapshot.ctaViews, snapshot.ctaClicks),
  };
}

function buildMarketingInsightWidgets(snapshot: MarketingInsightSnapshot): InsightWidget[] {
  const clickRate = ctaClickRate(snapshot.ctaViews, snapshot.ctaClicks);

  return [
    kpiWidget("attribution-events", "Attribution events", snapshot.attributionTotal),
    kpiWidget("attribution-30d", "Attribution events (30d)", snapshot.attribution30d),
    kpiWidget(
      "attribution-revenue",
      "Attributed revenue",
      centsToMajor(snapshot.attributionRevenueCents),
    ),
    kpiWidget("contacts", "Contacts", snapshot.contactCount),
    kpiWidget("contacts-30d", "Contacts (30d)", snapshot.contacts30d),
    kpiWidget("form-submissions", "Form submissions", snapshot.submissionCount),
    kpiWidget("submissions-30d", "Submissions (30d)", snapshot.submissions30d),
    kpiWidget("live-forms", "Live forms", snapshot.liveFormCount),
    kpiWidget("live-ctas", "Live CTAs", snapshot.liveCtaCount),
    kpiWidget("cta-views", "CTA views", snapshot.ctaViews),
    kpiWidget("cta-clicks", "CTA clicks", snapshot.ctaClicks),
    kpiWidget("cta-click-rate", "CTA click rate %", clickRate),
    kpiWidget("published-workflows", "Published workflows", snapshot.publishedWorkflowCount),
    kpiWidget("workflow-runs-30d", "Workflow runs (30d)", snapshot.workflowRuns30d),
    kpiWidget("coupon-redemptions", "Coupon redemptions", snapshot.couponRedemptions),
    kpiWidget("event-registrations", "Event registrations", snapshot.eventRegistrations),
    {
      id: "attribution-by-source",
      title: "Attribution by source",
      defaultViz: "bar",
      span: "half",
      data: {
        columns: [
          { key: "label", label: "Source", kind: "dimension" },
          { key: "value", label: "Events", kind: "measure" },
        ],
        rows: snapshot.bySource.map((row) => ({
          label: row.source,
          value: row.count,
        })),
        dimensions: ["label"],
        measures: ["value"],
      },
    },
    {
      id: "attribution-by-medium",
      title: "Attribution by medium",
      defaultViz: "bar",
      span: "half",
      data: {
        columns: [
          { key: "label", label: "Medium", kind: "dimension" },
          { key: "value", label: "Events", kind: "measure" },
        ],
        rows: snapshot.byMedium.map((row) => ({
          label: row.medium,
          value: row.count,
        })),
        dimensions: ["label"],
        measures: ["value"],
      },
    },
    {
      id: "daily-leads",
      title: "Daily leads (30d)",
      defaultViz: "line",
      span: "full",
      data: {
        columns: [
          { key: "period", label: "Period", kind: "date" },
          { key: "submissions", label: "Submissions", kind: "measure" },
          { key: "contacts", label: "Contacts", kind: "measure" },
        ],
        rows: snapshot.dailyLeads.map((row) => ({
          period: row.period,
          submissions: row.submissions,
          contacts: row.contacts,
        })),
        dimensions: ["period"],
        measures: ["submissions", "contacts"],
      },
    },
    {
      id: "top-sources",
      title: "Top sources (with revenue)",
      defaultViz: "table",
      span: "half",
      data: {
        columns: [
          { key: "source", label: "Source", kind: "string" },
          { key: "events", label: "Events", kind: "measure" },
          { key: "revenue", label: "Attributed revenue", kind: "measure" },
        ],
        rows: snapshot.bySource.map((row) => ({
          source: row.source,
          events: row.count,
          revenue: centsToMajor(row.revenueCents),
        })),
        measures: ["events", "revenue"],
      },
    },
    {
      id: "top-campaigns-utm",
      title: "Top UTM campaigns",
      defaultViz: "table",
      span: "half",
      data: {
        columns: [
          { key: "campaign", label: "Campaign", kind: "string" },
          { key: "events", label: "Events", kind: "measure" },
          { key: "revenue", label: "Attributed revenue", kind: "measure" },
        ],
        rows: snapshot.byCampaign.map((row) => ({
          campaign: row.campaign,
          events: row.count,
          revenue: centsToMajor(row.revenueCents),
        })),
        measures: ["events", "revenue"],
      },
    },
    {
      id: "top-forms",
      title: "Top forms by submissions",
      defaultViz: "table",
      span: "half",
      data: {
        columns: [
          { key: "title", label: "Form", kind: "string" },
          { key: "status", label: "Status", kind: "dimension" },
          { key: "submissions", label: "Submissions", kind: "measure" },
        ],
        rows: snapshot.topForms.map((row) => ({
          title: row.title,
          status: row.status,
          submissions: row.submissions,
        })),
        measures: ["submissions"],
      },
    },
    {
      id: "top-ctas",
      title: "Top CTAs by engagement",
      defaultViz: "table",
      span: "half",
      data: {
        columns: [
          { key: "title", label: "CTA", kind: "string" },
          { key: "type", label: "Type", kind: "dimension" },
          { key: "status", label: "Status", kind: "dimension" },
          { key: "views", label: "Views", kind: "measure" },
          { key: "clicks", label: "Clicks", kind: "measure" },
        ],
        rows: snapshot.topCtas.map((row) => ({
          title: row.title,
          type: row.ctaType,
          status: row.status,
          views: row.views,
          clicks: row.clicks,
        })),
        measures: ["views", "clicks"],
      },
    },
    {
      id: "top-coupons",
      title: "Top coupons by redemptions",
      defaultViz: "table",
      span: "half",
      data: {
        columns: [
          { key: "code", label: "Code", kind: "string" },
          { key: "name", label: "Name", kind: "string" },
          { key: "redemptions", label: "Redemptions", kind: "measure" },
          { key: "discount", label: "Discount given", kind: "measure" },
        ],
        rows: snapshot.topCoupons.map((row) => ({
          code: row.code,
          name: row.name,
          redemptions: row.redemptions,
          discount: centsToMajor(row.discountCents),
        })),
        measures: ["redemptions", "discount"],
      },
    },
    {
      id: "marketing-inventory",
      title: "Marketing inventory",
      defaultViz: "table",
      span: "half",
      data: {
        columns: [
          { key: "asset", label: "Asset", kind: "dimension" },
          { key: "count", label: "Count", kind: "measure" },
        ],
        rows: [
          { asset: "Forms (all)", count: snapshot.formCount },
          { asset: "Forms (live)", count: snapshot.liveFormCount },
          { asset: "CTAs (all)", count: snapshot.ctaCount },
          { asset: "CTAs (live)", count: snapshot.liveCtaCount },
          { asset: "Workflows (published)", count: snapshot.publishedWorkflowCount },
          { asset: "Campaigns (launched)", count: snapshot.launchedCampaignCount },
          { asset: "Email campaigns sent", count: snapshot.emailCampaignSent },
          { asset: "Active coupons", count: snapshot.activeCouponCount },
          { asset: "Events", count: snapshot.eventCount },
          { asset: "Event registrations (30d)", count: snapshot.eventRegistrations30d },
        ],
        dimensions: ["asset"],
        measures: ["count"],
      },
    },
    {
      id: "recent-workflow-runs",
      title: "Recent workflow runs",
      defaultViz: "table",
      span: "full",
      data: {
        columns: [
          { key: "workflow", label: "Workflow", kind: "string" },
          { key: "status", label: "Status", kind: "dimension" },
          { key: "trigger", label: "Trigger", kind: "string" },
          { key: "created", label: "Created", kind: "date" },
        ],
        rows: snapshot.recentWorkflowRuns.map((row) => ({
          workflow: row.workflowTitle,
          status: row.status,
          trigger: row.triggerEventType,
          created: row.createdAt.slice(0, 16).replace("T", " "),
        })),
      },
    },
  ];
}

function whatsappDeliveryRate(delivered: number, recipients: number): number {
  if (recipients <= 0) return 0;
  return Math.round((delivered / recipients) * 100);
}

function messengerInsightAlertMetrics(snapshot: MessengerInsightSnapshot): InsightAlertMetrics {
  return {
    whatsappConnected: snapshot.whatsappConnected ? 1 : 0,
    whatsappSent: snapshot.whatsappSentCount,
    whatsappFailed: snapshot.whatsappFailed,
  };
}

function buildMessengerInsightWidgets(snapshot: MessengerInsightSnapshot): InsightWidget[] {
  const waRate = whatsappDeliveryRate(snapshot.whatsappDelivered, snapshot.whatsappRecipients);

  return [
    kpiWidget("outbound-sends", "Outbound campaigns sent", snapshot.totalOutboundSends),
    kpiWidget("outbound-reach", "Total outbound reach", snapshot.totalOutboundReach),
    kpiWidget("email-sent", "Email campaigns sent", snapshot.emailSentCount),
    kpiWidget("email-reach", "Email recipients", snapshot.emailRecipients),
    kpiWidget("email-reach-30d", "Email recipients (30d)", snapshot.emailRecipients30d),
    kpiWidget("push-sent", "Push messages sent", snapshot.pushSentCount),
    kpiWidget("push-reach", "Push recipients", snapshot.pushRecipients),
    kpiWidget("whatsapp-sent", "WhatsApp campaigns sent", snapshot.whatsappSentCount),
    kpiWidget("whatsapp-delivered", "WhatsApp delivered", snapshot.whatsappDelivered),
    kpiWidget("whatsapp-failed", "WhatsApp failed", snapshot.whatsappFailed),
    kpiWidget("whatsapp-delivery-rate", "WhatsApp delivery %", waRate),
    kpiWidget("announcements", "Announcements sent", snapshot.announcementCount),
    kpiWidget("inbox-messages", "Inbox messages", snapshot.inboxMessageCount),
    kpiWidget("inbox-30d", "Inbox messages (30d)", snapshot.inboxMessages30d),
    kpiWidget("open-conversations", "Open conversations", snapshot.openConversationCount),
    kpiWidget(
      "scheduled-total",
      "Scheduled campaigns",
      snapshot.emailScheduledCount + snapshot.pushScheduledCount + snapshot.whatsappScheduledCount,
    ),
    {
      id: "channel-mix-sends",
      title: "Sends by channel",
      defaultViz: "bar",
      span: "half",
      data: {
        columns: [
          { key: "label", label: "Channel", kind: "dimension" },
          { key: "value", label: "Sends", kind: "measure" },
        ],
        rows: snapshot.channelMix.map((row) => ({
          label: row.channel,
          value: row.sends,
        })),
        dimensions: ["label"],
        measures: ["value"],
      },
    },
    {
      id: "channel-mix-reach",
      title: "Reach by channel",
      defaultViz: "bar",
      span: "half",
      data: {
        columns: [
          { key: "label", label: "Channel", kind: "dimension" },
          { key: "value", label: "Recipients", kind: "measure" },
        ],
        rows: snapshot.channelMix.map((row) => ({
          label: row.channel,
          value: row.recipients,
        })),
        dimensions: ["label"],
        measures: ["value"],
      },
    },
    {
      id: "daily-volume",
      title: "Daily messaging volume (30d)",
      defaultViz: "line",
      span: "full",
      data: {
        columns: [
          { key: "period", label: "Period", kind: "date" },
          { key: "email", label: "Email reach", kind: "measure" },
          { key: "push", label: "Push reach", kind: "measure" },
          { key: "whatsapp", label: "WhatsApp reach", kind: "measure" },
          { key: "inbox", label: "Inbox messages", kind: "measure" },
        ],
        rows: snapshot.dailyVolume.map((row) => ({
          period: row.period,
          email: row.emailRecipients,
          push: row.pushRecipients,
          whatsapp: row.whatsappRecipients,
          inbox: row.inboxMessages,
        })),
        dimensions: ["period"],
        measures: ["email", "push", "whatsapp", "inbox"],
      },
    },
    {
      id: "recent-email",
      title: "Recent marketing emails",
      defaultViz: "table",
      span: "half",
      data: {
        columns: [
          { key: "title", label: "Campaign", kind: "string" },
          { key: "status", label: "Status", kind: "dimension" },
          { key: "recipients", label: "Recipients", kind: "measure" },
          { key: "sent", label: "Sent", kind: "date" },
        ],
        rows: snapshot.recentEmailCampaigns.map((row) => ({
          title: row.title,
          status: row.status,
          recipients: row.recipientCount,
          sent: row.sentAt ? row.sentAt.slice(0, 16).replace("T", " ") : null,
        })),
        measures: ["recipients"],
      },
    },
    {
      id: "recent-push",
      title: "Recent push messages",
      defaultViz: "table",
      span: "half",
      data: {
        columns: [
          { key: "title", label: "Push", kind: "string" },
          { key: "status", label: "Status", kind: "dimension" },
          { key: "channels", label: "Channels", kind: "string" },
          { key: "recipients", label: "Recipients", kind: "measure" },
          { key: "sent", label: "Sent", kind: "date" },
        ],
        rows: snapshot.recentPushMessages.map((row) => ({
          title: row.title,
          status: row.status,
          channels: row.channels,
          recipients: row.recipientCount,
          sent: row.sentAt ? row.sentAt.slice(0, 16).replace("T", " ") : null,
        })),
        measures: ["recipients"],
      },
    },
    {
      id: "recent-whatsapp",
      title: "Recent WhatsApp campaigns",
      defaultViz: "table",
      span: "half",
      data: {
        columns: [
          { key: "title", label: "Campaign", kind: "string" },
          { key: "status", label: "Status", kind: "dimension" },
          { key: "recipients", label: "Recipients", kind: "measure" },
          { key: "delivered", label: "Delivered", kind: "measure" },
          { key: "failed", label: "Failed", kind: "measure" },
          { key: "sent", label: "Sent", kind: "date" },
        ],
        rows: snapshot.recentWhatsappCampaigns.map((row) => ({
          title: row.title,
          status: row.status,
          recipients: row.recipientCount,
          delivered: row.deliveredCount,
          failed: row.failedCount,
          sent: row.sentAt ? row.sentAt.slice(0, 16).replace("T", " ") : null,
        })),
        measures: ["recipients", "delivered", "failed"],
      },
    },
    {
      id: "recent-announcements",
      title: "Recent announcements",
      defaultViz: "table",
      span: "half",
      data: {
        columns: [
          { key: "title", label: "Announcement", kind: "string" },
          { key: "type", label: "Type", kind: "dimension" },
          { key: "recipients", label: "Recipients", kind: "measure" },
          { key: "sent", label: "Sent", kind: "date" },
        ],
        rows: snapshot.recentAnnouncements.map((row) => ({
          title: row.title,
          type: row.type,
          recipients: row.recipientCount,
          sent: row.sentAt ? row.sentAt.slice(0, 16).replace("T", " ") : null,
        })),
        measures: ["recipients"],
      },
    },
  ];
}

async function openAlertsForMetrics(
  tx: TenantTx,
  slug: string,
  metrics: InsightAlertMetrics,
): Promise<InsightAlert[]> {
  const raw = await loadInsightAlertStateJson(tx);
  const board = projectInsightAlertBoard({
    slug,
    metrics,
    state: parseInsightAlertState(raw),
  });
  return openAlertsFromBoard(board.items);
}

async function loadInsightAlertMetrics(
  tx: TenantTx,
  slug: string,
  range: InsightDashboardRange,
): Promise<InsightAlertMetrics> {
  if (slug === "dashboard") {
    return dashboardAlertMetrics(await loadInsightDashboardSnapshot(tx, range));
  }
  if (slug === "school-vitals") {
    const days = insightRangeDayCount(range);
    const [snapshot, rollups] = await Promise.all([
      loadSchoolVitalsSnapshot(tx, days),
      loadLearningRollupBundle(tx, days),
    ]);
    return schoolVitalsAlertMetrics(snapshot, rollups);
  }
  if (slug === "sales-insight") {
    return salesInsightAlertMetrics(await loadSalesInsightSnapshot(tx));
  }
  if (slug === "live-dashboard") {
    return liveDashboardAlertMetrics(await loadLiveDashboardSnapshot(tx));
  }
  if (slug === "marketing-insight") {
    return marketingInsightAlertMetrics(await loadMarketingInsightSnapshot(tx));
  }
  if (slug === "messenger-insight") {
    return messengerInsightAlertMetrics(await loadMessengerInsightSnapshot(tx));
  }
  return {};
}

async function buildInsightAlertsBoard(
  tx: TenantTx,
  slug: string,
  range: InsightDashboardRange,
  persist: boolean,
): Promise<InsightAlertsBoard> {
  const [metrics, raw] = await Promise.all([
    loadInsightAlertMetrics(tx, slug, range),
    loadInsightAlertStateJson(tx),
  ]);
  const board = projectInsightAlertBoard({
    slug,
    metrics,
    state: parseInsightAlertState(raw),
  });
  if (persist) {
    await saveInsightAlertStateJson(tx, board.nextState);
  }
  return {
    slug,
    title: SLUG_TITLES[slug] ?? slug.replace(/-/g, " "),
    generatedAt: new Date().toISOString(),
    range,
    summary: board.summary,
    alerts: board.items,
    rules: board.rules,
  };
}

async function buildInsightDashboardPayload(
  tx: TenantTx,
  ctx: InsightsCtx,
  slug: string,
  range: InsightDashboardRange = "12m",
): Promise<{
  slug: string;
  title: string;
  currency?: string;
  range?: InsightDashboardRange;
  generatedAt: string;
  alerts: InsightAlert[];
  widgets: InsightWidget[];
}> {
  const title = SLUG_TITLES[slug] ?? slug.replace(/-/g, " ");
  const generatedAt = new Date().toISOString();

  if (slug === "dashboard") {
    const [snapshot, learning] = await Promise.all([
      loadInsightDashboardSnapshot(tx, range),
      buildLearningWidgets(tx),
    ]);

    return {
      slug,
      title,
      currency: snapshot.currency,
      range,
      generatedAt,
      alerts: await openAlertsForMetrics(tx, slug, dashboardAlertMetrics(snapshot)),
      widgets: buildMainDashboardWidgets(snapshot, learning, range),
    };
  }

  if (slug === "school-vitals") {
    const days = insightRangeDayCount(range);
    const [snapshot, rollups] = await Promise.all([
      loadSchoolVitalsSnapshot(tx, days),
      loadLearningRollupBundle(tx, days),
    ]);
    const funnelStages = await loadEngagementFunnelStages(tx, ctx, rollups.from, rollups.to);

    return {
      slug,
      title,
      range,
      generatedAt,
      alerts: await openAlertsForMetrics(tx, slug, schoolVitalsAlertMetrics(snapshot, rollups)),
      widgets: buildSchoolVitalsWidgets(snapshot, rollups, funnelStages, range),
    };
  }

  if (slug === "sales-insight") {
    const snapshot = await loadSalesInsightSnapshot(tx);
    return {
      slug,
      title,
      currency: snapshot.currency,
      range,
      generatedAt,
      alerts: await openAlertsForMetrics(tx, slug, salesInsightAlertMetrics(snapshot)),
      widgets: buildSalesInsightWidgets(snapshot),
    };
  }

  if (slug === "live-dashboard") {
    const snapshot = await loadLiveDashboardSnapshot(tx);
    return {
      slug,
      title,
      range,
      generatedAt,
      alerts: await openAlertsForMetrics(tx, slug, liveDashboardAlertMetrics(snapshot)),
      widgets: buildLiveDashboardWidgets(snapshot),
    };
  }

  if (slug === "marketing-insight") {
    const snapshot = await loadMarketingInsightSnapshot(tx);
    return {
      slug,
      title,
      range,
      generatedAt,
      alerts: await openAlertsForMetrics(tx, slug, marketingInsightAlertMetrics(snapshot)),
      widgets: buildMarketingInsightWidgets(snapshot),
    };
  }

  if (slug === "messenger-insight") {
    const snapshot = await loadMessengerInsightSnapshot(tx);
    return {
      slug,
      title,
      range,
      generatedAt,
      alerts: await openAlertsForMetrics(tx, slug, messengerInsightAlertMetrics(snapshot)),
      widgets: buildMessengerInsightWidgets(snapshot),
    };
  }

  return {
    slug,
    title,
    range,
    generatedAt,
    alerts: [],
    widgets: [emptyBarWidget(`${slug}-trend`, `${title} trend`)],
  };
}

async function resolveDashboardLayout(
  tx: TenantTx,
  ctx: InsightsCtx,
  slug: string,
  widgets: InsightWidget[],
) {
  const catalog = widgetsToCatalog(widgets);
  const raw = await loadInsightLayoutStateJson(tx);
  return mergeLayoutWithCatalog(
    resolveStoredLayout(parseInsightLayoutState(raw), slug, ctx.actorMembershipId),
    catalog,
    slug,
  );
}

function copyTargetsFor(slug: string): Array<{ slug: string; title: string }> {
  return Object.entries(SLUG_TITLES)
    .filter(([key]) => key !== slug)
    .map(([key, title]) => ({ slug: key, title }));
}

async function assertInsightSectionVisible(tx: TenantTx, slug: string): Promise<void> {
  const settings = parseInsightSettings(await loadInsightSettingsJson(tx));
  if (settings.restrictedSlugs.includes(slug)) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "This insight section is restricted.",
    });
  }
}

export async function getInsightDashboard(
  tx: TenantTx,
  ctx: InsightsCtx,
  slug: string,
  range: InsightDashboardRange = "12m",
): Promise<{
  slug: string;
  title: string;
  currency?: string;
  range?: InsightDashboardRange;
  generatedAt: string;
  alerts: InsightAlert[];
  widgets: InsightWidget[];
  layout: InsightLayoutBoard["layout"];
}> {
  await assertInsightSectionVisible(tx, slug);
  const payload = await buildInsightDashboardPayload(tx, ctx, slug, range);
  const layout = await resolveDashboardLayout(tx, ctx, slug, payload.widgets);
  return { ...payload, layout };
}

export async function getInsightLayout(
  tx: TenantTx,
  ctx: InsightsCtx,
  slug: string,
): Promise<InsightLayoutBoard> {
  await assertInsightSectionVisible(tx, slug);
  const payload = await buildInsightDashboardPayload(tx, ctx, slug, "12m");
  const catalog = widgetsToCatalog(payload.widgets).map((item) => ({
    ...item,
    allowedViz: allowedVizFor(item.defaultViz),
  }));
  const layout = await resolveDashboardLayout(tx, ctx, slug, payload.widgets);
  return {
    slug,
    title: payload.title,
    generatedAt: new Date().toISOString(),
    layout,
    factory: factoryLayout(slug, catalog),
    catalog,
    summary: summarizeLayout(layout, catalog),
    copyTargets: copyTargetsFor(slug),
  };
}

export async function mutateInsightLayout(
  tx: TenantTx,
  ctx: InsightsCtx,
  slug: string,
  input: InsightLayoutMutationBody,
): Promise<InsightLayoutBoard> {
  await assertInsightSectionVisible(tx, slug);
  if (!SLUG_TITLES[slug]) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Unknown insight section.",
    });
  }

  if (input.action === "save" && !input.layout) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "layout is required when saving.",
    });
  }
  if (input.action === "copy") {
    if (!input.layout) {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "layout is required when copying.",
      });
    }
    if (!input.targetSlug || !SLUG_TITLES[input.targetSlug]) {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "Choose a valid dashboard to copy this layout onto.",
      });
    }
    if (input.targetSlug === slug) {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "Pick a different section to copy this layout onto.",
      });
    }
  }

  const payload = await buildInsightDashboardPayload(tx, ctx, slug, "12m");
  const catalog = widgetsToCatalog(payload.widgets).map((item) => ({
    ...item,
    allowedViz: allowedVizFor(item.defaultViz),
  }));
  const raw = await loadInsightLayoutStateJson(tx);
  const state = parseInsightLayoutState(raw);

  let action: Parameters<typeof applyInsightLayoutMutation>[0]["action"];
  if (input.action === "reset") {
    action = { type: "reset" };
  } else if (input.action === "copy") {
    const copyLayout = input.layout;
    const targetSlug = input.targetSlug;
    if (!copyLayout || !targetSlug) {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "layout and targetSlug are required when copying.",
      });
    }
    const targetPayload = await buildInsightDashboardPayload(tx, ctx, targetSlug, "12m");
    action = {
      type: "copy",
      layout: copyLayout,
      targetSlug,
      targetCatalog: widgetsToCatalog(targetPayload.widgets),
    };
  } else {
    const savedLayout = input.layout;
    if (!savedLayout) {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "layout is required when saving.",
      });
    }
    action = { type: "save", layout: savedLayout };
  }

  const mutated = applyInsightLayoutMutation({
    state,
    membershipId: ctx.actorMembershipId,
    slug,
    catalog,
    action,
  });
  await saveInsightLayoutStateJson(tx, mutated.state);

  const layout = mergeLayoutWithCatalog(
    resolveStoredLayout(mutated.state, slug, ctx.actorMembershipId),
    catalog,
    slug,
  );
  return {
    slug,
    title: payload.title,
    generatedAt: new Date().toISOString(),
    layout,
    factory: factoryLayout(slug, catalog),
    catalog,
    summary: summarizeLayout(layout, catalog),
    copyTargets: copyTargetsFor(slug),
  };
}

function insightSectionList(): Array<{ slug: string; title: string }> {
  return Object.entries(SLUG_TITLES).map(([slug, title]) => ({ slug, title }));
}

export async function getInsightLibrary(
  tx: TenantTx,
  ctx: InsightsCtx,
  slug: string,
  range: InsightDashboardRange = "12m",
  targetSlugInput?: string,
): Promise<InsightLibraryBoard> {
  const targetSlug = targetSlugInput && SLUG_TITLES[targetSlugInput] ? targetSlugInput : slug;
  if (!SLUG_TITLES[slug] || !SLUG_TITLES[targetSlug]) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Unknown insight section.",
    });
  }

  const sections = insightSectionList();
  const payloads = await Promise.all(
    sections.map((section) => buildInsightDashboardPayload(tx, ctx, section.slug, range)),
  );
  const targetPayload = payloads.find((payload) => payload.slug === targetSlug) ?? payloads[0];
  if (!targetPayload) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Unknown insight section.",
    });
  }
  const targetLayout = await resolveDashboardLayout(tx, ctx, targetSlug, targetPayload.widgets);
  const targetIds = new Set(targetPayload.widgets.map((widget) => widget.id));
  const visibleIds = new Set(
    targetLayout.widgets.filter((entry) => !entry.hidden).map((entry) => entry.id),
  );

  const items = payloads.flatMap((payload) =>
    payload.widgets.map((widget) =>
      buildLibraryItem({
        widget,
        sourceSlug: payload.slug,
        sourceTitle: payload.title,
        targetHasWidget: targetIds.has(widget.id),
        onTarget: targetIds.has(widget.id) && visibleIds.has(widget.id),
      }),
    ),
  );

  return {
    slug,
    title: SLUG_TITLES[slug] ?? slug,
    targetSlug,
    targetTitle: SLUG_TITLES[targetSlug] ?? targetSlug,
    generatedAt: new Date().toISOString(),
    range,
    ...(targetPayload.currency ? { currency: targetPayload.currency } : {}),
    sections,
    categories: INSIGHT_LIBRARY_CATEGORIES.map((row) => ({ id: row.id, label: row.label })),
    items,
  };
}

export async function mutateInsightLibrary(
  tx: TenantTx,
  ctx: InsightsCtx,
  slug: string,
  input: InsightLibraryMutationBody,
): Promise<InsightLibraryBoard> {
  const targetSlug = input.targetSlug && SLUG_TITLES[input.targetSlug] ? input.targetSlug : slug;
  if (!SLUG_TITLES[targetSlug]) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Unknown insight section.",
    });
  }
  const payload = await buildInsightDashboardPayload(tx, ctx, targetSlug, input.range ?? "12m");
  const catalog = widgetsToCatalog(payload.widgets);
  const catalogIds = new Set(catalog.map((item) => item.id));
  const widgetIds = input.widgetIds.filter((id) => catalogIds.has(id));
  if (widgetIds.length === 0) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "None of those widgets belong to the selected dashboard.",
    });
  }
  const raw = await loadInsightLayoutStateJson(tx);
  const state = parseInsightLayoutState(raw);
  const current = mergeLayoutWithCatalog(
    resolveStoredLayout(state, targetSlug, ctx.actorMembershipId),
    catalog,
    targetSlug,
  );
  const nextLayout = setLayoutWidgetsHidden(current, widgetIds, input.action === "remove");
  const mutated = applyInsightLayoutMutation({
    state,
    membershipId: ctx.actorMembershipId,
    slug: targetSlug,
    catalog,
    action: { type: "save", layout: nextLayout },
  });
  await saveInsightLayoutStateJson(tx, mutated.state);
  return getInsightLibrary(tx, ctx, slug, input.range ?? "12m", targetSlug);
}

export async function getInsightAlerts(
  tx: TenantTx,
  ctx: InsightsCtx,
  slug: string,
  range: InsightDashboardRange = "12m",
): Promise<InsightAlertsBoard> {
  void ctx;
  await assertInsightSectionVisible(tx, slug);
  return buildInsightAlertsBoard(tx, slug, range, true);
}

export async function mutateInsightAlerts(
  tx: TenantTx,
  ctx: InsightsCtx,
  slug: string,
  range: InsightDashboardRange,
  input: InsightAlertsMutationBody,
): Promise<InsightAlertsBoard> {
  await assertInsightSectionVisible(tx, slug);
  const ruleId = input.ruleId;
  if (input.action !== "mark-all-seen" && !ruleId) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "ruleId is required for this action.",
    });
  }
  if (ruleId && !findInsightAlertRule(slug, ruleId) && input.action !== "mark-all-seen") {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Unknown alert rule.",
    });
  }

  const [metrics, raw, actorLabel] = await Promise.all([
    loadInsightAlertMetrics(tx, slug, range),
    loadInsightAlertStateJson(tx),
    loadMembershipDisplayName(tx, ctx.actorMembershipId),
  ]);
  const projected = projectInsightAlertBoard({
    slug,
    metrics,
    state: parseInsightAlertState(raw),
  });

  let mutation: Parameters<typeof applyInsightAlertMutation>[0]["action"];
  if (input.action === "mute") {
    mutation = {
      type: "mute",
      ruleId: ruleId ?? "",
      muteUntil: muteUntilIso(input.muteFor ?? "7d"),
    };
  } else if (input.action === "unmute") {
    mutation = { type: "unmute", ruleId: ruleId ?? "" };
  } else if (input.action === "resolve") {
    mutation = { type: "resolve", ruleId: ruleId ?? "", resolvedByLabel: actorLabel };
  } else if (input.action === "mark-seen") {
    mutation = { type: "mark-seen", ruleId: ruleId ?? "" };
  } else if (input.action === "mark-all-seen") {
    mutation = { type: "mark-all-seen" };
  } else if (input.action === "toggle-rule") {
    mutation = { type: "toggle-rule", ruleId: ruleId ?? "", enabled: input.enabled !== false };
  } else {
    if (typeof input.threshold !== "number" || !Number.isFinite(input.threshold)) {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "threshold is required.",
      });
    }
    mutation = { type: "set-threshold", ruleId: ruleId ?? "", threshold: input.threshold };
  }

  const mutated = applyInsightAlertMutation({
    slug,
    state: projected.nextState,
    action: mutation,
  });
  const board = projectInsightAlertBoard({ slug, metrics, state: mutated });
  await saveInsightAlertStateJson(tx, board.nextState);

  return {
    slug,
    title: SLUG_TITLES[slug] ?? slug.replace(/-/g, " "),
    generatedAt: new Date().toISOString(),
    range,
    summary: board.summary,
    alerts: board.items,
    rules: board.rules,
  };
}

function insightSections(): Array<{ slug: string; title: string }> {
  return Object.entries(SLUG_TITLES).map(([slug, title]) => ({ slug, title }));
}

function digestPeriodLabel(period: InsightDigest["period"]): string {
  if (period === "30d") return "Last 30 days";
  if (period === "ytd") return "Year to date";
  return "Last 12 months";
}

function widgetMeasureValue(widget: InsightWidget): number {
  const measure = widget.data.measures?.[0];
  const row = widget.data.rows[0];
  if (!measure || !row) return 0;
  const raw = row[measure];
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function widgetLooksLikeMoney(widget: InsightWidget): boolean {
  const title = widget.title.toLowerCase();
  return title.includes("revenue") || title.includes("amount") || title.includes("gmv");
}

async function buildDigestPreview(
  tx: TenantTx,
  ctx: InsightsCtx,
  digest: InsightDigest,
  academyName: string,
): Promise<InsightDigestsBoard["preview"]> {
  const payload = await buildInsightDashboardPayload(tx, ctx, digest.sourceSlug, digest.period);
  const selection = digestPreviewSelection(payload.widgets, {
    includeKpis: digest.includeKpis,
    widgetIds: digest.widgetIds,
  });
  const byId = new Map(payload.widgets.map((widget) => [widget.id, widget]));
  const kpis = selection.kpiIds.flatMap((id) => {
    const widget = byId.get(id);
    if (!widget) return [];
    return [
      {
        id: widget.id,
        title: widget.title,
        value: widgetMeasureValue(widget),
        money: widgetLooksLikeMoney(widget),
        ...(widget.deltaPct != null ? { deltaPct: widget.deltaPct } : {}),
      },
    ];
  });
  const charts = selection.chartIds.flatMap((id) => {
    const widget = byId.get(id);
    if (!widget) return [];
    return [
      {
        id: widget.id,
        title: widget.title,
        sparkline: widget.sparkline ?? [],
      },
    ];
  });
  return {
    digestId: digest.id,
    digestName: digest.name,
    academyName,
    sectionTitle: payload.title,
    periodLabel: digestPeriodLabel(digest.period),
    format: digest.format,
    liveHref: `/admin/insights/${digest.sourceSlug}`,
    alerts: digest.includeAlerts ? payload.alerts : [],
    kpis,
    charts,
    ...(payload.currency ? { currency: payload.currency } : {}),
  };
}

function resolveDigestDomains(tenantDomains: string[], actorEmail: string | null): string[] {
  const domains = [...tenantDomains];
  if (actorEmail) {
    const domain = emailDomain(actorEmail);
    if (domain && !domains.includes(domain)) domains.push(domain);
  }
  return domains;
}

async function buildInsightDigestsBoard(
  tx: TenantTx,
  ctx: InsightsCtx,
  slug: string,
  previewId?: string,
): Promise<InsightDigestsBoard> {
  if (!SLUG_TITLES[slug]) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Unknown insight section.",
    });
  }
  const [raw, actorEmail, tenantDomains, academyName, payload] = await Promise.all([
    loadInsightDigestStateJson(tx),
    loadMembershipEmail(tx, ctx.actorMembershipId),
    loadTenantEmailDomains(tx),
    loadTenantAcademyName(tx),
    buildInsightDashboardPayload(tx, ctx, slug, "30d"),
  ]);
  const domains = resolveDigestDomains(tenantDomains, actorEmail);
  const state = parseInsightDigestState(raw);
  const now = new Date();
  const digests = digestList(state).map((digest) =>
    projectDigestItem(digest, {
      sourceTitle: SLUG_TITLES[digest.sourceSlug] ?? digest.sourceSlug,
      domains,
      now,
    }),
  );
  const previewDigest = previewId ? state["items"][previewId] : undefined;
  const preview = previewDigest
    ? await buildDigestPreview(tx, ctx, previewDigest, academyName)
    : null;
  return {
    slug,
    title: SLUG_TITLES[slug] ?? slug,
    academyName,
    actorEmail,
    tenantDomains: domains,
    generatedAt: now.toISOString(),
    sections: insightSections(),
    timezones: [...INSIGHT_DIGEST_TIMEZONES],
    weekdays: INSIGHT_DIGEST_WEEKDAYS.map((row) => ({ value: row.value, label: row.label })),
    catalog: payload.widgets.map((widget) => ({
      id: widget.id,
      title: widget.title,
      defaultViz: widget.defaultViz,
    })),
    summary: projectDigestSummary(digestList(state), domains, now),
    digests,
    preview,
  };
}

export async function getInsightDigests(
  tx: TenantTx,
  ctx: InsightsCtx,
  slug: string,
  previewId?: string,
): Promise<InsightDigestsBoard> {
  await assertInsightSectionVisible(tx, slug);
  return buildInsightDigestsBoard(tx, ctx, slug, previewId);
}

export async function mutateInsightDigests(
  tx: TenantTx,
  ctx: InsightsCtx,
  slug: string,
  input: InsightDigestsMutationBody,
): Promise<InsightDigestsBoard> {
  await assertInsightSectionVisible(tx, slug);
  if (!SLUG_TITLES[slug]) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Unknown insight section.",
    });
  }
  const raw = await loadInsightDigestStateJson(tx);
  const state = parseInsightDigestState(raw);
  const now = new Date();

  if (input.action === "create") {
    if (!input.digest) {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "digest is required when creating.",
      });
    }
    if (!SLUG_TITLES[input.digest.sourceSlug]) {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "Unknown source section.",
      });
    }
    const created = createDigest(input.digest, now);
    const next = applyDigestMutation(state, { type: "create", digest: created });
    await saveInsightDigestStateJson(tx, next);
    return buildInsightDigestsBoard(tx, ctx, slug);
  }

  if (!input.id) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "id is required for this action.",
    });
  }
  const existing = state["items"][input.id];
  if (!existing) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Digest not found.",
    });
  }

  if (input.action === "delete") {
    const next = applyDigestMutation(state, { type: "delete", id: input.id });
    await saveInsightDigestStateJson(tx, next);
    return buildInsightDigestsBoard(tx, ctx, slug);
  }

  if (input.action === "toggle") {
    const next = applyDigestMutation(state, {
      type: "toggle",
      id: input.id,
      enabled: input.enabled !== false,
    });
    await saveInsightDigestStateJson(tx, next);
    return buildInsightDigestsBoard(tx, ctx, slug);
  }

  if (input.action === "send-test") {
    const next = applyDigestMutation(state, {
      type: "send-test",
      id: input.id,
      at: now.toISOString(),
      status: existing.recipients.length > 0 ? "delivered" : "failed",
      error:
        existing.recipients.length > 0 ? null : "Add at least one recipient before sending a test.",
    });
    await saveInsightDigestStateJson(tx, next);
    return buildInsightDigestsBoard(tx, ctx, slug);
  }

  if (!input.digest) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "digest is required when updating.",
    });
  }
  if (!SLUG_TITLES[input.digest.sourceSlug]) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Unknown source section.",
    });
  }
  const updated = createDigest(input.digest, now);
  const next = applyDigestMutation(state, {
    type: "update",
    id: input.id,
    digest: {
      ...updated,
      id: existing.id,
      createdAt: existing.createdAt,
      sends: existing.sends,
      enabled: existing.enabled,
    },
  });
  await saveInsightDigestStateJson(tx, next);
  return buildInsightDigestsBoard(tx, ctx, slug);
}

async function buildInsightSettingsBoard(
  tx: TenantTx,
  slug: string,
): Promise<InsightSettingsBoard> {
  const [raw, currency, roles, layoutRaw] = await Promise.all([
    loadInsightSettingsJson(tx),
    loadInsightDisplayCurrency(tx),
    loadInsightViewerRoles(tx),
    loadInsightLayoutStateJson(tx),
  ]);
  const settings = parseInsightSettings(raw);
  const layoutState = parseInsightLayoutState(layoutRaw);
  const tenantLayouts = layoutState["tenant"];
  const access = insightSectionSlugs().map((sectionSlug) => {
    const restricted = settings.restrictedSlugs.includes(sectionSlug);
    return {
      slug: sectionSlug,
      title: insightSectionTitle(sectionSlug),
      href: `/admin/insights/${sectionSlug}`,
      restricted,
      visibleTo: restricted ? [] : roles,
      dataClass: insightDataClass(sectionSlug),
      layoutSource: tenantLayouts[sectionSlug] ? ("tenant" as const) : ("factory" as const),
    };
  });
  return {
    slug,
    title: SLUG_TITLES[slug] ?? slug,
    generatedAt: new Date().toISOString(),
    currency,
    numberFormatSample: numberFormatSample(settings.numberFormat),
    settings: {
      defaultSection: settings.defaultSection,
      defaultPeriod: settings.defaultPeriod,
      weekStartsOn: settings.weekStartsOn,
      numberFormat: settings.numberFormat,
      autoRefresh: settings.autoRefresh,
      refreshIntervalMinutes: settings.refreshIntervalMinutes,
      showLastUpdated: settings.showLastUpdated,
      cacheMinutes: settings.cacheMinutes,
      restrictedSlugs: settings.restrictedSlugs,
    },
    sections: insightSectionSlugs().map((sectionSlug) => ({
      slug: sectionSlug,
      title: insightSectionTitle(sectionSlug),
    })),
    roles,
    access,
    activity: settings.activity,
  };
}

export async function getInsightSettings(
  tx: TenantTx,
  ctx: InsightsCtx,
  slug: string,
): Promise<InsightSettingsBoard> {
  void ctx;
  if (!SLUG_TITLES[slug]) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Unknown insight section.",
    });
  }
  return buildInsightSettingsBoard(tx, slug);
}

export async function mutateInsightSettings(
  tx: TenantTx,
  ctx: InsightsCtx,
  slug: string,
  input: InsightSettingsMutationBody,
): Promise<InsightSettingsBoard> {
  if (!SLUG_TITLES[slug]) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Unknown insight section.",
    });
  }
  const [raw, actorLabel] = await Promise.all([
    loadInsightSettingsJson(tx),
    loadMembershipDisplayName(tx, ctx.actorMembershipId),
  ]);
  let settings = parseInsightSettings(raw);

  if (input.action === "save") {
    if (!input.settings) {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "settings is required when saving.",
      });
    }
    settings = applyInsightSettingsMutation(settings, {
      type: "save",
      patch: input.settings,
      actorLabel,
    });
    await saveInsightSettingsJson(tx, settings);
    return buildInsightSettingsBoard(tx, slug);
  }

  const targetSlug = input.targetSlug;
  if (!targetSlug || !SLUG_TITLES[targetSlug]) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "targetSlug is required.",
    });
  }

  if (input.action === "reset-layout") {
    const payload = await buildInsightDashboardPayload(tx, ctx, targetSlug, "12m");
    const catalog = widgetsToCatalog(payload.widgets);
    const layoutRaw = await loadInsightLayoutStateJson(tx);
    const mutated = applyInsightLayoutMutation({
      state: parseInsightLayoutState(layoutRaw),
      membershipId: ctx.actorMembershipId,
      slug: targetSlug,
      catalog,
      action: { type: "reset" },
    });
    await saveInsightLayoutStateJson(tx, mutated.state);
    settings = describeLayoutReset(targetSlug, actorLabel, settings);
    await saveInsightSettingsJson(tx, settings);
    return buildInsightSettingsBoard(tx, slug);
  }

  if (input.action === "restrict") {
    const next = applyInsightSettingsMutation(settings, {
      type: "restrict",
      slug: targetSlug,
      actorLabel,
    });
    if (next.restrictedSlugs.length === settings.restrictedSlugs.length) {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "Keep at least one insight section visible.",
      });
    }
    await saveInsightSettingsJson(tx, next);
    return buildInsightSettingsBoard(tx, slug);
  }

  await saveInsightSettingsJson(
    tx,
    applyInsightSettingsMutation(settings, { type: "unrestrict", slug: targetSlug, actorLabel }),
  );
  return buildInsightSettingsBoard(tx, slug);
}

export async function getInsightWidgetDetail(
  tx: TenantTx,
  ctx: InsightsCtx,
  slug: string,
  widgetId: string,
  range: InsightDashboardRange = "12m",
): Promise<InsightWidgetDetail> {
  const dashboard = await getInsightDashboard(tx, ctx, slug, range);
  return buildInsightWidgetDetail(dashboard, widgetId);
}

export async function getInsightSalesOpportunity(
  tx: TenantTx,
  slug: string,
): Promise<InsightSalesOpportunityBoard> {
  await assertInsightSectionVisible(tx, slug);
  if (slug !== "sales-insight") {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Conversion opportunity is only available on Sales Insight.",
    });
  }
  const [snapshot, evidence] = await Promise.all([
    loadSalesInsightSnapshot(tx),
    loadSalesOpportunityEvidence(tx),
  ]);
  return buildInsightSalesOpportunity(snapshot, evidence);
}

export async function getInsightSalesAttribution(
  tx: TenantTx,
  slug: string,
): Promise<InsightSalesAttributionBoard> {
  await assertInsightSectionVisible(tx, slug);
  if (slug !== "sales-insight") {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Attribution is only available on Sales Insight.",
    });
  }
  const [snapshot, sources] = await Promise.all([
    loadSalesInsightSnapshot(tx),
    loadSalesAttributionSources(tx),
  ]);
  return buildInsightSalesAttribution(snapshot, sources);
}

export async function getInsightSalesPipeline(
  tx: TenantTx,
  slug: string,
): Promise<InsightSalesPipelineBoard> {
  await assertInsightSectionVisible(tx, slug);
  if (slug !== "sales-insight") {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Sales pipeline is only available on Sales Insight.",
    });
  }
  const snapshot = await loadSalesInsightSnapshot(tx);
  return buildInsightSalesPipeline(snapshot);
}

export async function getInsightEngagementFunnel(
  tx: TenantTx,
  slug: string,
  range: InsightDashboardRange = "30d",
): Promise<InsightEngagementFunnelBoard> {
  await assertInsightSectionVisible(tx, slug);
  if (slug !== "school-vitals") {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Engagement funnel is only available on School Vitals.",
    });
  }
  const days = insightRangeDayCount(range);
  const rollups = await loadLearningRollupBundle(tx, days);
  return buildInsightEngagementFunnel(rollups, range);
}

export async function getInsightContentHealth(
  tx: TenantTx,
  slug: string,
  range: InsightDashboardRange = "30d",
): Promise<InsightContentHealthBoard> {
  await assertInsightSectionVisible(tx, slug);
  if (slug !== "school-vitals") {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Content health is only available on School Vitals.",
    });
  }
  const days = insightRangeDayCount(range);
  const [snapshot, detail, rollups] = await Promise.all([
    loadSchoolVitalsSnapshot(tx, days),
    loadContentHealthDetail(tx),
    loadLearningRollupBundle(tx, days),
  ]);
  return buildInsightContentHealth(snapshot, detail, rollups, range);
}
