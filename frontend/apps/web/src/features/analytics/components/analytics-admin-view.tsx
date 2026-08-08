"use client";

import { Download, GraduationCap, MessageSquare, Users } from "lucide-react";
import { EmptyState, Select, Skeleton } from "@atlas/design-system";
import type {
  AnalyticsDashboardResponse,
  AnalyticsFunnelResponse,
  AnalyticsItemStatisticsResponse,
} from "@atlas/domain/analytics/analytics.contract";
import type { ChartGranularity, TrendPoint } from "../analytics-studio-shared";
import {
  analyticsAlertErrorClassName,
  analyticsContentClassName,
  analyticsEmptyStateClassName,
  analyticsExportButtonClassName,
  analyticsMainClassName,
  analyticsTabButtonActiveClassName,
  analyticsTabButtonClassName,
  analyticsTabNavClassName,
  analyticsTableHeadClassName,
  analyticsTableRowClassName,
  analyticsTableShellClassName,
  analyticsTopBarClassName,
  analyticsWorkspaceClassName,
} from "../analytics-admin-shared";
import type { AdminTab } from "../analytics-admin-utils";
import {
  aggregateFunnelStages,
  buildFunnelStages,
  buildHeroMetrics,
  largestFunnelDrop,
  learningActivityTrendPoints,
  metricsForTab,
  type HeroMetric,
} from "../analytics-admin-utils";
import { AnalyticsAdminActivityChart } from "./analytics-admin-activity-chart";
import { AnalyticsAdminDateRange } from "./analytics-admin-date-range";
import { AnalyticsAdminFunnel } from "./analytics-admin-funnel";
import { AnalyticsAdminMetricCards } from "./analytics-admin-metric-cards";
import { ItemStatisticsTable } from "./item-statistics-table";

type AnalyticsAdminViewProps = {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onApplyRange: () => void;
  adminTab: AdminTab;
  onAdminTabChange: (tab: AdminTab) => void;
  chartGranularity: ChartGranularity;
  onChartGranularityChange: (value: ChartGranularity) => void;
  dashboard: AnalyticsDashboardResponse | null;
  funnel: AnalyticsFunnelResponse | null;
  itemStats: AnalyticsItemStatisticsResponse | null;
  assessmentId: string;
  onAssessmentChange: (value: string) => void;
  initialAssessments: Array<{ id: string; title: string }>;
  status: "loading" | "ready" | "error" | "empty";
  errorMessage: string | null;
  liveMessage: string;
  canViewFunnel: boolean;
  onExportCsv: () => void;
  exportDisabled: boolean;
  onMetricDrillDown?: ((metric: HeroMetric) => void) | undefined;
  onChartPointDrillDown?: ((point: TrendPoint) => void) | undefined;
};

const ADMIN_TABS: Array<{ id: AdminTab; label: string; icon: typeof GraduationCap }> = [
  { id: "learning", label: "Learning", icon: GraduationCap },
  { id: "community", label: "Community", icon: MessageSquare },
  { id: "assessment", label: "Assessment", icon: Users },
];

