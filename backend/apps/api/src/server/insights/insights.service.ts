import type { TenantTx } from "@atlas/db";
import { queryAnalyticsFunnel } from "@atlas/domain/analytics/analytics.service";
import type { InsightAlert, InsightWidget } from "./insights.schemas";
import type { NormalizedResult } from "../reports/reports.schemas";
import {
  loadInsightDashboardSnapshot,
  loadLearningRollupBundle,
  loadLiveDashboardSnapshot,
  loadMarketingInsightSnapshot,
  loadMessengerInsightSnapshot,
  loadSalesInsightSnapshot,
  loadSchoolVitalsSnapshot,
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

function kpiWidget(id: string, title: string, value: number): InsightWidget {
  return {
    id,
    title,
    defaultViz: "kpi",
    span: "third",
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

function buildDashboardAlerts(snapshot: InsightDashboardSnapshot): InsightAlert[] {
  const alerts: InsightAlert[] = [];
  const failed =
    snapshot.paymentStatusCounts.find((row) => row.status === "failed")?.count ?? 0;
  const pending =
    snapshot.pendingTasks.publishReviews +
    snapshot.pendingTasks.moderationCases +
    snapshot.pendingTasks.deletionRequests +
    snapshot.pendingTasks.courseReviews;

  if (failed > 0) {
    alerts.push({
      id: "failed-payments",
      severity: failed >= 10 ? "critical" : "warning",
      title: "Failed payments",
      message: `${failed} payment${failed === 1 ? "" : "s"} failed recently. Recover revenue from Reports → Payments.`,
      href: "/admin/reports/payments",
    });
  }

  if (pending > 0) {
    alerts.push({
      id: "pending-tasks",
      severity: "info",
      title: "Pending tasks",
      message: `${pending} open ops item${pending === 1 ? "" : "s"} (reviews, moderation, deletions, or course reviews).`,
      href: null,
    });
  }

  if (snapshot.upcomingLiveSessions.length > 0) {
    alerts.push({
      id: "upcoming-live",
      severity: "info",
      title: "Upcoming live classes",
      message: `${snapshot.upcomingLiveSessions.length} live session${snapshot.upcomingLiveSessions.length === 1 ? "" : "s"} scheduled or live.`,
      href: "/admin/live-sessions",
    });
  }

  return alerts;
}

function buildMainDashboardWidgets(
  snapshot: InsightDashboardSnapshot,
  learning: {
    lessonsCompleted: number;
    assessmentsSubmitted: number;
    activity: NormalizedResult;
  },
): InsightWidget[] {
  const revenueCents =
    snapshot.paidPaymentRevenueCents > 0
      ? snapshot.paidPaymentRevenueCents
      : snapshot.enrollmentValueCents;

  const widgets: InsightWidget[] = [
    kpiWidget("revenue", "Revenue", centsToMajor(revenueCents)),
    kpiWidget("products", "Products", snapshot.productCount),
    kpiWidget("learners", "Learners", snapshot.learnerCount),
    kpiWidget("current-mau", "Current MAU", snapshot.currentMau),
    kpiWidget("active-users-30d", "Active users (30d)", snapshot.activeUsers30d),
    kpiWidget("enrollments", "Active enrollments", snapshot.enrollmentCount),
    {
      id: "monthly-revenue",
      title: "Monthly revenue (12 months)",
      defaultViz: "line",
      span: "full",
      data: {
        columns: [
          { key: "period", label: "Period", kind: "date" },
          { key: "value", label: "Revenue", kind: "measure" },
        ],
        rows: snapshot.monthlyPaymentRevenue.map((row) => ({
          period: row.period,
          value: centsToMajor(row.amountCents),
        })),
        dimensions: ["period"],
        measures: ["value"],
      },
    },
    {
      id: "monthly-enrollments",
      title: "Monthly enrollments (paid vs free)",
      defaultViz: "bar",
      span: "full",
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
          { key: "students", label: "Learners", kind: "measure" },
          { key: "revenue", label: "Est. revenue", kind: "measure" },
        ],
        rows: snapshot.topProducts.map((row) => ({
          title: row.title,
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
      data: {
        columns: [
          { key: "learner", label: "Learner", kind: "string" },
          { key: "product", label: "Product", kind: "string" },
          { key: "amount", label: "Amount", kind: "measure" },
          { key: "created", label: "Created", kind: "date" },
        ],
        rows: snapshot.recentFailedPayments.map((row) => ({
          learner: row.learnerName,
          product: row.productTitle,
          amount: centsToMajor(row.amountCents),
          created: row.createdAt.slice(0, 10),
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

async function buildLearningWidgets(_tx: TenantTx, _ctx: InsightsCtx): Promise<{
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
  return Math.round((rollups.totals.assessments_passed / submitted) * 100);
}

function buildSchoolVitalsAlerts(
  snapshot: SchoolVitalsSnapshot,
  rollups: LearningRollupBundle,
): InsightAlert[] {
  const alerts: InsightAlert[] = [];
  const totalActivity = Object.values(rollups.totals).reduce((sum, value) => sum + value, 0);
  const passRate = assessmentPassRate(rollups);

  if (totalActivity === 0) {
    alerts.push({
      id: "no-learning-activity",
      severity: "info",
      title: "No learning activity",
      message: `No lessons, assessments, practice, or community events recorded in the last 30 days (${rollups.from} → ${rollups.to}).`,
      href: "/admin/analytics",
    });
  }

  if (snapshot.inactiveLearnerCount > 0) {
    alerts.push({
      id: "inactive-learners",
      severity: snapshot.inactiveLearnerCount >= 25 ? "warning" : "info",
      title: "Inactive learners",
      message: `${snapshot.inactiveLearnerCount} learner${snapshot.inactiveLearnerCount === 1 ? "" : "s"} inactive for 30+ days.`,
      href: "/admin/reports/resource-usage",
    });
  }

  if (snapshot.dormantCourseCount > 0) {
    alerts.push({
      id: "dormant-courses",
      severity: "info",
      title: "Dormant courses",
      message: `${snapshot.dormantCourseCount} published course${snapshot.dormantCourseCount === 1 ? "" : "s"} with no learner activity in 30 days.`,
      href: "/admin/reports/resource-usage",
    });
  }

  if (snapshot.openModerationCases > 0) {
    alerts.push({
      id: "open-moderation",
      severity: snapshot.openModerationCases >= 5 ? "warning" : "info",
      title: "Open moderation",
      message: `${snapshot.openModerationCases} moderation case${snapshot.openModerationCases === 1 ? "" : "s"} open or reviewing.`,
      href: "/admin/moderation/cases",
    });
  }

  if (rollups.totals.assessments_submitted >= 5 && passRate < 50) {
    alerts.push({
      id: "low-pass-rate",
      severity: "warning",
      title: "Low assessment pass rate",
      message: `Only ${passRate}% of assessments passed in the last 30 days. Review Progress & Score reports.`,
      href: "/admin/reports/progress-score",
    });
  }

  if (snapshot.upcomingLiveCount > 0) {
    alerts.push({
      id: "upcoming-live",
      severity: "info",
      title: "Upcoming live classes",
      message: `${snapshot.upcomingLiveCount} live session${snapshot.upcomingLiveCount === 1 ? "" : "s"} scheduled or live.`,
      href: "/admin/live-sessions",
    });
  }

  return alerts;
}

function buildSchoolVitalsWidgets(
  snapshot: SchoolVitalsSnapshot,
  rollups: LearningRollupBundle,
  funnelStages: Array<{ stage: string; count: number }>,
): InsightWidget[] {
  const passRate = assessmentPassRate(rollups);
  const widgets: InsightWidget[] = [
    kpiWidget("learners", "Learners", snapshot.learnerCount),
    kpiWidget("active-enrollments", "Active enrollments", snapshot.enrollmentCount),
    kpiWidget("current-mau", "Current MAU", snapshot.currentMau),
    kpiWidget("active-users-30d", "Active users (30d)", snapshot.activeUsers30d),
    kpiWidget("inactive-learners", "Inactive learners (30d+)", snapshot.inactiveLearnerCount),
    kpiWidget("assessment-pass-rate", "Assessment pass rate %", passRate),
  ];

  for (const def of ROLLUP_KPI_DEFS) {
    widgets.push(kpiWidget(def.id, def.title, rollups.totals[def.key]));
  }

  widgets.push(
    {
      id: "learning-activity",
      title: "Learning activity (30d)",
      defaultViz: "line",
      span: "full",
      data: periodSeriesResult(rollups.activitySeries, "Activity"),
    },
    {
      id: "lessons-trend",
      title: "Lessons completed (30d)",
      defaultViz: "line",
      span: "half",
      data: periodSeriesResult(rollups.seriesByKey.lessons_completed, "Lessons"),
    },
    {
      id: "assessments-trend",
      title: "Assessments submitted (30d)",
      defaultViz: "line",
      span: "half",
      data: periodSeriesResult(rollups.seriesByKey.assessments_submitted, "Assessments"),
    },
    {
      id: "daily-active-users",
      title: "Daily active users (30d)",
      defaultViz: "area",
      span: "full",
      data: periodSeriesResult(snapshot.dailyActiveUsers, "Active users"),
    },
    {
      id: "engagement-funnel",
      title: "Learning engagement funnel (30d)",
      defaultViz: "funnel",
      span: "half",
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
        ],
        rows: [
          { signal: "Dormant courses (30d)", count: snapshot.dormantCourseCount },
          { signal: "Inactive learners (30d+)", count: snapshot.inactiveLearnerCount },
          { signal: "Open moderation cases", count: snapshot.openModerationCases },
          { signal: "Upcoming live sessions", count: snapshot.upcomingLiveCount },
        ],
        dimensions: ["signal"],
        measures: ["count"],
      },
    },
    {
      id: "top-courses",
      title: "Top courses by learning (30d)",
      defaultViz: "table",
      span: "full",
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
    return Object.entries(FUNNEL_STAGE_LABELS).map(([_, stage]) => ({ stage, count: 0 }));
  }
}

function salesConversionRate(visited: number, enrolled: number): number {
  if (visited <= 0) return 0;
  return Math.round((enrolled / visited) * 100);
}

function buildSalesInsightAlerts(snapshot: SalesInsightSnapshot): InsightAlert[] {
  const alerts: InsightAlert[] = [];
  const conversion30d = salesConversionRate(
    snapshot.pipeline30d.visited,
    snapshot.pipeline30d.enrolled,
  );
  const upsellPool = snapshot.freeEnrollmentCount + snapshot.trialEnrollmentCount;

  if (snapshot.failedOrderCount > 0) {
    alerts.push({
      id: "failed-payments",
      severity: snapshot.failedOrderCount >= 10 ? "critical" : "warning",
      title: "Failed payments",
      message: `${snapshot.failedOrderCount} failed payment${snapshot.failedOrderCount === 1 ? "" : "s"} — recover revenue from Reports → Payments.`,
      href: "/admin/reports/payments",
    });
  }

  if (snapshot.pendingOrderCount > 0) {
    alerts.push({
      id: "pending-orders",
      severity: "info",
      title: "Pending orders",
      message: `${snapshot.pendingOrderCount} order${snapshot.pendingOrderCount === 1 ? "" : "s"} still pending or processing.`,
      href: "/admin/reports/payments",
    });
  }

  if (upsellPool > 0) {
    alerts.push({
      id: "trial-free-opportunity",
      severity: "info",
      title: "Upsell opportunity",
      message: `${upsellPool} free/trial enrollment${upsellPool === 1 ? "" : "s"} can convert to paid.`,
      href: "/admin/reports/sales-marketing",
    });
  }

  if (snapshot.pipeline30d.visited >= 10 && conversion30d < 5) {
    alerts.push({
      id: "low-conversion",
      severity: "warning",
      title: "Low conversion (30d)",
      message: `Only ${conversion30d}% of visits converted to enrollments in the last 30 days.`,
      href: "/admin/insights/marketing-insight",
    });
  }

  if (snapshot.revenue30dCents === 0 && snapshot.paidOrderCount === 0) {
    alerts.push({
      id: "no-revenue",
      severity: "info",
      title: "No paid revenue yet",
      message: "No paid orders recorded. Track pipeline visits and trial conversions to start monetizing.",
      href: "/admin/reports/sales-marketing",
    });
  }

  return alerts;
}

function buildSalesInsightWidgets(snapshot: SalesInsightSnapshot): InsightWidget[] {
  const conversionAll = salesConversionRate(snapshot.pipeline.visited, snapshot.pipeline.enrolled);
  const conversion30d = salesConversionRate(
    snapshot.pipeline30d.visited,
    snapshot.pipeline30d.enrolled,
  );
  const upsellPool = snapshot.freeEnrollmentCount + snapshot.trialEnrollmentCount;

  return [
    kpiWidget("revenue", "Total revenue", centsToMajor(snapshot.revenueCents)),
    kpiWidget("revenue-30d", "Revenue (30d)", centsToMajor(snapshot.revenue30dCents)),
    kpiWidget("paid-orders", "Paid orders", snapshot.paidOrderCount),
    kpiWidget("failed-orders", "Failed orders", snapshot.failedOrderCount),
    kpiWidget("products", "Products", snapshot.productCount),
    kpiWidget("learners", "Learners", snapshot.learnerCount),
    kpiWidget("paid-enrollments", "Paid enrollments", snapshot.paidEnrollmentCount),
    kpiWidget("trial-free-pool", "Trial + free pool", upsellPool),
    kpiWidget("conversion-rate", "Conversion rate %", conversionAll),
    kpiWidget("conversion-rate-30d", "Conversion rate % (30d)", conversion30d),
    kpiWidget("enrollments-30d", "Enrollments (30d)", snapshot.enrollments30d),
    kpiWidget("paid-enrollments-30d", "Paid enrollments (30d)", snapshot.paidEnrollments30d),
    {
      id: "monthly-revenue",
      title: "Monthly revenue (12 months)",
      defaultViz: "line",
      span: "full",
      data: {
        columns: [
          { key: "period", label: "Period", kind: "date" },
          { key: "value", label: "Revenue", kind: "measure" },
        ],
        rows: snapshot.monthlyPaymentRevenue.map((row) => ({
          period: row.period,
          value: centsToMajor(row.amountCents),
        })),
        dimensions: ["period"],
        measures: ["value"],
      },
    },
    {
      id: "pipeline",
      title: "Sales pipeline (all time)",
      defaultViz: "funnel",
      span: "half",
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
      data: {
        columns: [
          { key: "learner", label: "Learner", kind: "string" },
          { key: "product", label: "Product", kind: "string" },
          { key: "amount", label: "Amount", kind: "measure" },
          { key: "created", label: "Created", kind: "date" },
        ],
        rows: snapshot.recentFailedPayments.map((row) => ({
          learner: row.learnerName,
          product: row.productTitle,
          amount: centsToMajor(row.amountCents),
          created: row.createdAt.slice(0, 10),
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

function buildLiveDashboardAlerts(snapshot: LiveDashboardSnapshot): InsightAlert[] {
  const alerts: InsightAlert[] = [];

  if (snapshot.sessionCount === 0) {
    alerts.push({
      id: "no-live-sessions",
      severity: "info",
      title: "No live sessions yet",
      message: "Create and schedule live classes to track attendance and watch-time engagement.",
      href: "/admin/live-sessions",
    });
    return alerts;
  }

  if (snapshot.liveNowCount > 0) {
    alerts.push({
      id: "live-now",
      severity: "info",
      title: "Live now",
      message: `${snapshot.liveNowCount} session${snapshot.liveNowCount === 1 ? "" : "s"} currently live.`,
      href: "/admin/live-sessions",
    });
  }

  if (snapshot.upcomingCount > 0) {
    alerts.push({
      id: "upcoming-live",
      severity: "info",
      title: "Upcoming live classes",
      message: `${snapshot.upcomingCount} scheduled session${snapshot.upcomingCount === 1 ? "" : "s"} coming up.`,
      href: "/admin/live-sessions",
    });
  }

  if (snapshot.lowAttendanceSessions.length > 0) {
    alerts.push({
      id: "low-attendance",
      severity: "warning",
      title: "Low attendance sessions",
      message: `${snapshot.lowAttendanceSessions.length} ended session${snapshot.lowAttendanceSessions.length === 1 ? "" : "s"} below 50% attendance. Review Live Class Attendance reports.`,
      href: "/admin/reports/live-class-attendance",
    });
  }

  if (snapshot.sessions30d >= 3 && snapshot.attendanceRate30d > 0 && snapshot.attendanceRate30d < 40) {
    alerts.push({
      id: "weak-attendance-30d",
      severity: "warning",
      title: "Weak attendance (30d)",
      message: `Only ${snapshot.attendanceRate30d}% attendance across sessions in the last 30 days.`,
      href: "/admin/reports/live-class-attendance",
    });
  }

  return alerts;
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
    kpiWidget("avg-watch-minutes", "Avg watch (min)", formatDurationMinutes(snapshot.avgDurationSeconds)),
    kpiWidget("total-watch-hours", "Total watch (hrs)", Math.round((snapshot.totalWatchSeconds / 3600) * 10) / 10),
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

function buildMarketingInsightAlerts(snapshot: MarketingInsightSnapshot): InsightAlert[] {
  const alerts: InsightAlert[] = [];
  const hasAnyActivity =
    snapshot.attributionTotal > 0 ||
    snapshot.submissionCount > 0 ||
    snapshot.ctaClicks > 0 ||
    snapshot.workflowRunsTotal > 0 ||
    snapshot.couponRedemptions > 0;

  if (!hasAnyActivity) {
    alerts.push({
      id: "no-marketing-activity",
      severity: "info",
      title: "No marketing activity yet",
      message: "Publish forms, CTAs, workflows, or campaigns to start measuring lead generation.",
      href: "/admin/marketing",
    });
    return alerts;
  }

  if (snapshot.submissions30d === 0 && snapshot.liveFormCount > 0) {
    alerts.push({
      id: "no-form-submissions-30d",
      severity: "warning",
      title: "No form submissions (30d)",
      message: `${snapshot.liveFormCount} live form${snapshot.liveFormCount === 1 ? "" : "s"} but no submissions in the last 30 days.`,
      href: "/admin/marketing/forms",
    });
  }

  if (snapshot.liveCtaCount > 0 && snapshot.ctaViews >= 20) {
    const rate = ctaClickRate(snapshot.ctaViews, snapshot.ctaClicks);
    if (rate < 5) {
      alerts.push({
        id: "low-cta-click-rate",
        severity: "warning",
        title: "Low CTA click rate",
        message: `CTAs are averaging ${rate}% click-through. Review targeting and creative.`,
        href: "/admin/marketing/cta",
      });
    }
  }

  if (snapshot.workflowRunsFailed > 0) {
    alerts.push({
      id: "failed-workflow-runs",
      severity: snapshot.workflowRunsFailed >= 5 ? "warning" : "info",
      title: "Failed workflow runs",
      message: `${snapshot.workflowRunsFailed} workflow run${snapshot.workflowRunsFailed === 1 ? "" : "s"} failed.`,
      href: "/admin/marketing/workflows",
    });
  }

  if (snapshot.contacts30d > 0) {
    alerts.push({
      id: "new-contacts",
      severity: "info",
      title: "New contacts (30d)",
      message: `${snapshot.contacts30d} new contact${snapshot.contacts30d === 1 ? "" : "s"} from forms and CTAs.`,
      href: "/admin/marketing/forms/contacts",
    });
  }

  if (snapshot.couponRedemptions30d > 0) {
    alerts.push({
      id: "coupon-activity",
      severity: "info",
      title: "Coupon redemptions (30d)",
      message: `${snapshot.couponRedemptions30d} redemption${snapshot.couponRedemptions30d === 1 ? "" : "s"} in the last 30 days.`,
      href: "/admin/reports/sales-marketing",
    });
  }

  return alerts;
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

function buildMessengerInsightAlerts(snapshot: MessengerInsightSnapshot): InsightAlert[] {
  const alerts: InsightAlert[] = [];

  if (snapshot.totalOutboundSends === 0 && snapshot.inboxMessageCount === 0) {
    alerts.push({
      id: "no-messenger-activity",
      severity: "info",
      title: "No messenger activity yet",
      message: "Send marketing email, push, WhatsApp, or announcements to start tracking message performance.",
      href: "/admin/marketing/messenger",
    });
    return alerts;
  }

  if (!snapshot.whatsappConnected && snapshot.whatsappSentCount === 0) {
    alerts.push({
      id: "whatsapp-disconnected",
      severity: "info",
      title: "WhatsApp not connected",
      message: "Connect WhatsApp Business to send template campaigns and track delivery.",
      href: "/admin/marketing/messenger/whatsapp",
    });
  }

  if (snapshot.whatsappFailed > 0) {
    alerts.push({
      id: "whatsapp-failures",
      severity: snapshot.whatsappFailed >= 10 ? "warning" : "info",
      title: "WhatsApp delivery failures",
      message: `${snapshot.whatsappFailed} failed WhatsApp send${snapshot.whatsappFailed === 1 ? "" : "s"} across campaigns.`,
      href: "/admin/marketing/messenger/whatsapp",
    });
  }

  if (snapshot.emailScheduledCount + snapshot.pushScheduledCount + snapshot.whatsappScheduledCount > 0) {
    const scheduled =
      snapshot.emailScheduledCount +
      snapshot.pushScheduledCount +
      snapshot.whatsappScheduledCount;
    alerts.push({
      id: "scheduled-sends",
      severity: "info",
      title: "Scheduled messages",
      message: `${scheduled} campaign${scheduled === 1 ? "" : "s"} scheduled across email, push, or WhatsApp.`,
      href: "/admin/marketing/messenger",
    });
  }

  if (snapshot.openConversationCount > 0) {
    alerts.push({
      id: "open-inbox",
      severity: "info",
      title: "Open inbox conversations",
      message: `${snapshot.openConversationCount} open messenger conversation${snapshot.openConversationCount === 1 ? "" : "s"}.`,
      href: "/admin/marketing/messenger",
    });
  }

  if (snapshot.emailSentCount > 0 && snapshot.emailRecipients30d === 0) {
    alerts.push({
      id: "no-email-30d",
      severity: "info",
      title: "No email sends (30d)",
      message: "No marketing emails were sent in the last 30 days.",
      href: "/admin/marketing/messenger/email",
    });
  }

  return alerts;
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
    kpiWidget("scheduled-total", "Scheduled campaigns", snapshot.emailScheduledCount + snapshot.pushScheduledCount + snapshot.whatsappScheduledCount),
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

export async function getInsightDashboard(
  tx: TenantTx,
  ctx: InsightsCtx,
  slug: string,
): Promise<{
  slug: string;
  title: string;
  currency?: string;
  alerts: InsightAlert[];
  widgets: InsightWidget[];
}> {
  const title = SLUG_TITLES[slug] ?? slug.replace(/-/g, " ");

  if (slug === "dashboard") {
    const [snapshot, learning] = await Promise.all([
      loadInsightDashboardSnapshot(tx),
      buildLearningWidgets(tx, ctx),
    ]);

    return {
      slug,
      title,
      currency: snapshot.currency,
      alerts: buildDashboardAlerts(snapshot),
      widgets: buildMainDashboardWidgets(snapshot, learning),
    };
  }

  if (slug === "school-vitals") {
    const [snapshot, learning] = await Promise.all([
      loadSchoolVitalsSnapshot(tx),
      buildLearningWidgets(tx, ctx),
    ]);
    const funnelStages = await loadEngagementFunnelStages(
      tx,
      ctx,
      learning.rollups.from,
      learning.rollups.to,
    );

    return {
      slug,
      title,
      alerts: buildSchoolVitalsAlerts(snapshot, learning.rollups),
      widgets: buildSchoolVitalsWidgets(snapshot, learning.rollups, funnelStages),
    };
  }

  if (slug === "sales-insight") {
    const snapshot = await loadSalesInsightSnapshot(tx);
    return {
      slug,
      title,
      currency: snapshot.currency,
      alerts: buildSalesInsightAlerts(snapshot),
      widgets: buildSalesInsightWidgets(snapshot),
    };
  }

  if (slug === "live-dashboard") {
    const snapshot = await loadLiveDashboardSnapshot(tx);
    return {
      slug,
      title,
      alerts: buildLiveDashboardAlerts(snapshot),
      widgets: buildLiveDashboardWidgets(snapshot),
    };
  }

  if (slug === "marketing-insight") {
    const snapshot = await loadMarketingInsightSnapshot(tx);
    return {
      slug,
      title,
      alerts: buildMarketingInsightAlerts(snapshot),
      widgets: buildMarketingInsightWidgets(snapshot),
    };
  }

  if (slug === "messenger-insight") {
    const snapshot = await loadMessengerInsightSnapshot(tx);
    return {
      slug,
      title,
      alerts: buildMessengerInsightAlerts(snapshot),
      widgets: buildMessengerInsightWidgets(snapshot),
    };
  }

  return {
    slug,
    title,
    alerts: [],
    widgets: [emptyBarWidget(`${slug}-trend`, `${title} trend`)],
  };
}
