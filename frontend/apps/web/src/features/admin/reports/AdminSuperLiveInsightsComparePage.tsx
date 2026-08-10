"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import {
  AlertCircle,
  ArrowLeftRight,
  Check,
  ChevronDown,
  Download,
  Plus,
  Save,
  X,
} from "lucide-react";
import { primaryButtonClassName } from "../../analytics/analytics-admin-shared";
import {
  DropdownField,
  dropdownItemClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  fetchSuperLiveInsightsCompare,
  fetchSuperLiveInsightsCompareCandidates,
  type SuperLiveInsightsCompareCandidate,
  type SuperLiveInsightsCompareData,
  type SuperLiveInsightsCompareItem,
  type SuperLiveInsightsCompareMode,
  type SuperLiveInsightsSeriesKind,
} from "./admin-super-live-insights-roster-api";
import { SuperLiveInsightsModuleTabs } from "./SuperLiveInsightsModuleTabs";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const SAVE_KEY = "atlas.super-live-insights.compare.v1";

type MetricKey =
  | "sessionsHeld"
  | "totalRecords"
  | "attendedCount"
  | "registeredCount"
  | "absentCount"
  | "attendanceRate"
  | "composition"
  | "avgDurationSeconds"
  | "sessionDurationSeconds"
  | "coveragePct"
  | "startDelaySeconds"
  | "scheduledSlot"
  | "distribution";

