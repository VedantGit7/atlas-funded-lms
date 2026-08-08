"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, BarChart3 } from "lucide-react";
import type {
  AnalyticsDashboardResponse,
  AnalyticsItemStatisticsResponse,
} from "@atlas/domain/analytics/analytics.contract";
import { fetchAnalyticsDashboard, fetchItemStatistics } from "./api";
import {
  type ChartGranularity,
  computeStudioSummary,
  peakVolumeDays,
  submissionTrendPoints,
} from "./analytics-studio-shared";
import { AnalyticsFilterToolbar } from "./components/analytics-filter-toolbar";
import { AnalyticsAtRiskTable } from "./components/analytics-at-risk-table";
import { AnalyticsAtRiskRulesPanel } from "./components/analytics-at-risk-rules-panel";
import { AnalyticsItemBreakdownTable } from "./components/analytics-item-breakdown-table";
import { AnalyticsPeakDaysPanel } from "./components/analytics-peak-days-panel";
import { AnalyticsStudioStats } from "./components/analytics-studio-stats";
import { AnalyticsSubmissionsChart } from "./components/analytics-submissions-chart";

type CourseOption = { id: string; title: string };
type AssessmentOption = { id: string; title: string };

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
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

export function StudioAnalyticsClient({
  initialCourses = [],
  initialAssessments = [],
}: {
  initialCourses?: CourseOption[];
  initialAssessments?: AssessmentOption[];
}) {
  const initialRange = useMemo(() => defaultDateRange(), []);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [appliedRange, setAppliedRange] = useState(initialRange);
  const [courseId, setCourseId] = useState(initialCourses[0]?.id ?? "");
  const [assessmentId, setAssessmentId] = useState(initialAssessments[0]?.id ?? "");
  const [granularity, setGranularity] = useState<ChartGranularity>("daily");
  const [dashboard, setDashboard] = useState<AnalyticsDashboardResponse | null>(null);
  const [itemStats, setItemStats] = useState<AnalyticsItemStatisticsResponse | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("Loading analytics.");

  const selectedAssessmentTitle = useMemo(
    () => initialAssessments.find((assessment) => assessment.id === assessmentId)?.title,
    [assessmentId, initialAssessments],
  );

  const loadDashboard = useCallback(async () => {
    if (!courseId) {
      setDashboard(null);
      setStatusEmpty();
      return;
    }

    setLoadingDashboard(true);
    setErrorMessage(null);
    setLiveMessage("Loading analytics.");

    try {
      const dashboardResponse = await fetchAnalyticsDashboard({
        dashboardKey: "course.learning",
        courseId,
        from: appliedRange.from,
        to: appliedRange.to,
      });
      setDashboard(dashboardResponse);
      setLiveMessage(
        dashboardResponse.data.metrics.length === 0
          ? "No analytics data for the selected range."
          : "Analytics updated.",
      );
    } catch (error) {
      setDashboard(null);
      setErrorMessage(error instanceof Error ? error.message : "Failed to load analytics.");
      setLiveMessage("Analytics failed to load.");
    } finally {
      setLoadingDashboard(false);
    }
  }, [appliedRange.from, appliedRange.to, courseId]);

  const loadItemStats = useCallback(async () => {
    if (!assessmentId) {
      setItemStats(null);
      return;
    }

    setLoadingItems(true);
    try {
      const response = await fetchItemStatistics({
        assessmentId,
        windowKey: "rolling_30d",
      });
      setItemStats(response);
    } catch {
      setItemStats(null);
    } finally {
      setLoadingItems(false);
    }
  }, [assessmentId]);

  function setStatusEmpty() {
    setLiveMessage("Select a course to view analytics.");
  }

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    void loadItemStats();
  }, [loadItemStats]);

  const items = itemStats?.data.items ?? [];
  const summary = useMemo(
    () => computeStudioSummary(dashboard?.data.metrics ?? [], items),
    [dashboard?.data.metrics, items],
  );

  const chartPoints = useMemo(
    () => submissionTrendPoints(dashboard?.data.metrics ?? [], granularity),
    [dashboard?.data.metrics, granularity],
  );

  const peakDays = useMemo(
    () => peakVolumeDays(dashboard?.data.metrics ?? []),
    [dashboard?.data.metrics],
  );

  function exportPeakDaysCsv() {
    if (peakDays.length === 0) return;
    downloadCsv(`peak-days-${courseId}-${appliedRange.from}-${appliedRange.to}.csv`, [
      ["date", "submissions"],
      ...peakDays.map((day) => [day.sortKey, String(day.count)]),
    ]);
  }

  if (initialCourses.length === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <section
          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-14 text-center"
          aria-label="Studio analytics"
        >
          <BarChart3 className="mb-3 h-10 w-10 text-[var(--admin-on-surface-variant)] opacity-50" aria-hidden="true" />
          <h1 className="text-[22px] font-bold tracking-tight text-[var(--admin-on-surface)]">
            Studio Analytics
          </h1>
          <p className="mt-2 max-w-lg text-sm text-[var(--admin-on-surface-variant)]">
            Analytics appear once you author at least one course with learner activity.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <p className="sr-only" aria-live="polite">
        {liveMessage}
      </p>

      <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 shrink-0">
          <h1 className="text-[22px] font-bold tracking-tight text-[var(--admin-on-surface)]">
            Studio Analytics
          </h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
            Comprehensive oversight of course and assessment performance for programs you author.
          </p>
        </div>

        <AnalyticsFilterToolbar
          courses={initialCourses}
          assessments={initialAssessments}
          courseId={courseId}
          assessmentId={assessmentId}
          from={from}
          to={to}
          loading={loadingDashboard}
          onCourseChange={setCourseId}
          onAssessmentChange={setAssessmentId}
          onFromChange={setFrom}
          onToChange={setTo}
          onApply={() => {
            setAppliedRange({ from, to });
          }}
        />
      </header>

      {errorMessage ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <AnalyticsStudioStats
        metrics={summary}
        loading={loadingDashboard}
        hasAssessmentSelected={Boolean(assessmentId)}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AnalyticsSubmissionsChart
            points={chartPoints}
            granularity={granularity}
            onGranularityChange={setGranularity}
            loading={loadingDashboard}
          />
        </div>
        <AnalyticsPeakDaysPanel
          days={peakDays}
          onExport={exportPeakDaysCsv}
          loading={loadingDashboard}
        />
      </div>

      <AnalyticsItemBreakdownTable
        items={items}
        assessmentId={assessmentId}
        availableAssessments={initialAssessments.length}
        {...(selectedAssessmentTitle ? { assessmentTitle: selectedAssessmentTitle } : {})}
        loading={loadingItems}
      />

      <AnalyticsAtRiskRulesPanel />
      <AnalyticsAtRiskTable />
    </div>
  );
}
