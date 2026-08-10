"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import {
  AlertCircle,
  ArrowLeftRight,
  BarChart3,
  Calendar,
  ChevronDown,
  Download,
} from "lucide-react";
import { primaryButtonClassName } from "../../analytics/analytics-admin-shared";
import {
  DropdownField,
  dropdownItemClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  dateInputToEndIso,
  dateInputToStartIso,
  exportSuperLiveInsightsReport,
  fetchSuperLiveInsightsTrends,
  type SuperLiveInsightsBreakDownBy,
  type SuperLiveInsightsGranularity,
  type SuperLiveInsightsTrendsData,
} from "./admin-super-live-insights-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";
import { SuperLiveInsightsModuleTabs } from "./SuperLiveInsightsModuleTabs";

type DatePreset = "7d" | "30d" | "90d" | "custom";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const fieldClassName =
  "h-9 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

function Shimmer({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      style={style}
      className={[
        "relative overflow-hidden rounded-sm bg-[var(--admin-surface-high)]",
        "motion-safe:after:absolute motion-safe:after:inset-0 motion-safe:after:-translate-x-full",
        "motion-safe:after:animate-[shimmer_1.8s_infinite]",
        "motion-safe:after:bg-gradient-to-r motion-safe:after:from-transparent",
        "motion-safe:after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] motion-safe:after:to-transparent",
        className ?? "",
      ].join(" ")}
    />
  );
}

function presetToRange(preset: DatePreset): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (preset === "7d") from.setDate(from.getDate() - 7);
  else if (preset === "30d") from.setDate(from.getDate() - 30);
  else if (preset === "90d") from.setDate(from.getDate() - 90);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "-";
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${String(hours)}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${String(minutes)}m ${String(secs).padStart(2, "0")}s`;
  return `${String(secs)}s`;
}

function formatRate(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function formatSignedPts(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} pts`;
}

