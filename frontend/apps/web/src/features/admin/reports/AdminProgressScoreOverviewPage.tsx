"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Download,
  BarChart3,
  RefreshCw,
  TrendingUp,
  Users,
  Clock3,
  TriangleAlert,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  fetchProgressScoreOverview,
  type ProgressScoreCompletionBand,
  type ProgressScoreOverview,
  type ProgressScoreOverviewWindow,
} from "./admin-progress-score-overview-api";
import { ProgressScoreReportTabs } from "./ProgressScoreReportTabs";

const WINDOW_OPTIONS: Array<{ value: ProgressScoreOverviewWindow; label: string }> = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

const selectTriggerClassName =
  "h-10 min-w-[160px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-sm bg-[var(--admin-surface-high)]",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.8s_infinite]",
        "after:bg-gradient-to-r after:from-transparent after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] after:to-transparent",
        className ?? "",
      ].join(" ")}
    />
  );
}

function formatPct(value: number | null): string {
  if (value == null) return "—";
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })}%`;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function bandFill(key: ProgressScoreCompletionBand["key"]): string {
  if (key === "complete") return "var(--admin-success)";
  if (key === "nearly_done")
    return "color-mix(in srgb, var(--admin-primary) 80%, var(--admin-success))";
  if (key === "in_progress") return "var(--admin-primary)";
  if (key === "early") return "color-mix(in srgb, var(--admin-primary) 55%, var(--admin-outline))";
  return "var(--admin-outline)";
}

function OverviewLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading progress overview">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="space-y-3">
          <Shimmer className="h-9 w-64" />
          <Shimmer className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex gap-3">
          <Shimmer className="h-10 w-36" />
          <Shimmer className="h-10 w-28" />
          <Shimmer className="h-10 w-36" />
        </div>
      </div>
      <div className="grid grid-cols-1 overflow-hidden rounded-sm border border-[var(--admin-border)] md:grid-cols-6 md:gap-px md:bg-[var(--admin-border)]">
        <div className="space-y-4 bg-[var(--admin-surface)] p-6 md:col-span-2">
          <Shimmer className="h-3 w-32" />
          <Shimmer className="h-8 w-24" />
          <Shimmer className="h-[3px] w-full" />
          <Shimmer className="h-3 w-40" />
        </div>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-4 bg-[var(--admin-surface)] p-6">
            <Shimmer className="h-3 w-28" />
            <Shimmer className="h-7 w-16" />
            <Shimmer className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
        <Shimmer className="mb-6 h-5 w-48" />
        <Shimmer className="h-8 w-full" />
        <div className="mt-4 flex gap-4">
          <Shimmer className="h-3 w-20" />
          <Shimmer className="h-3 w-16" />
          <Shimmer className="h-3 w-24" />
        </div>
      </div>
    </div>
  );
}

export function AdminProgressScoreOverviewPage() {
  const router = useRouter();
  const titleId = useId();
  const [windowKey, setWindowKey] = useState<ProgressScoreOverviewWindow>("30d");
  const [payload, setPayload] = useState<ProgressScoreOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchProgressScoreOverview({ window: windowKey });
      setPayload(response.data);
    } catch (loadError) {
      setPayload(null);
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Failed to load progress overview.",
      );
    } finally {
      setLoading(false);
    }
  }, [windowKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = payload?.summary;
  const empty = Boolean(payload?.empty);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8">
      <ProgressScoreReportTabs active="overview" />

      {error ? (
        <div className="flex flex-col gap-3 rounded-sm border border-[color-mix(in_srgb,var(--admin-danger)_40%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
            <p className="font-mono text-[13px] text-[var(--admin-on-surface)]">
              {error} Some metrics may be unavailable.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className={`${primaryButtonClassName} h-9 gap-2 bg-[var(--admin-warning)] text-[var(--admin-on-surface)] hover:brightness-110`}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : null}

      {loading && !payload ? (
        <OverviewLoadingSkeleton />
      ) : (
        <>
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <h1
                id={titleId}
                className="text-[28px] font-semibold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]"
              >
                Progress &amp; Score
              </h1>
              <p className="mt-2 text-base text-[var(--admin-on-surface-variant)]">
                Track completion and assessment results across courses, test series, bundles,
                subscriptions, and mock tests.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="sr-only" htmlFor="ps-overview-window">
                Date range
              </label>
              <div className="flex items-center gap-2">
                <CalendarDays
                  className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
                <Select
                  id="ps-overview-window"
                  value={windowKey}
                  onValueChange={(value) => {
                    setWindowKey(value as ProgressScoreOverviewWindow);
                  }}
                  options={WINDOW_OPTIONS}
                  className={selectTriggerClassName}
                />
              </div>
              <Link
                href="/admin/reports/progress-score/exports"
                className={`${ghostButtonClassName} inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] leading-none`}
              >
                <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
                Export
              </Link>
              <Link
                href="/admin/reports/progress-score/cohorts"
                className={`${primaryButtonClassName} inline-flex h-10 items-center justify-center gap-2 rounded-sm leading-none`}
              >
                <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
                Cohort actions
              </Link>
            </div>
          </div>

          {empty ? (
            <div className="relative flex min-h-[400px] flex-col items-center justify-center overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-8 py-16 text-center">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 2px 2px, var(--admin-on-surface) 1px, transparent 0)",
                  backgroundSize: "32px 32px",
                }}
                aria-hidden="true"
              />
              <BarChart3
                className="relative mb-6 h-16 w-16 text-[var(--admin-outline)] transition-colors"
                strokeWidth={1}
                aria-hidden="true"
              />
              <h2 className="relative text-xl font-semibold text-[var(--admin-on-surface)]">
                No enrolment activity in this range
              </h2>
              <p className="relative mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
                Adjust your date range or open Progress / Scores to inspect products once learners
                enrol.
              </p>
              <button
                type="button"
                onClick={() => {
                  setWindowKey("90d");
                }}
                className={`${primaryButtonClassName} relative mt-8 h-11 px-8`}
              >
                Widen to last 90 days
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 overflow-hidden rounded-sm border border-[var(--admin-border)] md:grid-cols-6 md:gap-px md:bg-[var(--admin-border)]">
                <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-6 transition-colors hover:bg-[var(--admin-surface-low)] md:col-span-2">
                  <p className="mb-4 font-mono text-[11px] font-medium tracking-[0.1em] text-[var(--admin-on-surface-variant)] uppercase">
                    Average completion
                  </p>
                  <div>
                    <p className="mb-3 font-mono text-[32px] leading-none font-bold text-[var(--admin-on-surface)]">
                      {formatPct(summary?.averageCompletionPct ?? null)}
                    </p>
                    <div className="mb-3 h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                      <div
                        className="h-full rounded-full bg-[var(--admin-primary)] transition-[width] duration-500"
                        style={{
                          width: `${Math.min(100, Math.max(0, summary?.averageCompletionPct ?? 0))}%`,
                        }}
                      />
                    </div>
                    {summary?.averageCompletionDeltaPoints != null ? (
                      <p
                        className={`flex items-center gap-1 font-mono text-[12px] ${
                          summary.averageCompletionDeltaPoints >= 0
                            ? "text-[var(--admin-success)]"
                            : "text-[var(--admin-danger)]"
                        }`}
                      >
                        <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                        {summary.averageCompletionDeltaPoints >= 0 ? "+" : ""}
                        {summary.averageCompletionDeltaPoints} points vs previous{" "}
                        {payload?.windowLabel.replace(/^Last /i, "").toLowerCase() ?? "period"}
                      </p>
                    ) : (
                      <p className="font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                        No prior window comparison
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-6 transition-colors hover:bg-[var(--admin-surface-low)]">
                  <p className="mb-4 font-mono text-[11px] font-medium tracking-[0.1em] text-[var(--admin-on-surface-variant)] uppercase">
                    Active enrolments
                  </p>
                  <p className="font-mono text-[28px] leading-none font-bold text-[var(--admin-on-surface)]">
                    {formatCount(summary?.activeEnrolmentCount ?? 0)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    router.push("/admin/reports/progress-score/progress");
                  }}
                  className="group relative flex flex-col justify-between bg-[var(--admin-surface)] p-6 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))]"
                >
                  <span className="pointer-events-none absolute inset-0 border-2 border-transparent transition-colors group-hover:border-[var(--admin-warning)]" />
                  <p className="mb-4 flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.1em] text-[var(--admin-warning)] uppercase">
                    <TriangleAlert className="h-4 w-4" aria-hidden="true" />
                    Learners at risk
                  </p>
                  <div>
                    <p className="mb-2 font-mono text-[28px] leading-none font-bold text-[var(--admin-warning)]">
                      {formatCount(summary?.learnersAtRiskCount ?? 0)}
                    </p>
                    <p className="font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                      no activity in {summary?.atRiskIdleDays ?? 14} days
                    </p>
                  </div>
                </button>

                <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-6 transition-colors hover:bg-[var(--admin-surface-low)]">
                  <p className="mb-4 font-mono text-[11px] font-medium tracking-[0.1em] text-[var(--admin-on-surface-variant)] uppercase">
                    Assessment pass rate
                  </p>
                  <div>
                    <p className="mb-2 font-mono text-[28px] leading-none font-bold text-[var(--admin-on-surface)]">
                      {formatPct(summary?.assessmentPassRatePct ?? null)}
                    </p>
                    <p className="font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                      {formatCount(summary?.assessmentAttemptCount ?? 0)} attempts
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    router.push("/admin/reports/progress-score/scores");
                  }}
                  className="flex flex-col justify-between bg-[var(--admin-surface)] p-6 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))]"
                >
                  <p className="mb-4 flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.1em] text-[var(--admin-warning)] uppercase">
                    <Clock3 className="h-4 w-4" aria-hidden="true" />
                    Awaiting grading
                  </p>
                  <p className="font-mono text-[28px] leading-none font-bold text-[var(--admin-warning)]">
                    {formatCount(summary?.awaitingGradingCount ?? 0)}
                  </p>
                </button>
              </div>

              {payload && payload.completionDistribution.some((band) => band.count > 0) ? (
                <section className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                      Completion distribution
                    </h2>
                    <Link
                      href="/admin/reports/progress-score/progress"
                      className="text-sm font-semibold text-[var(--admin-primary)] hover:underline"
                    >
                      Open progress
                    </Link>
                  </div>
                  <div className="flex h-8 w-full overflow-hidden rounded-sm bg-[var(--admin-surface-high)]">
                    {payload.completionDistribution.map((band) =>
                      band.sharePct > 0 ? (
                        <div
                          key={band.key}
                          title={`${band.label}: ${band.count} (${band.sharePct}%)`}
                          className="h-full transition-[width] duration-500"
                          style={{
                            width: `${band.sharePct}%`,
                            backgroundColor: bandFill(band.key),
                          }}
                        />
                      ) : null,
                    )}
                  </div>
                  <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                    {payload.completionDistribution.map((band) => (
                      <li
                        key={band.key}
                        className="flex items-center gap-2 font-mono text-[12px] text-[var(--admin-on-surface-variant)]"
                      >
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: bandFill(band.key) }}
                          aria-hidden="true"
                        />
                        {band.label}
                        <span className="text-[var(--admin-on-surface)]">
                          {formatCount(band.count)} · {band.sharePct}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
                  <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                    Progress reports
                  </h2>
                  <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
                    Drill by course, test series, bundle, or subscription to see learner completion.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["Course", "Test series", "Bundle", "Subscription"].map((label) => (
                      <span
                        key={label}
                        className="inline-flex h-6 items-center rounded-sm bg-[var(--admin-surface-high)] px-2 font-mono text-[11px] text-[var(--admin-on-surface-variant)] uppercase"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                  <Link
                    href="/admin/reports/progress-score/progress"
                    className={`${primaryButtonClassName} mt-6 inline-flex h-10`}
                  >
                    Open progress
                  </Link>
                </div>
                <div className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
                  <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                    Score reports
                  </h2>
                  <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
                    Review quiz and mock-test results, pass rates, and attempts awaiting grading.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["Course quiz", "Test series", "Bundle", "Mock test"].map((label) => (
                      <span
                        key={label}
                        className="inline-flex h-6 items-center rounded-sm bg-[var(--admin-surface-high)] px-2 font-mono text-[11px] text-[var(--admin-on-surface-variant)] uppercase"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                  <Link
                    href="/admin/reports/progress-score/scores"
                    className={`${primaryButtonClassName} mt-6 inline-flex h-10`}
                  >
                    Open scores
                  </Link>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
