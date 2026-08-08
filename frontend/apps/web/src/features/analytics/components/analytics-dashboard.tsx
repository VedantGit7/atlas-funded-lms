"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AnalyticsDashboardResponse,
  AnalyticsFunnelResponse,
  AnalyticsItemStatisticsResponse,
} from "@atlas/domain/analytics/analytics.contract";
import type { ChartGranularity } from "../analytics-studio-shared";
import { metricsForTab, type AdminTab, latestMetricDay, resolveDrillDownRollupKey } from "../analytics-admin-utils";
import { fetchAnalyticsDashboard, fetchAnalyticsFunnel, fetchItemStatistics } from "../api";
import { AnalyticsAdminView } from "./analytics-admin-view";
import { AnalyticsDrillDownDialog } from "./analytics-drill-down-dialog";
import { AnalyticsDateRangeFilter } from "./analytics-date-range-filter";
import { AnalyticsMetricCard } from "./analytics-metric-card";
import { AnalyticsTrendTable } from "./analytics-trend-table";
import { FunnelStepList } from "./funnel-step-list";
import { ItemStatisticsTable } from "./item-statistics-table";

type AnalyticsDashboardProps = {
  mode: "admin" | "studio";
  canViewFunnel: boolean;
  initialCourses?: Array<{ id: string; title: string }>;
  initialAssessments?: Array<{ id: string; title: string }>;
};

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function aggregateMetricTotals(
  metrics: AnalyticsDashboardResponse["data"]["metrics"],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const metric of metrics) {
    totals.set(metric.rollupKey, (totals.get(metric.rollupKey) ?? 0) + metric.count);
  }
  return totals;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AnalyticsDashboard({
  mode,
  canViewFunnel,
  initialCourses = [],
  initialAssessments = [],
}: AnalyticsDashboardProps) {
  const initialRange = useMemo(() => defaultDateRange(), []);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [appliedRange, setAppliedRange] = useState(initialRange);
  const [adminTab, setAdminTab] = useState<AdminTab>("learning");
  const [chartGranularity, setChartGranularity] = useState<ChartGranularity>("weekly");
  const [courseId, setCourseId] = useState(initialCourses[0]?.id ?? "");
  const [assessmentId, setAssessmentId] = useState(initialAssessments[0]?.id ?? "");
  const [dashboard, setDashboard] = useState<AnalyticsDashboardResponse | null>(null);
  const [funnel, setFunnel] = useState<AnalyticsFunnelResponse | null>(null);
  const [itemStats, setItemStats] = useState<AnalyticsItemStatisticsResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "empty">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("Loading analytics.");
  const [drillDown, setDrillDown] = useState<{
    rollupKey: string;
    day: string;
    label: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    setStatus("loading");
    setLiveMessage("Loading analytics.");
    setErrorMessage(null);

    try {
      const dashboardKey = mode === "studio" ? "course.learning" : "tenant.learning";
      const dashboardResponse = await fetchAnalyticsDashboard({
        dashboardKey,
        ...(mode === "studio" && courseId ? { courseId } : {}),
        from: appliedRange.from,
        to: appliedRange.to,
      });

      let funnelResponse: AnalyticsFunnelResponse | null = null;
      if (mode === "admin" && canViewFunnel) {
        try {
          funnelResponse = await fetchAnalyticsFunnel({
            funnelKey: "learning.engagement",
            from: appliedRange.from,
            to: appliedRange.to,
          });
        } catch {
          funnelResponse = null;
        }
      }

      let itemStatsResponse: AnalyticsItemStatisticsResponse | null = null;
      if (assessmentId && (mode === "studio" || adminTab === "assessment")) {
        itemStatsResponse = await fetchItemStatistics({
          assessmentId,
          windowKey: "rolling_30d",
        });
      }

      setDashboard(dashboardResponse);
      setFunnel(funnelResponse);
      setItemStats(itemStatsResponse);
      setStatus(dashboardResponse.data.metrics.length === 0 ? "empty" : "ready");
      setLiveMessage(
        dashboardResponse.data.metrics.length === 0
          ? "No analytics data for the selected range."
          : "Analytics updated.",
      );
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to load analytics.");
      setLiveMessage("Analytics failed to load.");
    }
  }, [adminTab, appliedRange.from, appliedRange.to, assessmentId, canViewFunnel, courseId, mode]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const tabMetrics = useMemo(
    () => metricsForTab(dashboard?.data.metrics ?? [], adminTab),
    [adminTab, dashboard?.data.metrics],
  );

  const metricTotals = useMemo(() => aggregateMetricTotals(tabMetrics), [tabMetrics]);

  const funnelStages = useMemo(() => {
    if (!funnel?.data.days.length) {
      return [];
    }

    const totals = new Map<string, number>();
    for (const day of funnel.data.days) {
      for (const stage of day.stages) {
        totals.set(stage.stageKey, (totals.get(stage.stageKey) ?? 0) + stage.count);
      }
    }

    return [...totals.entries()].map(([stageKey, count]) => ({ stageKey, count }));
  }, [funnel?.data.days]);

  function exportCsv() {
    if (!dashboard) return;

    const rows: string[][] = [
      ["rollup_key", "period_start", "count"],
      ...tabMetrics.map((metric) => [metric.rollupKey, metric.periodStart, String(metric.count)]),
    ];
    downloadCsv(`analytics-${adminTab}-${dashboard.data.from}-${dashboard.data.to}.csv`, rows);
  }

  if (mode === "admin") {
    return (
      <>
        <AnalyticsAdminView
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          onApplyRange={() => {
            setAppliedRange({ from, to });
          }}
          adminTab={adminTab}
          onAdminTabChange={setAdminTab}
          chartGranularity={chartGranularity}
          onChartGranularityChange={setChartGranularity}
          dashboard={dashboard}
          funnel={funnel}
          itemStats={itemStats}
          assessmentId={assessmentId}
          onAssessmentChange={setAssessmentId}
          initialAssessments={initialAssessments}
          status={status}
          errorMessage={errorMessage}
          liveMessage={liveMessage}
          canViewFunnel={canViewFunnel}
          onExportCsv={exportCsv}
          exportDisabled={!dashboard || tabMetrics.length === 0}
          onMetricDrillDown={(metric) => {
            const rollupKey = resolveDrillDownRollupKey(metric.key);
            if (!rollupKey || !dashboard) return;
            setDrillDown({
              rollupKey,
              day: latestMetricDay(dashboard.data.metrics, rollupKey, appliedRange.to),
              label: metric.label,
            });
          }}
          onChartPointDrillDown={(point) => {
            setDrillDown({
              rollupKey: "lessons_completed",
              day: point.sortKey,
              label: "Lessons completed",
            });
          }}
        />
        <AnalyticsDrillDownDialog
          open={drillDown != null}
          rollupKey={drillDown?.rollupKey ?? ""}
          day={drillDown?.day ?? appliedRange.to}
          label={drillDown?.label}
          onClose={() => {
            setDrillDown(null);
          }}
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <p className="sr-only" aria-live="polite">
        {liveMessage}
      </p>

      <AnalyticsDateRangeFilter
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onApply={() => {
          setAppliedRange({ from, to });
        }}
        disabled={status === "loading"}
      />

      <label className="grid max-w-md gap-1 text-sm">
        <span>Course</span>
        <select
          value={courseId}
          onChange={(event) => {
            setCourseId(event.target.value);
          }}
          aria-label="Authorized course"
        >
          {initialCourses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </select>
      </label>

      {status === "loading" ? <p>Loading analytics…</p> : null}
      {status === "error" ? (
        <p role="alert" className="rounded border border-red-300 p-3">
          {errorMessage}
        </p>
      ) : null}

      {status === "empty" ? (
        <p>
          No analytics data yet. Activity will appear after learners complete lessons, assessments,
          practice, or community actions.
        </p>
      ) : null}

      {status === "ready" && dashboard ? (
        <>
          <section aria-labelledby="analytics-summary-heading" className="space-y-3">
            <h2 id="analytics-summary-heading" className="text-lg font-semibold">
              Summary
            </h2>
            <p className="text-sm text-neutral-700">
              {dashboard.data.summary.totalEvents.toLocaleString()} tracked events between{" "}
              {dashboard.data.from} and {dashboard.data.to}.
            </p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[...metricTotals.entries()].map(([rollupKey, count]) => (
                <AnalyticsMetricCard
                  key={rollupKey}
                  label={rollupKey.replaceAll("_", " ")}
                  value={count}
                />
              ))}
            </div>
          </section>

          <AnalyticsTrendTable
            caption="Daily metric trend table"
            rows={tabMetrics.map((metric) => ({
              rollupKey: metric.rollupKey,
              periodStart: metric.periodStart,
              count: metric.count,
            }))}
          />
        </>
      ) : null}

      {funnelStages.length > 0 ? (
        <FunnelStepList stages={funnelStages} title="Learning engagement funnel" />
      ) : null}

      <section aria-labelledby="item-statistics-heading" className="space-y-3">
        <h2 id="item-statistics-heading" className="text-lg font-semibold">
          Item performance
        </h2>
        <label className="grid max-w-md gap-1 text-sm">
          <span>Assessment</span>
          <select
            value={assessmentId}
            onChange={(event) => {
              setAssessmentId(event.target.value);
            }}
            aria-label="Authorized assessment"
          >
            {initialAssessments.map((assessment) => (
              <option key={assessment.id} value={assessment.id}>
                {assessment.title}
              </option>
            ))}
          </select>
        </label>
        <ItemStatisticsTable
          caption="Assessment item statistics"
          items={itemStats?.data.items ?? []}
        />
      </section>
    </div>
  );
}