function formatSignedInt(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString()}`;
}

function formatSignedDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "";
  const sign = seconds > 0 ? "+" : seconds < 0 ? "-" : "";
  return `${sign}${formatDuration(Math.abs(seconds))}`;
}

function deltaTone(value: number | null | undefined): "success" | "warning" | "muted" {
  if (value == null || value === 0) return "muted";
  return value > 0 ? "success" : "warning";
}

function rateTint(rate: number | null): string {
  if (rate == null) return "transparent";
  const clamped = Math.max(0, Math.min(100, rate));
  const alpha = 0.08 + (clamped / 100) * 0.42;
  return `color-mix(in srgb, var(--admin-primary) ${Math.round(alpha * 100)}%, transparent)`;
}

function DeltaBadge({
  value,
  format,
}: {
  value: number | null | undefined;
  format: "pts" | "int" | "duration";
}) {
  if (value == null) return null;
  const tone = deltaTone(value);
  const text =
    format === "pts"
      ? formatSignedPts(value)
      : format === "duration"
        ? formatSignedDuration(value)
        : formatSignedInt(value);
  const color =
    tone === "success"
      ? "text-[var(--admin-success)]"
      : tone === "warning"
        ? "text-[var(--admin-warning)]"
        : "text-[var(--admin-on-surface-variant)]";
  const wrap =
    tone === "warning"
      ? "border border-[color-mix(in_srgb,var(--admin-warning)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,transparent)] px-1.5 py-0.5"
      : "";
  return (
    <span
      className={["font-mono text-[11px] font-medium leading-3", color, wrap, "rounded"].join(" ")}
    >
      {format === "pts" && tone === "warning" ? `${text} vs previous` : text}
    </span>
  );
}

function MiniSparkline({ values }: { values: Array<number | null> }) {
  const points = values.filter((v): v is number => v != null);
  if (points.length < 2) {
    return <div className="h-6 w-16 rounded bg-[var(--admin-surface-low)]" aria-hidden="true" />;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(1, max - min);
  const coords = values
    .map((v, i) => {
      if (v == null) return null;
      const x = (i / Math.max(1, values.length - 1)) * 64;
      const y = 22 - ((v - min) / span) * 18;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");
  return (
    <svg width="64" height="24" viewBox="0 0 64 24" className="shrink-0" aria-hidden="true">
      <polyline fill="none" stroke="var(--admin-primary)" strokeWidth="1.5" points={coords} />
    </svg>
  );
}

export function AdminSuperLiveInsightsTrendsPage() {
  const datePresetLabelId = useId();
  const breakDownLabelId = useId();
  const initial = presetToRange("30d");
  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [breakDownOpen, setBreakDownOpen] = useState(false);
  const [startedFrom, setStartedFrom] = useState(initial.from);
  const [startedTo, setStartedTo] = useState(initial.to);
  const [granularity, setGranularity] = useState<SuperLiveInsightsGranularity>("week");
  const [breakDownBy, setBreakDownBy] = useState<SuperLiveInsightsBreakDownBy>("none");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SuperLiveInsightsTrendsData | null>(null);

  const applyPreset = useCallback((preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === "custom") return;
    const range = presetToRange(preset);
    setStartedFrom(range.from);
    setStartedTo(range.to);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fromIso = dateInputToStartIso(startedFrom);
      const toIso = dateInputToEndIso(startedTo);
      if (!fromIso || !toIso) throw new Error("Select a valid date range.");
      const response = await fetchSuperLiveInsightsTrends({
        startedFrom: fromIso,
        startedTo: toIso,
        granularity,
        breakDownBy,
      });
      setData(response.data);
    } catch (err) {
      const message =
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't load live session insights.";
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [breakDownBy, granularity, startedFrom, startedTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleExport = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const fromIso = dateInputToStartIso(startedFrom);
      const toIso = dateInputToEndIso(startedTo);
      const result = await exportSuperLiveInsightsReport({
        startedFrom: fromIso,
        startedTo: toIso,
        emailDownloadLink: true,
      });
      const completed = await pollReportRunUntilComplete(result.data.runId);
      if (completed.status === "failed") {
        throw new Error(completed.errorMessage ?? "Export failed.");
      }
      if (completed.status === "completed") {
        await downloadReportExport(completed.id, "csv");
      }
    } catch (exportError) {
      setError(
        exportError instanceof ClientApiError
          ? exportError.message
          : exportError instanceof Error
            ? exportError.message
            : "Export failed.",
      );
    } finally {
      setBusy(false);
    }
  }, [startedFrom, startedTo]);

  const empty = !loading && !error && (data?.summary.sessionCount ?? 0) === 0;
  const maxSessions = useMemo(
    () => Math.max(1, ...(data?.periods.map((p) => p.sessionCount) ?? [1])),
    [data],
  );

  const segmentLegend = useMemo(() => {
    if (!data || data.breakDownBy === "none") return [];
    const map = new Map<string, string>();
    for (const period of data.periods) {
      for (const seg of period.segments) map.set(seg.key, seg.label);
    }
    return [...map.entries()].map(([key, label]) => ({ key, label }));
  }, [data]);

  const datePresetLabel =
    datePreset === "7d"
      ? "Last 7 days"
      : datePreset === "30d"
        ? "Last 30 days"
        : datePreset === "90d"
          ? "Last 90 days"
          : "Custom range";

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
            Trends
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Attendance and engagement over time, sliced by course, batch, or day of week.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[180px]">
            <DropdownField
              label={<span className="sr-only">Date range</span>}
              labelId={datePresetLabelId}
              open={dateMenuOpen}
              onToggle={() => {
                setDateMenuOpen((open) => !open);
              }}
              triggerContent={
                <span className="flex w-full items-center gap-2 text-[13px] font-medium text-[var(--admin-on-surface)]">
                  <Calendar
                    className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
                    aria-hidden
                  />
                  <span className="flex-1 text-left">{datePresetLabel}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-[var(--admin-on-surface-variant)] transition-transform duration-200 ${dateMenuOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </span>
              }
              panelAriaLabel="Date range presets"
            >
              <div className="p-1.5" role="listbox">
                {(
                  [
                    ["7d", "Last 7 days"],
                    ["30d", "Last 30 days"],
                    ["90d", "Last 90 days"],
                    ["custom", "Custom range"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="option"
                    aria-selected={datePreset === value}
                    className={dropdownItemClassName}
                    onClick={() => {
                      applyPreset(value);
                      setDateMenuOpen(false);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </DropdownField>
          </div>

          <div className="flex h-9 overflow-hidden rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)]">
            {(["day", "week", "month"] as const).map((value, index) => {
              const selected = granularity === value;
              return (
                <button
                  key={value}
                  type="button"
                  className={[
                    "px-3 text-sm transition-colors",
                    index > 0 ? "border-l border-[var(--admin-border)]" : "",
                    selected
                      ? "bg-[var(--admin-surface-low)] font-medium text-[var(--admin-on-surface)] shadow-[inset_0_1px_2px_color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)]"
                      : "text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-low)]",
                  ].join(" ")}
                  onClick={() => {
                    setGranularity(value);
                  }}
                >
                  {value === "day" ? "Day" : value === "week" ? "Week" : "Month"}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={busy || loading}
            onClick={() => void handleExport()}
          >
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </button>

          <Link
            href="/admin/reports/super-live-insights/compare"
            className={primaryButtonClassName}
          >
            <ArrowLeftRight className="h-4 w-4" aria-hidden />
            Compare sessions
          </Link>
        </div>
      </div>

      {datePreset === "custom" ? (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
          <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
            From
            <input
              type="date"
              className={fieldClassName}
              value={startedFrom}
              onChange={(event) => {
                setStartedFrom(event.target.value);
              }}
            />
          </label>
          <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
            To
            <input
              type="date"
              className={fieldClassName}
              value={startedTo}
              onChange={(event) => {
                setStartedTo(event.target.value);
              }}
            />
          </label>
        </div>
      ) : null}

      <SuperLiveInsightsModuleTabs active="trends" />

      {error ? (
        <div className="relative">
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-danger)]">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
              <span>Couldn&apos;t load live session insights.</span>
            </div>
            <button
              type="button"
              className="text-sm font-bold text-[var(--admin-danger)] underline-offset-2 hover:underline"
              onClick={() => void load()}
            >
              Retry
            </button>
          </div>
          <div className="pointer-events-none mt-14 grid grid-cols-1 gap-4 opacity-30 md:grid-cols-3">
            <div className="h-24 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)]" />
            <div className="h-24 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)]" />
            <div className="h-24 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)]" />
            <div className="h-64 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] md:col-span-3" />
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] md:grid-cols-6">
            <div className="bg-[var(--admin-surface)] p-4 md:col-span-2">
              <Shimmer className="mb-3 h-3 w-24" />
              <Shimmer className="mb-3 h-8 w-32" />
              <Shimmer className="h-[3px] w-full" />
            </div>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-[var(--admin-surface)] p-4">
                <Shimmer className="mb-3 h-3 w-16" />
                <Shimmer className="h-7 w-20" />
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
            <Shimmer className="mb-4 h-4 w-48" />
            <div className="flex h-64 items-end gap-3">
              {[25, 45, 70, 50, 90, 60, 35].map((h, i) => (
                <div key={i} className="flex h-full w-full items-end">
                  <Shimmer className="w-full rounded-t" style={{ height: `${h}%` }} />
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[58%_42%]">
            <div className="h-56 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <Shimmer className="mb-4 h-4 w-40" />
              <Shimmer className="h-40 w-full" />
            </div>
            <div className="h-56 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <Shimmer className="mb-4 h-4 w-36" />
              <Shimmer className="h-40 w-full" />
            </div>
          </div>
        </div>
      ) : null}

      {!loading && !error && empty ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--admin-outline)] bg-[var(--admin-surface-low)] px-6 py-24 text-center">
          <BarChart3 className="mb-4 h-14 w-14 text-[var(--admin-outline)]" aria-hidden />
          <h2 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
            No sessions in this range
          </h2>
          <p className="mb-6 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
            There is no recorded live session data for the selected date range. Try adjusting your
            filters or selecting a wider timeframe.
          </p>
          <button
            type="button"
            className={primaryButtonClassName}
            onClick={() => {
              applyPreset("30d");
            }}
          >
            Reset date range
          </button>
        </div>
      ) : null}

      {!loading && !error && data && !empty ? (
        <>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] md:grid-cols-6">
            <div className="flex flex-col justify-center bg-[var(--admin-surface)] p-4 md:col-span-2">
              <span className="mb-1 text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                Attendance rate
              </span>
              <div className="mb-2 flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-[32px] leading-tight text-[var(--admin-on-surface)]">
                  {formatRate(data.summary.attendanceRate)}
                </span>
                <DeltaBadge value={data.summary.attendanceRateDeltaPts} format="pts" />
              </div>
              <div className="flex h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
                <div
                  className="h-full bg-[var(--admin-primary)]"
                  style={{
                    width: `${Math.max(0, Math.min(100, data.summary.attendanceRate ?? 0))}%`,
                  }}
                />
              </div>
            </div>
            <div className="flex flex-col justify-center bg-[var(--admin-surface)] p-4">
              <span className="mb-1 text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                Sessions
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl leading-tight text-[var(--admin-on-surface)]">
                  {data.summary.sessionCount.toLocaleString()}
                </span>
                <DeltaBadge value={data.summary.sessionCountDelta} format="int" />
              </div>
            </div>
            <div className="flex flex-col justify-center bg-[var(--admin-surface)] p-4">
              <span className="mb-1 text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                Total attended
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl leading-tight text-[var(--admin-on-surface)]">
                  {data.summary.totalAttended.toLocaleString()}
                </span>
                <DeltaBadge value={data.summary.totalAttendedDelta} format="int" />
              </div>
            </div>
            <div className="flex flex-col justify-center bg-[var(--admin-surface)] p-4">
              <span className="mb-1 text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                Average duration
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl leading-tight text-[var(--admin-on-surface)]">
                  {formatDuration(data.summary.avgDurationSeconds)}
                </span>
                <DeltaBadge value={data.summary.avgDurationSecondsDelta} format="duration" />
              </div>
            </div>
            <div className="flex flex-col justify-center bg-[var(--admin-surface)] p-4">
              <span className="mb-1 text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                Best {granularity}
              </span>
              {data.summary.bestPeriod ? (
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-[var(--admin-on-surface)]">
                    {data.summary.bestPeriod.label}
                  </span>
                  <span className="mt-1 font-mono text-sm text-[var(--admin-success)]">
                    {formatRate(data.summary.bestPeriod.attendanceRate)}
                  </span>
                </div>
              ) : (
                <span className="font-mono text-2xl text-[var(--admin-on-surface-variant)]">-</span>
              )}
            </div>
          </div>

          <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 md:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                Attendance rate over time
              </h2>
              <div className="min-w-[220px]">
                <DropdownField
                  label={<span className="sr-only">Break down by</span>}
                  labelId={breakDownLabelId}
                  open={breakDownOpen}
                  onToggle={() => {
                    setBreakDownOpen((open) => !open);
                  }}
                  triggerContent={
                    <span className="flex w-full items-center gap-2 text-[13px] font-medium text-[var(--admin-on-surface)]">
                      <span className="flex-1 text-left">
                        Break down by:{" "}
                        {breakDownBy === "none"
                          ? "None"
                          : breakDownBy === "course"
                            ? "Course"
                            : breakDownBy === "batch"
                              ? "Batch"
                              : "Session status"}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-[var(--admin-on-surface-variant)] transition-transform duration-200 ${breakDownOpen ? "rotate-180" : ""}`}
                        aria-hidden
                      />
                    </span>
                  }
                  panelAriaLabel="Break down chart by"
                >
                  <div className="p-1.5" role="listbox">
                    {(
                      [
                        ["none", "None"],
                        ["course", "Course"],
                        ["batch", "Batch"],
                        ["status", "Session status"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="option"
                        aria-selected={breakDownBy === value}
                        className={dropdownItemClassName}
                        onClick={() => {
                          setBreakDownBy(value);
                          setBreakDownOpen(false);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </DropdownField>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-[var(--admin-on-surface-variant)]">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-3 rounded-sm bg-[var(--admin-primary)]" /> Sessions held
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-0.5 w-4 border-t-2 border-[var(--admin-primary-strong)]" />{" "}
                Attendance rate
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-0 w-4 border-t border-dashed border-[var(--admin-outline)]" />{" "}
                Range average
              </span>
              {segmentLegend.map((seg, index) => (
                <span key={seg.key} className="inline-flex items-center gap-2">
                  <span
                    className="h-2 w-3 rounded-sm"
                    style={{
                      background: `color-mix(in srgb, var(--admin-primary) ${30 + index * 18}%, var(--admin-surface-high))`,
                    }}
                  />
                  {seg.label}
                </span>
              ))}
            </div>

            <div className="relative h-64">
              {data.rangeAverageRate != null ? (
                <div
                  className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[var(--admin-outline)]"
                  style={{ bottom: `${data.rangeAverageRate}%` }}
                  aria-hidden
                />
              ) : null}
              <div className="flex h-full items-end gap-1.5 md:gap-2">
                {data.periods.map((period) => {
                  const barH = period.hasSessions
                    ? Math.max(6, (period.sessionCount / maxSessions) * 100)
                    : 0;
                  const rateTop =
                    period.attendanceRate != null ? `${period.attendanceRate}%` : undefined;
                  return (
                    <div
                      key={period.key}
                      className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
                      title={`${period.label}: ${period.sessionCount} sessions, ${formatRate(period.attendanceRate)}`}
                    >
                      {period.hasSessions ? (
                        <>
                          {breakDownBy !== "none" && period.segments.length > 0 ? (
                            <div
                              className="flex w-full flex-col justify-end overflow-hidden rounded-t-sm"
                              style={{ height: `${barH}%` }}
                            >
                              {period.segments.map((seg, index) => {
                                const share =
                                  period.sessionCount > 0
                                    ? (seg.sessionCount / period.sessionCount) * 100
                                    : 0;
                                return (
                                  <div
                                    key={seg.key}
                                    style={{
                                      height: `${share}%`,
                                      background: `color-mix(in srgb, var(--admin-primary) ${28 + index * 16}%, var(--admin-surface-high))`,
                                    }}
                                  />
                                );
                              })}
                            </div>
                          ) : (
                            <div
                              className="w-full rounded-t-sm bg-[var(--admin-primary)] opacity-80"
                              style={{ height: `${barH}%` }}
                            />
                          )}
                          {rateTop ? (
                            <div
                              className="pointer-events-none absolute inset-x-0 h-0.5 bg-[var(--admin-primary-strong)]"
                              style={{ bottom: rateTop }}
                            />
                          ) : null}
                        </>
                      ) : (
                        <div className="mx-auto mb-0 h-2 w-2 rounded-full border border-[var(--admin-outline)] bg-transparent" />
                      )}
                      <span className="mt-2 truncate text-center font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                        {period.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            {data.largestMovement ? (
              <p className="mt-3 text-xs text-[var(--admin-on-surface-variant)]">
                {data.largestMovement.caption}
              </p>
            ) : null}
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[58%_42%]">
            <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 md:p-5">
              <h2 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">
                Composition over time
              </h2>
              <div className="flex h-48 items-end gap-1.5 md:gap-2">
                {data.periods.map((period) => {
                  const total = Math.max(1, period.totalCount);
                  const attended = (period.attendedCount / total) * 100;
                  const registered = (period.registeredCount / total) * 100;
                  const absent = (period.absentCount / total) * 100;
                  return (
                    <div key={period.key} className="flex min-w-0 flex-1 flex-col items-center">
                      {period.hasSessions && period.totalCount > 0 ? (
                        <div className="flex h-36 w-full flex-col justify-end overflow-hidden rounded-t-sm">
                          <div
                            className="bg-[var(--admin-primary)]"
                            style={{ height: `${attended}%` }}
                            title={`Attended ${period.attendedCount}`}
                          />
                          <div
                            className="bg-[var(--admin-warning)]"
                            style={{ height: `${registered}%` }}
                            title={`Registered ${period.registeredCount}`}
                          />
                          <div
                            className="bg-[var(--admin-danger)] opacity-70"
                            style={{ height: `${absent}%` }}
                            title={`Absent ${period.absentCount}`}
                          />
                        </div>
                      ) : (
                        <div className="h-36 w-full rounded-t-sm border border-dashed border-[var(--admin-border)]" />
                      )}
                      <span className="mt-1 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                        {period.totalCount}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--admin-on-surface-variant)]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-[var(--admin-primary)]" /> Attended
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-[var(--admin-warning)]" /> Registered
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-[var(--admin-danger)] opacity-70" /> Absent
                </span>
              </div>
              {data.compositionCaption ? (
                <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                  {data.compositionCaption}
                </p>
              ) : null}
            </section>

            <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 md:p-5">
              <h2 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">
                By day and time
              </h2>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[420px] border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="p-1 text-left font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                        Day
                      </th>
                      {data.dayTimeMatrix.bands.map((band) => (
                        <th
                          key={band}
                          className="p-1 text-center font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]"
                        >
                          {band}
                        </th>
                      ))}
                      <th className="p-1 text-center font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                        Avg
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.dayTimeMatrix.days.map((day, dayIndex) => (
                      <tr key={day}>
                        <td className="p-1 font-medium text-[var(--admin-on-surface)]">{day}</td>
                        {data.dayTimeMatrix.bands.map((_, bandIndex) => {
                          const cell = data.dayTimeMatrix.cells.find(
                            (c) => c.dayIndex === dayIndex && c.bandIndex === bandIndex,
                          );
                          return (
                            <td key={`${day}-${bandIndex}`} className="p-0.5">
                              <div
                                className="rounded px-1 py-2 text-center font-mono text-[var(--admin-on-surface)]"
                                style={{ background: rateTint(cell?.attendanceRate ?? null) }}
                              >
                                {cell && cell.sessionCount > 0
                                  ? formatRate(cell.attendanceRate)
                                  : "-"}
                              </div>
                            </td>
                          );
                        })}
                        <td className="p-1 text-center font-mono font-medium text-[var(--admin-on-surface)]">
                          {formatRate(data.dayTimeMatrix.dayAverages[dayIndex] ?? null)}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td className="p-1 font-semibold text-[var(--admin-on-surface-variant)]">
                        Avg
                      </td>
                      {data.dayTimeMatrix.bandAverages.map((avg, i) => (
                        <td key={i} className="p-1 text-center font-mono font-medium">
                          {formatRate(avg)}
                        </td>
                      ))}
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="space-y-2 md:hidden">
                <p className="text-xs font-medium text-[var(--admin-on-surface-variant)]">
                  Top and bottom slots
                </p>
                {[
                  ...data.dayTimeMatrix.slotsRanked.slice(0, 5),
                  ...data.dayTimeMatrix.slotsRanked.slice(-5).reverse(),
                ]
                  .filter(
                    (slot, index, all) =>
                      all.findIndex(
                        (s) => s.dayLabel === slot.dayLabel && s.bandLabel === slot.bandLabel,
                      ) === index,
                  )
                  .slice(0, 10)
                  .map((slot) => (
                    <div
                      key={`${slot.dayLabel}-${slot.bandLabel}`}
                      className="flex items-center justify-between rounded border border-[var(--admin-border)] px-3 py-2"
                    >
                      <span className="text-sm text-[var(--admin-on-surface)]">
                        {slot.dayLabel} · {slot.bandLabel}
                      </span>
                      <span className="font-mono text-sm">{formatRate(slot.attendanceRate)}</span>
                    </div>
                  ))}
              </div>
              {(data.dayTimeMatrix.bestSlotCaption || data.dayTimeMatrix.worstSlotCaption) && (
                <p className="mt-3 text-xs text-[var(--admin-on-surface-variant)]">
                  {[data.dayTimeMatrix.bestSlotCaption, data.dayTimeMatrix.worstSlotCaption]
                    .filter(Boolean)
                    .join(" ")}
                </p>
              )}
            </section>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[
              ["By course", data.byCourse, "courseId"] as const,
              ["By batch", data.byBatch, "batchId"] as const,
            ].map(([title, rows, filterKey]) => (
              <section
                key={title}
                className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 md:p-5"
              >
                <h2 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">
                  {title}
                </h2>
                {rows.length === 0 ? (
                  <p className="text-sm text-[var(--admin-on-surface-variant)]">
                    No data in range.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {rows.map((row) => (
                      <li key={row.id}>
                        <Link
                          href={`/admin/reports/super-live-insights?${filterKey}=${encodeURIComponent(row.id)}`}
                          className="block rounded-lg border border-transparent px-1 py-1 transition-colors hover:border-[var(--admin-border)] hover:bg-[var(--admin-surface-low)]"
                        >
                          <div className="mb-1 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-[var(--admin-on-surface)]">
                                {row.title}
                              </p>
                              <p className="text-xs text-[var(--admin-on-surface-variant)]">
                                {row.sessionCount} sessions
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <MiniSparkline values={row.sparkline} />
                              <div className="text-right">
                                <p className="font-mono text-sm text-[var(--admin-on-surface)]">
                                  {formatRate(row.attendanceRate)}
                                </p>
                                {row.deltaVsTenantPts != null ? (
                                  <p
                                    className={[
                                      "font-mono text-[11px]",
                                      deltaTone(row.deltaVsTenantPts) === "success"
                                        ? "text-[var(--admin-success)]"
                                        : deltaTone(row.deltaVsTenantPts) === "warning"
                                          ? "text-[var(--admin-warning)]"
                                          : "text-[var(--admin-on-surface-variant)]",
                                    ].join(" ")}
                                  >
                                    {formatSignedPts(row.deltaVsTenantPts)} vs avg
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
                            <div
                              className="h-full bg-[var(--admin-primary)]"
                              style={{
                                width: `${Math.max(0, Math.min(100, row.attendanceRate ?? 0))}%`,
                              }}
                            />
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <p className="text-center text-xs text-[var(--admin-on-surface-variant)]">
            Learner-level detail lives in{" "}
            <Link
              href="/admin/reports/live-class-attendance"
              className="font-medium text-[var(--admin-primary)] underline-offset-2 hover:underline"
            >
              Live Class Attendance
            </Link>
            .
          </p>
        </>
      ) : null}
    </div>
  );
}