const METRIC_OPTIONS: Array<{
  key: MetricKey;
  label: string;
  sessionsOnly?: boolean;
  seriesOnly?: boolean;
}> = [
  { key: "sessionsHeld", label: "Sessions held", seriesOnly: true },
  { key: "totalRecords", label: "Total records" },
  { key: "attendedCount", label: "Attended" },
  { key: "registeredCount", label: "Registered" },
  { key: "absentCount", label: "Absent" },
  { key: "attendanceRate", label: "Attendance rate" },
  { key: "composition", label: "Composition" },
  { key: "avgDurationSeconds", label: "Average duration" },
  { key: "sessionDurationSeconds", label: "Session duration" },
  { key: "coveragePct", label: "Coverage" },
  { key: "startDelaySeconds", label: "Start delay" },
  { key: "scheduledSlot", label: "Scheduled slot", sessionsOnly: true },
  { key: "distribution", label: "Coverage distribution" },
];

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

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "-";
  const total = Math.max(0, Math.floor(Math.abs(seconds)));
  const sign = seconds < 0 ? "-" : "";
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${sign}${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${sign}${minutes}m ${String(secs).padStart(2, "0")}s`;
  return `${sign}${secs}s`;
}

function formatRate(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function formatCount(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return value.toLocaleString();
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function swatch(colorIndex: number): string {
  const strength = [100, 72, 48, 30][Math.min(3, Math.max(0, colorIndex))] ?? 100;
  return `color-mix(in srgb, var(--admin-primary) ${strength}%, var(--admin-surface-high))`;
}

function metricValue(item: SuperLiveInsightsCompareItem, key: MetricKey): number | string | null {
  const m = item.metrics;
  switch (key) {
    case "sessionsHeld":
      return m.sessionsHeld;
    case "totalRecords":
      return m.totalRecords;
    case "attendedCount":
      return m.attendedCount;
    case "registeredCount":
      return m.registeredCount;
    case "absentCount":
      return m.absentCount;
    case "attendanceRate":
      return m.attendanceRate;
    case "avgDurationSeconds":
      return m.avgDurationSeconds;
    case "sessionDurationSeconds":
      return m.sessionDurationSeconds;
    case "coveragePct":
      return m.coveragePct;
    case "startDelaySeconds":
      return m.startDelaySeconds;
    case "scheduledSlot":
      return m.scheduledSlot;
    case "composition":
    case "distribution":
      return null;
  }
}

function formatMetric(key: MetricKey, value: number | string | null): string {
  if (value == null) return "-";
  if (typeof value === "string") return value;
  if (key === "attendanceRate" || key === "coveragePct") {
    return formatRate(value);
  }
  if (
    key === "avgDurationSeconds" ||
    key === "sessionDurationSeconds" ||
    key === "startDelaySeconds"
  ) {
    return formatDuration(value);
  }
  return formatCount(value);
}

function numericForBest(key: MetricKey, value: number | string | null): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  if (key === "startDelaySeconds") return -Math.abs(value);
  if (key === "registeredCount" || key === "absentCount") return -value;
  return value;
}

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ].slice(0, 4);
}

export function AdminSuperLiveInsightsComparePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const metricsLabelId = useId();
  const addLabelId = useId();

  const initialMode = searchParams.get("mode") === "series" ? "series" : "sessions";
  const initialKind = searchParams.get("seriesKind") === "batch" ? "batch" : "course";
  const initialIds = parseIds(searchParams.get("ids"));

  const [mode, setMode] = useState<SuperLiveInsightsCompareMode>(initialMode);
  const [seriesKind, setSeriesKind] = useState<SuperLiveInsightsSeriesKind>(initialKind);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds);
  const [selectedMeta, setSelectedMeta] = useState<
    Record<string, { title: string; subtitle: string | null; scheduledAt: string | null }>
  >({});
  const [visibleMetrics, setVisibleMetrics] = useState<Set<MetricKey>>(
    () => new Set(METRIC_OPTIONS.map((m) => m.key)),
  );
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [candidateQ, setCandidateQ] = useState("");
  const [candidates, setCandidates] = useState<SuperLiveInsightsCompareCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SuperLiveInsightsCompareData | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const syncUrl = useCallback(
    (
      nextIds: string[],
      nextMode: SuperLiveInsightsCompareMode,
      nextKind: SuperLiveInsightsSeriesKind,
    ) => {
      const params = new URLSearchParams();
      params.set("mode", nextMode);
      if (nextMode === "series") params.set("seriesKind", nextKind);
      if (nextIds.length > 0) params.set("ids", nextIds.join(","));
      router.replace(`/admin/reports/super-live-insights/compare?${params.toString()}`);
    },
    [router],
  );

  useEffect(() => {
    const ids = parseIds(searchParams.get("ids"));
    const nextMode = searchParams.get("mode") === "series" ? "series" : "sessions";
    const nextKind = searchParams.get("seriesKind") === "batch" ? "batch" : "course";
    setSelectedIds(ids);
    setMode(nextMode);
    setSeriesKind(nextKind);
  }, [searchParams]);

  const loadCompare = useCallback(async () => {
    if (selectedIds.length < 2) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetchSuperLiveInsightsCompare({
        mode,
        ids: selectedIds,
        ...(mode === "series" ? { seriesKind } : {}),
      });
      setData(response.data);
      setSelectedMeta((prev) => {
        const next = { ...prev };
        for (const item of response.data.items) {
          next[item.id] = {
            title: item.title,
            subtitle: item.subtitle,
            scheduledAt: item.scheduledAt,
          };
        }
        return next;
      });
    } catch (err) {
      setData(null);
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't load comparison.",
      );
    } finally {
      setLoading(false);
    }
  }, [mode, selectedIds, seriesKind]);

  useEffect(() => {
    void loadCompare();
  }, [loadCompare]);

  const loadCandidates = useCallback(async () => {
    setLoadingCandidates(true);
    try {
      const response = await fetchSuperLiveInsightsCompareCandidates({
        mode,
        ...(mode === "series" ? { seriesKind } : {}),
        ...(candidateQ.trim() ? { q: candidateQ.trim() } : {}),
        excludeIds: selectedIds,
      });
      setCandidates(response.data.items);
    } catch {
      setCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  }, [candidateQ, mode, selectedIds, seriesKind]);

  useEffect(() => {
    if (!addOpen) return;
    const handle = window.setTimeout(() => {
      void loadCandidates();
    }, 180);
    return () => {
      window.clearTimeout(handle);
    };
  }, [addOpen, loadCandidates]);

  function setIds(next: string[]) {
    setSelectedIds(next);
    syncUrl(next, mode, seriesKind);
  }

  function switchMode(next: SuperLiveInsightsCompareMode) {
    setMode(next);
    setSelectedIds([]);
    setData(null);
    syncUrl([], next, seriesKind);
  }

  function addItem(candidate: SuperLiveInsightsCompareCandidate) {
    if (selectedIds.includes(candidate.id) || selectedIds.length >= 4) return;
    const next = [...selectedIds, candidate.id];
    setSelectedMeta((prev) => ({
      ...prev,
      [candidate.id]: {
        title: candidate.title,
        subtitle:
          candidate.subtitle ??
          (candidate.sessionCount != null ? `${candidate.sessionCount} sessions` : null),
        scheduledAt: candidate.scheduledAt,
      },
    }));
    setIds(next);
    setAddOpen(false);
    setCandidateQ("");
  }

  function removeItem(id: string) {
    setIds(selectedIds.filter((item) => item !== id));
    setSelectedMeta((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([key]) => key !== id)),
    );
  }

  function handleExport() {
    if (!data || data.items.length < 2) return;
    const headers = ["Metric", ...data.items.map((item) => item.title)];
    const rows: string[][] = [];
    for (const option of METRIC_OPTIONS) {
      if (option.key === "composition" || option.key === "distribution") continue;
      if (option.seriesOnly && mode !== "series") continue;
      if (option.sessionsOnly && mode !== "sessions") continue;
      if (!visibleMetrics.has(option.key)) continue;
      rows.push([
        option.label,
        ...data.items.map((item) => formatMetric(option.key, metricValue(item, option.key))),
      ]);
    }
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `super-live-insights-compare-${mode}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handleSave() {
    const payload = {
      mode,
      seriesKind,
      ids: selectedIds,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    setSavedFlash(true);
    window.setTimeout(() => {
      setSavedFlash(false);
    }, 1600);
  }

  const activeMetrics = METRIC_OPTIONS.filter((option) => {
    if (option.seriesOnly && mode !== "series") return false;
    if (option.sessionsOnly && mode !== "sessions") return false;
    return visibleMetrics.has(option.key);
  });

  const empty = selectedIds.length < 2;
  const items = data?.items ?? [];

  const groupedCandidates = useMemo(() => {
    if (mode === "series") {
      return [{ label: seriesKind === "course" ? "Courses" : "Batches", items: candidates }];
    }
    const map = new Map<string, SuperLiveInsightsCompareCandidate[]>();
    for (const item of candidates) {
      const key = item.groupLabel ?? "Other";
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()].map(([label, groupItems]) => ({ label, items: groupItems }));
  }, [candidates, mode, seriesKind]);

  const maxTrendLen = Math.max(0, ...items.map((item) => item.trend?.length ?? 0));

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
            Compare
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Set sessions or series against each other on the same measures.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-9 overflow-hidden rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] p-0.5">
            {(["sessions", "series"] as const).map((value) => {
              const selected = mode === value;
              return (
                <button
                  key={value}
                  type="button"
                  className={[
                    "rounded-md px-4 text-sm transition-colors",
                    selected
                      ? "bg-[var(--admin-surface)] font-semibold text-[var(--admin-on-surface)] shadow-sm"
                      : "font-medium text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                  ].join(" ")}
                  onClick={() => {
                    switchMode(value);
                  }}
                >
                  {value === "sessions" ? "Sessions" : "Series"}
                </button>
              );
            })}
          </div>
          {mode === "series" ? (
            <div className="flex h-9 overflow-hidden rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)]">
              {(["course", "batch"] as const).map((value, index) => {
                const selected = seriesKind === value;
                return (
                  <button
                    key={value}
                    type="button"
                    className={[
                      "px-3 text-sm transition-colors",
                      index > 0 ? "border-l border-[var(--admin-border)]" : "",
                      selected
                        ? "bg-[var(--admin-surface-low)] font-medium text-[var(--admin-on-surface)]"
                        : "text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-low)]",
                    ].join(" ")}
                    onClick={() => {
                      setSeriesKind(value);
                      setSelectedIds([]);
                      setData(null);
                      syncUrl([], mode, value);
                    }}
                  >
                    {value === "course" ? "Course" : "Batch"}
                  </button>
                );
              })}
            </div>
          ) : null}
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={empty || !data}
            onClick={handleExport}
          >
            <Download className="h-4 w-4" aria-hidden />
            Export comparison
          </button>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={empty}
            onClick={handleSave}
          >
            <Save className="h-4 w-4" aria-hidden />
            {savedFlash ? "Saved" : "Save comparison"}
          </button>
        </div>
      </div>

      <SuperLiveInsightsModuleTabs active="compare" />

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
        {selectedIds.map((id, index) => {
          const fromData = items.find((item) => item.id === id);
          const meta = fromData
            ? {
                title: fromData.title,
                subtitle: fromData.subtitle,
                scheduledAt: fromData.scheduledAt,
                colorIndex: fromData.colorIndex,
              }
            : {
                title: selectedMeta[id]?.title ?? id.slice(0, 8),
                subtitle: selectedMeta[id]?.subtitle ?? null,
                scheduledAt: selectedMeta[id]?.scheduledAt ?? null,
                colorIndex: index,
              };
          return (
            <div
              key={id}
              className="flex h-12 min-w-[220px] max-w-[320px] items-stretch overflow-hidden rounded-md border border-[var(--admin-outline)] bg-[var(--admin-surface)] shadow-sm"
            >
              <div className="w-1.5 shrink-0" style={{ background: swatch(meta.colorIndex) }} />
              <div className="flex min-w-0 flex-1 flex-col justify-center border-r border-[var(--admin-border)] px-3">
                <span className="truncate text-xs font-semibold text-[var(--admin-on-surface)]">
                  {meta.title}
                </span>
                <span className="truncate text-[10px] text-[var(--admin-on-surface-variant)]">
                  {meta.subtitle ?? formatDate(meta.scheduledAt)}
                </span>
              </div>
              <div className="flex items-center gap-1 px-2">
                {mode === "sessions" ? (
                  <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                    {formatDate(meta.scheduledAt)}
                  </span>
                ) : null}
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-low)] hover:text-[var(--admin-danger)]"
                  aria-label={`Remove ${meta.title}`}
                  onClick={() => {
                    removeItem(id);
                  }}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </div>
          );
        })}

        {selectedIds.length < 4 ? (
          <div className="relative">
            <DropdownField
              label={
                <span className="sr-only">Add {mode === "series" ? "series" : "session"}</span>
              }
              labelId={addLabelId}
              open={addOpen}
              onToggle={() => {
                setAddOpen((open) => !open);
              }}
              triggerContent={
                <span className="flex h-12 items-center gap-2 px-4 text-sm font-medium text-[var(--admin-on-surface-variant)]">
                  <Plus className="h-4 w-4" aria-hidden />
                  Add {mode === "series" ? "series" : "session"}
                </span>
              }
              panelAriaLabel={mode === "series" ? "Add series" : "Add session"}
            >
              <div className="flex max-h-80 w-[340px] flex-col">
                <div className="border-b border-[var(--admin-border)] p-2">
                  <input
                    type="search"
                    value={candidateQ}
                    onChange={(event) => {
                      setCandidateQ(event.target.value);
                    }}
                    placeholder={mode === "series" ? "Search series…" : "Search sessions…"}
                    className="h-9 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none"
                  />
                </div>
                <div className="overflow-y-auto p-1.5">
                  {loadingCandidates ? (
                    <p className="px-3 py-4 text-sm text-[var(--admin-on-surface-variant)]">
                      Loading…
                    </p>
                  ) : candidates.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-[var(--admin-on-surface-variant)]">
                      No matches.
                    </p>
                  ) : (
                    groupedCandidates.map((group) => (
                      <div key={group.label} className="mb-2">
                        <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                          {group.label}
                        </p>
                        {group.items.map((candidate) => (
                          <button
                            key={candidate.id}
                            type="button"
                            role="option"
                            className={`${dropdownItemClassName} flex w-full items-center justify-between gap-3`}
                            onClick={() => {
                              addItem(candidate);
                            }}
                          >
                            <span className="min-w-0 text-left">
                              <span className="block truncate text-sm font-medium">
                                {candidate.title}
                              </span>
                              <span className="block truncate text-xs text-[var(--admin-on-surface-variant)]">
                                {candidate.subtitle ??
                                  (candidate.sessionCount != null
                                    ? `${candidate.sessionCount} sessions`
                                    : formatDate(candidate.scheduledAt))}
                              </span>
                            </span>
                            <span className="shrink-0 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                              {formatRate(candidate.attendanceRate)}
                            </span>
                          </button>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </DropdownField>
          </div>
        ) : null}

        <div className="ml-auto">
          <DropdownField
            label={<span className="sr-only">Show metrics</span>}
            labelId={metricsLabelId}
            open={metricsOpen}
            onToggle={() => {
              setMetricsOpen((open) => !open);
            }}
            triggerContent={
              <span className="flex items-center gap-2 text-[13px] font-medium text-[var(--admin-on-surface)]">
                Show:{" "}
                {visibleMetrics.size === METRIC_OPTIONS.length
                  ? "All metrics"
                  : `${visibleMetrics.size} metrics`}
                <ChevronDown
                  className={`h-4 w-4 text-[var(--admin-on-surface-variant)] transition-transform duration-200 ${metricsOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </span>
            }
            panelAriaLabel="Visible metrics"
          >
            <div className="max-h-72 w-64 overflow-y-auto p-1.5" role="listbox">
              {METRIC_OPTIONS.filter((option) => {
                if (option.seriesOnly && mode !== "series") return false;
                if (option.sessionsOnly && mode !== "sessions") return false;
                return true;
              }).map((option) => {
                const checked = visibleMetrics.has(option.key);
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="option"
                    aria-selected={checked}
                    className={`${dropdownItemClassName} flex w-full items-center justify-between gap-2`}
                    onClick={() => {
                      setVisibleMetrics((prev) => {
                        const next = new Set(prev);
                        if (next.has(option.key)) next.delete(option.key);
                        else next.add(option.key);
                        return next;
                      });
                    }}
                  >
                    <span>{option.label}</span>
                    {checked ? (
                      <Check className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </DropdownField>
        </div>
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-danger)]">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="text-sm font-bold text-[var(--admin-danger)] underline-offset-2 hover:underline"
            onClick={() => void loadCompare()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <Shimmer className="h-10 w-full" />
          <Shimmer className="h-12 w-full" />
          <Shimmer className="h-12 w-full" />
          <Shimmer className="h-12 w-full" />
          <Shimmer className="h-24 w-full" />
        </div>
      ) : null}

      {!loading && empty ? (
        <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 md:p-8">
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1].map((slot) => (
              <button
                key={slot}
                type="button"
                className="flex h-24 flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--admin-outline)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)] transition-colors hover:border-[var(--admin-primary)] hover:bg-[var(--admin-surface-variant)] hover:text-[var(--admin-on-surface)]"
                onClick={() => {
                  setAddOpen(true);
                }}
              >
                <Plus className="mb-1 h-5 w-5" aria-hidden />
                <span className="text-sm font-semibold">
                  Select {mode === "series" ? "series" : "session"}
                </span>
              </button>
            ))}
            <div className="hidden h-24 rounded-lg border border-dashed border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-low)_50%,transparent)] opacity-50 lg:block" />
          </div>
          <div className="flex flex-col items-center justify-center rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] py-16 text-center">
            <ArrowLeftRight className="mb-4 h-12 w-12 text-[var(--admin-outline)]" aria-hidden />
            <p className="text-base font-semibold text-[var(--admin-on-surface-variant)]">
              Pick at least two {mode === "series" ? "series" : "sessions"} to compare
            </p>
            <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
              You can also select rows on{" "}
              <Link
                href="/admin/reports/super-live-insights"
                className="font-medium text-[var(--admin-primary)] underline-offset-2 hover:underline"
              >
                Sessions
              </Link>{" "}
              and open Compare from there.
            </p>
          </div>
        </section>
      ) : null}

      {!loading && !empty && data && items.length >= 2 ? (
        <>
          <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="hidden border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] md:flex">
              <div className="flex w-[240px] shrink-0 items-center border-r border-[var(--admin-border)] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)] lg:w-[280px]">
                Metric
              </div>
              <div className="flex min-w-0 flex-1">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="relative flex min-w-0 flex-1 flex-col justify-center overflow-hidden border-r border-[var(--admin-border)] px-4 py-3 last:border-r-0"
                  >
                    <div
                      className="absolute inset-x-0 top-0 h-1"
                      style={{ background: swatch(item.colorIndex) }}
                    />
                    <span className="truncate text-xs font-semibold text-[var(--admin-on-surface)]">
                      {item.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col">
              {activeMetrics.map((option) => {
                if (option.key === "composition") {
                  return (
                    <div
                      key={option.key}
                      className="flex flex-col border-b border-[var(--admin-border)] md:flex-row"
                    >
                      <div className="flex w-full shrink-0 items-center border-b border-[var(--admin-border)] px-4 py-3 text-sm font-medium text-[var(--admin-on-surface)] md:w-[240px] md:border-b-0 md:border-r lg:w-[280px]">
                        Attendance composition
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col md:flex-row">
                        {items.map((item) => {
                          const total = Math.max(1, item.composition.totalCount);
                          const attended = (item.composition.attendedCount / total) * 100;
                          const registered = (item.composition.registeredCount / total) * 100;
                          const absent = (item.composition.absentCount / total) * 100;
                          return (
                            <div
                              key={item.id}
                              className="flex min-w-0 flex-1 flex-col justify-center border-b border-[var(--admin-border)] px-4 py-3 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"
                            >
                              <p className="mb-2 truncate text-xs font-medium text-[var(--admin-on-surface)] md:hidden">
                                {item.title}
                              </p>
                              <div className="flex h-3 w-full overflow-hidden rounded">
                                <div
                                  className="bg-[var(--admin-success)]"
                                  style={{ width: `${attended}%` }}
                                />
                                <div
                                  className="bg-[var(--admin-warning)]"
                                  style={{ width: `${registered}%` }}
                                />
                                <div
                                  className="bg-[var(--admin-danger)] opacity-80"
                                  style={{ width: `${absent}%` }}
                                />
                              </div>
                              <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                                <span>{formatRate(item.metrics.attendanceRate)}</span>
                                <span>{formatCount(item.composition.totalCount)} total</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                if (option.key === "distribution") {
                  const tenant = data.tenantAverages.coveragePct ?? 0;
                  return (
                    <div
                      key={option.key}
                      className="flex flex-col border-t-2 border-[var(--admin-outline)] bg-[var(--admin-surface-low)] py-6 md:flex-row"
                    >
                      <div className="w-full shrink-0 px-4 md:w-[240px] md:border-r md:border-[var(--admin-border)] lg:w-[280px]">
                        <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                          Coverage distribution
                        </p>
                        <p className="text-xs text-[var(--admin-on-surface-variant)]">
                          Scale 0 - 100%
                        </p>
                      </div>
                      <div className="relative mt-6 flex min-h-16 flex-1 items-center px-8 md:mt-0">
                        <div className="absolute inset-x-8 top-1/2 h-px -translate-y-1/2 bg-[var(--admin-outline)]" />
                        <div
                          className="absolute top-0 h-full w-px border-l border-dashed border-[var(--admin-on-surface-variant)]"
                          style={{ left: `calc(2rem + ${tenant}% * (100% - 4rem) / 100)` }}
                        />
                        <span
                          className="absolute -top-4 font-mono text-[10px] uppercase text-[var(--admin-on-surface-variant)]"
                          style={{
                            left: `calc(2rem + ${tenant}% * (100% - 4rem) / 100)`,
                            transform: "translateX(-50%)",
                          }}
                        >
                          Tenant avg
                        </span>
                        {items.map((item) => {
                          const value = item.metrics.coveragePct ?? 0;
                          return (
                            <div
                              key={item.id}
                              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--admin-surface)] shadow-sm"
                              style={{
                                left: `calc(2rem + ${value}% * (100% - 4rem) / 100)`,
                                background: swatch(item.colorIndex),
                              }}
                              title={`${item.title}: ${formatRate(item.metrics.coveragePct)}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                const values = items.map((item) => metricValue(item, option.key));
                const numeric = values.map((value) => numericForBest(option.key, value));
                const best = numeric.reduce<number | null>((acc, value) => {
                  if (value == null) return acc;
                  if (acc == null) return value;
                  return value > acc ? value : acc;
                }, null);
                const baseline = numeric[0];

                return (
                  <div
                    key={option.key}
                    className="flex flex-col border-b border-[var(--admin-border)] transition-colors hover:bg-[var(--admin-surface-high)] md:flex-row md:min-h-[44px]"
                  >
                    <div className="flex w-full shrink-0 flex-col justify-center border-b border-[var(--admin-border)] px-4 py-3 md:w-[240px] md:border-b-0 md:border-r lg:w-[280px]">
                      <span className="text-sm font-medium text-[var(--admin-on-surface)]">
                        {option.label}
                      </span>
                      {option.key === "coveragePct" ? (
                        <span className="text-[11px] text-[var(--admin-on-surface-variant)]">
                          Attended duration / session length
                        </span>
                      ) : null}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col md:flex-row">
                      {items.map((item, index) => {
                        const value = values[index] ?? null;
                        const num = numeric[index];
                        const isBest = best != null && num != null && num === best;
                        const delta =
                          index > 0 &&
                          typeof num === "number" &&
                          typeof baseline === "number" &&
                          (option.key === "attendanceRate" ||
                            option.key === "coveragePct" ||
                            option.key === "avgDurationSeconds" ||
                            option.key === "sessionsHeld" ||
                            option.key === "totalRecords" ||
                            option.key === "attendedCount")
                            ? num - baseline
                            : null;
                        return (
                          <div
                            key={item.id}
                            className={[
                              "flex min-w-0 flex-1 flex-col items-end justify-center border-b border-[var(--admin-border)] px-4 py-3 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0",
                              isBest
                                ? "bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] md:border-l-2 md:border-l-[var(--admin-primary)]"
                                : "",
                            ].join(" ")}
                          >
                            <p className="mb-1 w-full truncate text-left text-xs font-medium text-[var(--admin-on-surface)] md:hidden">
                              {item.title}
                            </p>
                            <span className="font-mono text-xl text-[var(--admin-on-surface)]">
                              {formatMetric(option.key, value)}
                            </span>
                            {mode === "series" && item.metrics.sessionsHeld != null ? (
                              <span className="mt-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                Avg of {item.metrics.sessionsHeld} sessions
                              </span>
                            ) : null}
                            {delta != null && Math.abs(delta) >= 0.05 ? (
                              <span
                                className={[
                                  "mt-0.5 font-mono text-[11px]",
                                  delta > 0
                                    ? "text-[var(--admin-success)]"
                                    : "text-[var(--admin-danger)]",
                                ].join(" ")}
                              >
                                {delta > 0 ? "+" : ""}
                                {option.key.includes("Duration") ||
                                option.key === "avgDurationSeconds"
                                  ? formatDuration(delta)
                                  : option.key === "attendanceRate" || option.key === "coveragePct"
                                    ? `${delta.toFixed(1)} pts`
                                    : delta.toLocaleString()}{" "}
                                vs left
                              </span>
                            ) : null}
                            {(option.key === "attendanceRate" ||
                              option.key === "coveragePct" ||
                              option.key === "totalRecords" ||
                              option.key === "attendedCount") &&
                            typeof num === "number" ? (
                              <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-variant)]">
                                <div
                                  className="h-full"
                                  style={{
                                    width: `${Math.max(
                                      0,
                                      Math.min(
                                        100,
                                        option.key === "attendanceRate" ||
                                          option.key === "coveragePct"
                                          ? num
                                          : best
                                            ? (Math.abs(num) / Math.max(Math.abs(best), 1)) * 100
                                            : 0,
                                      ),
                                    )}%`,
                                    background: swatch(item.colorIndex),
                                  }}
                                />
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {data.compositionCaption ? (
            <p className="text-xs text-[var(--admin-on-surface-variant)]">
              {data.compositionCaption}
            </p>
          ) : null}

          {mode === "series" && maxTrendLen > 1 ? (
            <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 md:p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                    Attendance trend
                  </h2>
                  <p className="text-xs text-[var(--admin-on-surface-variant)]">
                    Normalized across session sequence
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] px-3 py-1.5">
                  {items.map((item) => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-2 text-xs text-[var(--admin-on-surface)]"
                    >
                      <span className="h-0.5 w-3" style={{ background: swatch(item.colorIndex) }} />
                      {item.title}
                    </span>
                  ))}
                </div>
              </div>
              <div className="relative h-64 overflow-hidden rounded border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] px-4 pb-8 pt-4">
                <div className="absolute bottom-2 left-12 right-4 flex justify-between font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                  {Array.from({ length: maxTrendLen }, (_, i) => (
                    <span key={i}>S{i + 1}</span>
                  ))}
                </div>
                <div className="absolute inset-y-4 left-4 flex w-8 flex-col justify-between border-r border-[var(--admin-border)] pr-2 text-right font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                  <span>100%</span>
                  <span>50%</span>
                  <span>0%</span>
                </div>
                <svg
                  className="absolute inset-4 left-12 overflow-visible"
                  viewBox={`0 0 ${Math.max(1, maxTrendLen - 1) * 10} 100`}
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  {items.map((item) => {
                    const points = (item.trend ?? [])
                      .map((point, index) => {
                        if (point.attendanceRate == null) return null;
                        const x = index * 10;
                        const y = 100 - point.attendanceRate;
                        return `${x},${y}`;
                      })
                      .filter(Boolean)
                      .join(" ");
                    if (!points) return null;
                    return (
                      <polyline
                        key={item.id}
                        fill="none"
                        stroke={swatch(item.colorIndex)}
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                        points={points}
                      />
                    );
                  })}
                </svg>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