export function AnalyticsAdminView({
  from,
  to,
  onFromChange,
  onToChange,
  onApplyRange,
  adminTab,
  onAdminTabChange,
  chartGranularity,
  onChartGranularityChange,
  dashboard,
  funnel,
  itemStats,
  assessmentId,
  onAssessmentChange,
  initialAssessments,
  status,
  errorMessage,
  liveMessage,
  canViewFunnel,
  onExportCsv,
  exportDisabled,
  onMetricDrillDown,
  onChartPointDrillDown,
}: AnalyticsAdminViewProps) {
  const tabMetrics = metricsForTab(dashboard?.data.metrics ?? [], adminTab);
  const heroMetrics = buildHeroMetrics(tabMetrics, adminTab);
  const trendPoints = learningActivityTrendPoints(dashboard?.data.metrics ?? [], chartGranularity);
  const funnelStages = buildFunnelStages(
    funnel?.data.days ? aggregateFunnelStages(funnel.data.days) : [],
  );
  const funnelInsight = largestFunnelDrop(funnelStages);
  const loading = status === "loading";

  return (
    <div className={analyticsWorkspaceClassName}>
      <div className={analyticsMainClassName}>
        <header className={analyticsTopBarClassName}>
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-xl font-extrabold tracking-tight text-[var(--admin-primary)]">
              Analytics
            </h1>
            <AnalyticsAdminDateRange
              from={from}
              to={to}
              onFromChange={onFromChange}
              onToChange={onToChange}
              onApply={onApplyRange}
              disabled={loading}
            />
          </div>
          <button
            type="button"
            className={analyticsExportButtonClassName}
            disabled={exportDisabled}
            onClick={onExportCsv}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </button>
        </header>

        <div className={analyticsContentClassName}>
          <p className="sr-only" aria-live="polite">
            {liveMessage}
          </p>

          <nav className={analyticsTabNavClassName} role="tablist" aria-label="Analytics views">
            {ADMIN_TABS.map(({ id, label, icon: Icon }) => {
              const active = adminTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={
                    active ? analyticsTabButtonActiveClassName : analyticsTabButtonClassName
                  }
                  onClick={() => {
                    onAdminTabChange(id);
                  }}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </nav>

          <div className="mt-6 flex flex-col gap-6">
            {status === "error" ? (
              <p role="alert" className={analyticsAlertErrorClassName}>
                {errorMessage}
              </p>
            ) : null}

            {status === "empty" ? (
              <EmptyState
                className={analyticsEmptyStateClassName}
                title="No analytics data yet"
                description="Activity will appear after learners complete lessons, assessments, practice, or community actions."
              />
            ) : null}

            {loading ? (
              <div className="space-y-6" aria-hidden="true">
                <AnalyticsAdminMetricCards metrics={[]} loading />
                <Skeleton className="h-72 rounded-xl bg-[var(--admin-surface-high)]" />
              </div>
            ) : null}

            {status === "ready" && dashboard ? (
              <>
                <AnalyticsAdminMetricCards
                  metrics={heroMetrics}
                  onMetricClick={onMetricDrillDown}
                />

                {adminTab === "learning" ? (
                  <>
                    <AnalyticsAdminActivityChart
                      points={trendPoints}
                      granularity={chartGranularity}
                      onGranularityChange={onChartGranularityChange}
                      onPointClick={onChartPointDrillDown}
                    />
                    {canViewFunnel && funnelStages.length > 0 ? (
                      <AnalyticsAdminFunnel stages={funnelStages} insight={funnelInsight} />
                    ) : null}
                  </>
                ) : null}

                {adminTab === "community" && tabMetrics.length === 0 ? (
                  <EmptyState
                    className={analyticsEmptyStateClassName}
                    title="No community activity"
                    description="Community posts and moderation cases will appear here once learners engage."
                  />
                ) : null}

                {adminTab === "assessment" ? (
                  <section
                    aria-labelledby="item-statistics-heading"
                    className="space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:p-6"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <h2
                          id="item-statistics-heading"
                          className="text-lg font-semibold text-[var(--admin-on-surface)]"
                        >
                          Item performance
                        </h2>
                        <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                          Rolling 30-day accuracy and latency by assessment item
                        </p>
                      </div>
                      {initialAssessments.length > 0 ? (
                        <label className="grid min-w-[14rem] gap-1.5 text-sm">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                            Assessment
                          </span>
                          <Select
                            value={assessmentId}
                            onValueChange={onAssessmentChange}
                            options={initialAssessments.map((assessment) => ({
                              value: assessment.id,
                              label: assessment.title,
                            }))}
                            ariaLabel="Authorized assessment"
                          />
                        </label>
                      ) : null}
                    </div>

                    {initialAssessments.length === 0 ? (
                      <EmptyState
                        className={analyticsEmptyStateClassName}
                        title="No assessments available"
                        description="Create an assessment to review item-level performance."
                      />
                    ) : (
                      <div className={analyticsTableShellClassName}>
                        <ItemStatisticsTable
                          caption="Assessment item statistics"
                          items={itemStats?.data.items ?? []}
                          headClassName={analyticsTableHeadClassName}
                          rowClassName={analyticsTableRowClassName}
                        />
                      </div>
                    )}
                  </section>
                ) : null}

                <p className="text-sm text-[var(--admin-on-surface-variant)]">
                  {dashboard.data.summary.totalEvents.toLocaleString()} tracked events between{" "}
                  {dashboard.data.from} and {dashboard.data.to}.
                </p>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
