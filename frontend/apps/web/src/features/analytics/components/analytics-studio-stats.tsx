"use client";

import { AlertTriangle, CheckCircle2, FileText, Timer } from "lucide-react";
import type { StudioSummaryMetrics } from "../analytics-studio-shared";
import { statCardClassName, statLabelClassName } from "../analytics-studio-shared";

type AnalyticsStudioStatsProps = {
  metrics: StudioSummaryMetrics;
  loading?: boolean;
  hasAssessmentSelected: boolean;
};

function StatSkeleton() {
  return (
    <div className={`${statCardClassName} animate-pulse`}>
      <div className="h-3 w-24 rounded bg-[var(--admin-surface-high)]" />
      <div className="mt-3 h-8 w-20 rounded bg-[var(--admin-surface-high)]" />
    </div>
  );
}

export function AnalyticsStudioStats({
  metrics,
  loading = false,
  hasAssessmentSelected,
}: AnalyticsStudioStatsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <StatSkeleton key={index} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className={statCardClassName}>
        <div className="flex items-start justify-between gap-3">
          <span className={statLabelClassName}>Total submissions</span>
          <FileText className="h-4 w-4 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="text-3xl font-bold tracking-tight text-[var(--admin-on-surface)]">
            {metrics.totalSubmissions.toLocaleString()}
          </span>
        </div>
        <p className="mt-2 text-[11px] text-[var(--admin-on-surface-variant)]">
          Assessment attempts in the selected course and date range.
        </p>
      </div>

      <div className={statCardClassName}>
        <div className="flex items-start justify-between gap-3">
          <span className={statLabelClassName}>Avg. accuracy</span>
          <span
            className={`h-2 w-2 rounded-full ${
              metrics.avgAccuracy != null && metrics.avgAccuracy >= 75
                ? "bg-[var(--admin-success)] shadow-[0_0_8px_color-mix(in_srgb,var(--admin-success)_50%,transparent)]"
                : "bg-[var(--admin-on-surface-variant)]"
            }`}
            aria-hidden="true"
          />
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="text-3xl font-bold tracking-tight text-[var(--admin-on-surface)]">
            {metrics.avgAccuracy != null ? `${String(metrics.avgAccuracy)}%` : "—"}
          </span>
          {metrics.avgAccuracy != null && metrics.avgAccuracy >= 75 ? (
            <span className="inline-flex items-center gap-1 rounded bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight text-[var(--admin-success)]">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              Target met
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-[11px] text-[var(--admin-on-surface-variant)]">
          {hasAssessmentSelected
            ? "Mean item accuracy for the selected assessment (30-day window)."
            : "Select an assessment to compute item accuracy."}
        </p>
      </div>

      <div className={statCardClassName}>
        <div className="flex items-start justify-between gap-3">
          <span className={statLabelClassName}>Avg. latency</span>
          <span
            className={`h-2 w-2 rounded-full ${
              metrics.latencyHigh
                ? "bg-[var(--admin-warning)] shadow-[0_0_8px_color-mix(in_srgb,var(--admin-warning)_50%,transparent)]"
                : metrics.avgLatencySec != null
                  ? "bg-[var(--admin-success)]"
                  : "bg-[var(--admin-on-surface-variant)]"
            }`}
            aria-hidden="true"
          />
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="text-3xl font-bold tracking-tight text-[var(--admin-on-surface)]">
            {metrics.avgLatencySec != null ? `${String(metrics.avgLatencySec)}s` : "—"}
          </span>
          {metrics.latencyHigh ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--admin-warning)]">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              High
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-[11px] text-[var(--admin-on-surface-variant)]">
          {hasAssessmentSelected
            ? "Average response time across assessed items."
            : "Select an assessment to view latency."}
        </p>
      </div>

      <div className={statCardClassName}>
        <div className="flex items-start justify-between gap-3">
          <span className={statLabelClassName}>Pass rate</span>
          <Timer className="h-4 w-4 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="text-3xl font-bold tracking-tight text-[var(--admin-on-surface)]">
            {metrics.completionRate != null ? `${String(metrics.completionRate)}%` : "—"}
          </span>
          {metrics.completionRate != null ? (
            <span className="text-[11px] font-semibold text-[var(--admin-on-surface-variant)]">
              {metrics.passGoalMet ? "Above 90% goal" : "Below 90% goal"}
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-[11px] text-[var(--admin-on-surface-variant)]">
          Passed attempts divided by total submissions in this range.
        </p>
      </div>
    </div>
  );
}
