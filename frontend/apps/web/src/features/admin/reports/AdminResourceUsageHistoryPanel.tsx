"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Inbox,
  Minus,
  RefreshCw,
  Table2,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import { ClientApiError } from "../../../lib/client-api";
import {
  RESOURCE_USAGE_METRIC_OPTIONS,
  exportResourceUsageReport,
  fetchResourceUsageHistory,
  type ResourceUsageHistoryItem,
  type ResourceUsageHistoryResponse,
  type ResourceUsageHistorySeries,
  type ResourceUsageHistorySort,
  type ResourceUsageHistorySummary,
} from "./admin-resource-usage-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

type HistoryView = "table" | "chart";

const RANGE_OPTIONS = [
  { value: "6", label: "Last 6 months" },
  { value: "12", label: "Last 12 months" },
  { value: "24", label: "Last 24 months" },
] as const;

const SORT_OPTIONS: Array<{ value: ResourceUsageHistorySort; label: string }> = [
  { value: "newest", label: "Sort: Newest" },
  { value: "oldest", label: "Sort: Oldest" },
  { value: "highest_delta", label: "Sort: Highest delta" },
];

const selectClassName =
  "h-9 min-w-[140px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-medium text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const primaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 text-sm font-medium text-[var(--admin-on-primary)] transition-all hover:bg-[var(--admin-primary-strong)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

function Shimmer({ className }: { className?: string }) {
  return (
    <div
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

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatValue(value: number, unit: string): string {
  if (unit === "GB") {
    if (value < 0.01 && value > 0) return "<0.01";
    return value.toLocaleString(undefined, {
      minimumFractionDigits: value >= 100 ? 0 : 1,
      maximumFractionDigits: 2,
    });
  }
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}k`;
  return formatCount(value);
}

function formatUnitBadge(unit: string): string {
  if (unit === "GB") return "GB";
  if (unit === "count") return "CNT";
  return unit.slice(0, 3).toUpperCase();
}

function formatPeriodLabel(period: string): string {
  const date = new Date(`${period}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return period;
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric", timeZone: "UTC" });
}

function formatRelative(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${String(minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${String(hours)}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  if (days < 30) return `${String(days)} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatExactUtc(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

function metricDotTone(metricKey: string): string {
  if (metricKey.includes("storage")) return "bg-[var(--admin-primary)]";
  if (metricKey.includes("learner")) return "bg-[var(--admin-success)]";
  if (metricKey.includes("product")) return "bg-[var(--admin-warning)]";
  if (metricKey.includes("message") || metricKey.includes("email")) {
    return "bg-[var(--admin-outline)]";
  }
  return "bg-[var(--admin-primary-strong)]";
}

function ChangeCell({
  changeAbsolute,
  changePercent,
  unit,
}: {
  changeAbsolute: number | null;
  changePercent: number | null;
  unit: string;
}) {
  if (changeAbsolute == null) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-xs text-[var(--admin-on-surface-variant)]">
        <Minus className="h-3.5 w-3.5" aria-hidden />-
      </span>
    );
  }
  if (changeAbsolute === 0) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-xs text-[var(--admin-on-surface-variant)]">
        <Minus className="h-3.5 w-3.5" aria-hidden />0
      </span>
    );
  }
  const up = changeAbsolute > 0;
  const tone = up ? "text-[var(--admin-warning)]" : "text-[var(--admin-success)]";
  const label =
    changePercent != null
      ? `${up ? "+" : ""}${changePercent.toFixed(1)}%`
      : `${up ? "+" : ""}${formatValue(Math.abs(changeAbsolute), unit)}${unit === "GB" ? " GB" : ""}`;
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-xs ${tone}`}>
      {label}
      {up ? (
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />
      )}
    </span>
  );
}

function HistoryLoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading usage history">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="space-y-2">
          <Shimmer className="h-8 w-48" />
          <Shimmer className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-36" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="space-y-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
          >
            <Shimmer className="h-3 w-24" />
            <Shimmer className="h-7 w-20" />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2">
        <Shimmer className="h-8 w-36" />
        <Shimmer className="h-8 w-40" />
        <Shimmer className="h-8 w-32" />
        <Shimmer className="ml-auto h-8 w-28" />
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="flex h-12 items-center gap-4 border-b border-[var(--admin-border)] px-4 last:border-b-0"
          >
            <Shimmer className="h-4 w-40" />
            <Shimmer className="h-4 w-24" />
            <Shimmer className="ml-auto h-4 w-16" />
            <Shimmer className="h-4 w-12" />
            <Shimmer className="h-4 w-16" />
            <Shimmer className="h-4 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyHistory({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center">
      <Inbox className="mb-4 h-12 w-12 text-[var(--admin-outline)]" aria-hidden />
      <h3 className="text-lg font-semibold tracking-tight text-[var(--admin-on-surface)]">
        No history recorded for this metric
      </h3>
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
        Adjust your filters or select a wider time range to view resource consumption data.
      </p>
      <button type="button" className={`${secondaryButtonClassName} mt-6`} onClick={onClear}>
        Clear filters
      </button>
    </div>
  );
}

function formatAxisTick(value: number, unit: string): string {
  if (unit === "GB") {
    if (value >= 100) return String(Math.round(value));
    return value.toFixed(value >= 10 ? 0 : 1);
  }
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}k`;
  return formatCount(Math.round(value));
}

function MovementCell({
  label,
  movement,
  tone,
}: {
  label: string;
  movement: ResourceUsageHistorySummary["largestMovement"];
  tone: "warning" | "muted";
}) {
  return (
    <div className="p-4">
      <p className="mb-1 text-[11px] font-medium tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
        {label}
      </p>
      {movement ? (
        <>
          <p className="text-sm text-[var(--admin-on-surface)]">{movement.metricLabel}</p>
          <p
            className={[
              "mt-1 font-mono text-sm",
              tone === "warning"
                ? "text-[var(--admin-warning)]"
                : "text-[var(--admin-on-surface-variant)]",
            ].join(" ")}
          >
            {movement.changeAbsolute > 0 ? "+" : ""}
            {formatValue(movement.changeAbsolute, movement.unit)}
            {movement.unit === "GB" ? " GB" : ""}
          </p>
        </>
      ) : (
        <p className="font-mono text-sm text-[var(--admin-on-surface-variant)]">-</p>
      )}
    </div>
  );
}

function HistoryChartPanel({ series }: { series: ResourceUsageHistorySeries }) {
  const max = Math.max(1, ...series.points.map((point) => point.value));
  const mid = max / 2;
  const latestChange = series.latestChangeAbsolute;

  return (
    <div className="flex h-[320px] flex-col rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-[var(--admin-on-surface)]">
            {series.metricLabel}
          </h3>
          <span className="mt-1 inline-block rounded bg-[var(--admin-surface-low)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
            {series.metricKey}
          </span>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg text-[var(--admin-on-surface)]">
            {formatValue(series.latestValue, series.unit)}
            {series.unit === "GB" ? " GB" : ""}
          </p>
          {latestChange != null ? (
            <p
              className={[
                "mt-1 flex items-center justify-end gap-1 text-[11px]",
                latestChange > 0
                  ? "text-[var(--admin-warning)]"
                  : latestChange < 0
                    ? "text-[var(--admin-success)]"
                    : "text-[var(--admin-on-surface-variant)]",
              ].join(" ")}
            >
              {latestChange > 0 ? (
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              ) : latestChange < 0 ? (
                <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Minus className="h-3.5 w-3.5" aria-hidden />
              )}
              {latestChange > 0 ? "+" : ""}
              {formatValue(latestChange, series.unit)}
              {series.unit === "GB" ? " GB" : ""}
            </p>
          ) : null}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 pl-8">
        <div className="pointer-events-none absolute top-0 left-0 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
          {formatAxisTick(max, series.unit)}
        </div>
        <div className="pointer-events-none absolute top-1/2 left-0 -translate-y-1/2 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
          {formatAxisTick(mid, series.unit)}
        </div>
        <div className="pointer-events-none absolute bottom-0 left-0 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
          0
        </div>
        <div className="relative h-full border-b border-l border-[color-mix(in_srgb,var(--admin-border)_60%,transparent)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-[color-mix(in_srgb,var(--admin-border)_50%,transparent)]" />
          <div className="pointer-events-none absolute inset-x-0 top-1/4 border-t border-dashed border-[color-mix(in_srgb,var(--admin-border)_50%,transparent)]" />
          <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-[color-mix(in_srgb,var(--admin-border)_50%,transparent)]" />
          <div className="pointer-events-none absolute inset-x-0 top-3/4 border-t border-dashed border-[color-mix(in_srgb,var(--admin-border)_50%,transparent)]" />
          <div className="absolute inset-0 flex items-end justify-between gap-1 px-2 pt-4">
            {series.points.map((point, index) => {
              const height = Math.max(4, (point.value / max) * 100);
              const isLatest = index === series.points.length - 1;
              return (
                <div
                  key={`${series.metricKey}-${point.period}`}
                  className="group relative flex h-full flex-1 items-end justify-center"
                >
                  <div
                    className={[
                      "w-full max-w-8 rounded-t-sm transition-colors",
                      isLatest
                        ? "bg-[var(--admin-primary)]"
                        : "bg-[var(--admin-surface-high)] group-hover:bg-[var(--admin-outline)]",
                    ].join(" ")}
                    style={{ height: `${String(height)}%` }}
                    aria-label={`${formatPeriodLabel(point.period)}: ${formatValue(point.value, series.unit)}`}
                  />
                  <span className="pointer-events-none absolute -top-6 left-1/2 z-10 -translate-x-1/2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[10px] whitespace-nowrap text-[var(--admin-on-surface)] opacity-0 transition-opacity group-hover:opacity-100">
                    {formatPeriodLabel(point.period).split(" ")[0]}:{" "}
                    {formatValue(point.value, series.unit)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-2 flex justify-between pl-8 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
        {series.points.map((point, index) => (
          <span
            key={`${point.period}-label`}
            className={
              index === series.points.length - 1 ? "text-[var(--admin-on-surface)]" : undefined
            }
          >
            {formatPeriodLabel(point.period).split(" ")[0]}
          </span>
        ))}
      </div>
    </div>
  );
}

function SummaryBand({ summary }: { summary: ResourceUsageHistorySummary }) {
  const missingMeters = summary.metersAvailable - summary.metricsTracked;

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="grid grid-cols-1 divide-y divide-[var(--admin-border)] sm:grid-cols-2 lg:grid-cols-6 lg:divide-x lg:divide-y-0">
        <div className="p-4 lg:col-span-1">
          <p className="mb-1 text-[11px] font-medium tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
            Total records
          </p>
          <p className="font-mono text-2xl text-[var(--admin-on-surface)]">
            {formatCount(summary.totalRecords)}
          </p>
        </div>
        <div className="p-4 lg:col-span-1">
          <p className="mb-1 text-[11px] font-medium tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
            Metrics tracked
          </p>
          <p className="font-mono text-2xl text-[var(--admin-on-surface)]">
            {formatCount(summary.metricsTracked)}
            <span className="ml-1 text-sm font-normal text-[var(--admin-on-surface-variant)]">
              of {summary.metersAvailable}
            </span>
          </p>
          {missingMeters > 0 ? (
            <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
              {formatCount(missingMeters)} meter{missingMeters === 1 ? "" : "s"} not yet recorded
            </p>
          ) : null}
        </div>
        <div className="p-4">
          <p className="mb-1 text-[11px] font-medium tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
            Periods recorded
          </p>
          <p className="font-mono text-2xl text-[var(--admin-on-surface)]">
            {formatCount(summary.periodsRecorded)}
          </p>
          <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
            {summary.earliestPeriod && summary.latestPeriod
              ? `${formatPeriodLabel(summary.earliestPeriod)} - ${formatPeriodLabel(summary.latestPeriod)}`
              : "No periods yet"}
          </p>
        </div>
        <div className="p-4">
          <p className="mb-1 text-[11px] font-medium tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
            Last calculated
          </p>
          <p className="text-sm text-[var(--admin-on-surface)]">
            {formatRelative(summary.lastCalculatedAt)}
          </p>
          {summary.lastCalculatedAt ? (
            <p className="mt-1 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
              {formatExactUtc(summary.lastCalculatedAt)}
            </p>
          ) : null}
        </div>
        <MovementCell label="Largest movement" movement={summary.largestMovement} tone="warning" />
        <MovementCell label="Smallest movement" movement={summary.smallestMovement} tone="muted" />
      </div>
    </div>
  );
}

function pageWindow(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  return [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
}

function HistoryPagination({
  page,
  pages,
  totalPages,
  pageInfo,
  onPageChange,
  embedded = false,
}: {
  page: number;
  pages: number[];
  totalPages: number;
  pageInfo: {
    page: number;
    pageSize: number;
    totalCount: number;
  };
  onPageChange: (page: number | ((current: number) => number)) => void;
  embedded?: boolean;
}) {
  return (
    <div
      className={[
        "flex flex-col items-center justify-between gap-3 text-[11px] text-[var(--admin-on-surface-variant)] sm:flex-row",
        embedded
          ? "border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3"
          : "border-t border-[var(--admin-border)] pt-4",
      ].join(" ")}
    >
      <p>
        Showing{" "}
        <span className="font-mono text-[var(--admin-on-surface)]">
          {pageInfo.totalCount === 0
            ? "0"
            : `${String((pageInfo.page - 1) * pageInfo.pageSize + 1)}-${String(Math.min(pageInfo.page * pageInfo.pageSize, pageInfo.totalCount))}`}
        </span>{" "}
        of{" "}
        <span className="font-mono text-[var(--admin-on-surface)]">
          {formatCount(pageInfo.totalCount)}
        </span>{" "}
        records
      </p>
      {totalPages > 1 ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)] transition-colors hover:border-[var(--admin-outline)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => {
              onPageChange((current) => Math.max(1, current - 1));
            }}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          {pages.map((pageNumber, index) => {
            const prev = pages[index - 1];
            const showEllipsis = prev != null && pageNumber - prev > 1;
            return (
              <span key={pageNumber} className="contents">
                {showEllipsis ? (
                  <span className="px-1 text-[var(--admin-on-surface-variant)]">...</span>
                ) : null}
                <button
                  type="button"
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-sm font-mono text-xs transition-colors",
                    pageNumber === page
                      ? "border border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]"
                      : "text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]",
                  ].join(" ")}
                  onClick={() => {
                    onPageChange(pageNumber);
                  }}
                >
                  {pageNumber}
                </button>
              </span>
            );
          })}
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)] transition-colors hover:border-[var(--admin-outline)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => {
              onPageChange((current) => current + 1);
            }}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}

type Props = {
  onExportBusyChange?: (busy: boolean) => void;
};

export function AdminResourceUsageHistoryPanel({ onExportBusyChange }: Props) {
  const [view, setView] = useState<HistoryView>("table");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metricKey, setMetricKey] = useState("");
  const [rangeMonths, setRangeMonths] = useState(24);
  const [sort, setSort] = useState<ResourceUsageHistorySort>("newest");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ResourceUsageHistoryResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchResourceUsageHistory({
        ...(metricKey ? { metricKey } : {}),
        page,
        rangeMonths,
        sort,
      });
      setData(response.data);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Could not load history data.",
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [metricKey, page, rangeMonths, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleExport() {
    setBusy(true);
    onExportBusyChange?.(true);
    setError(null);
    try {
      const response = await exportResourceUsageReport({
        reportTab: "history",
        ...(metricKey ? { metricKey } : {}),
        emailDownloadLink: true,
      });
      const completed = await pollReportRunUntilComplete(response.data.runId);
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
            : "Unable to export history.",
      );
    } finally {
      setBusy(false);
      onExportBusyChange?.(false);
    }
  }

  function clearFilters() {
    setMetricKey("");
    setRangeMonths(24);
    setSort("newest");
    setPage(1);
  }

  const items = data?.items ?? [];
  const summary = data?.summary ?? null;
  const series = data?.series ?? [];
  const pageInfo = data?.pageInfo;
  const totalPages = pageInfo?.totalPages ?? 0;
  const pages = useMemo(() => pageWindow(page, Math.max(totalPages, 1)), [page, totalPages]);
  const isFilteredEmpty = !loading && !error && items.length === 0;

  if (loading && !data) {
    return <HistoryLoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="text-[28px] font-semibold tracking-tight text-[var(--admin-on-surface)] md:text-[32px]">
            History
          </h2>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Recorded values for every metered resource, period by period.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={busy || loading}
            onClick={() => {
              void handleExport();
            }}
          >
            <Download className="h-4 w-4" aria-hidden />
            {busy ? "Exporting..." : "Export CSV"}
          </button>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={loading}
            onClick={() => {
              void load();
            }}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex flex-col items-start justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_45%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-4 sm:flex-row sm:items-center"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-danger)]"
              aria-hidden
            />
            <div>
              <p className="text-sm font-semibold text-[var(--admin-danger)]">
                Could not load history data.
              </p>
              <p className="text-sm text-[var(--admin-on-surface-variant)]">{error}</p>
            </div>
          </div>
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={() => {
              void load();
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Retry
          </button>
        </div>
      ) : null}

      {summary && !error ? <SummaryBand summary={summary} /> : null}

      <div className="flex flex-col gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            ariaLabel="Metric filter"
            className={selectClassName}
            value={metricKey}
            onValueChange={(value) => {
              setMetricKey(value);
              setPage(1);
            }}
            options={RESOURCE_USAGE_METRIC_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
          <Select
            ariaLabel="Date range"
            className={selectClassName}
            value={String(rangeMonths)}
            onValueChange={(value) => {
              setRangeMonths(Number(value));
              setPage(1);
            }}
            options={RANGE_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
          <span className="inline-flex h-9 items-center gap-2 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-xs text-[var(--admin-on-surface-variant)]">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            Monthly
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            ariaLabel="Sort order"
            className={selectClassName}
            value={sort}
            onValueChange={(value) => {
              setSort(value as ResourceUsageHistorySort);
              setPage(1);
            }}
            options={SORT_OPTIONS}
          />
          <div className="flex h-9 items-center rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-0.5">
            <button
              type="button"
              className={[
                "inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-[11px] font-medium transition-colors",
                view === "chart"
                  ? "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface)]"
                  : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
              ].join(" ")}
              onClick={() => {
                setView("chart");
              }}
            >
              <BarChart3 className="h-3.5 w-3.5" aria-hidden />
              Chart
            </button>
            <button
              type="button"
              className={[
                "inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-[11px] font-medium transition-colors",
                view === "table"
                  ? "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface)]"
                  : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
              ].join(" ")}
              onClick={() => {
                setView("table");
              }}
            >
              <Table2 className="h-3.5 w-3.5" aria-hidden />
              Table
            </button>
          </div>
        </div>
      </div>

      {isFilteredEmpty ? (
        <EmptyHistory onClear={clearFilters} />
      ) : view === "chart" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {series.length === 0 ? (
              <EmptyHistory onClear={clearFilters} />
            ) : (
              series.map((entry) => <HistoryChartPanel key={entry.metricKey} series={entry} />)
            )}
          </div>
          {pageInfo && series.length > 0 ? (
            <HistoryPagination
              page={page}
              pages={pages}
              totalPages={totalPages}
              pageInfo={pageInfo}
              onPageChange={setPage}
            />
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[11px] font-medium tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                  <th className="px-4 py-2.5 font-medium">Metric</th>
                  <th className="px-4 py-2.5 font-medium">Period</th>
                  <th className="px-4 py-2.5 text-right font-medium">Value</th>
                  <th className="px-4 py-2.5 font-medium">Unit</th>
                  <th className="px-4 py-2.5 font-medium">Change</th>
                  <th className="px-4 py-2.5 font-medium">Calculated at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]">
                {items.map((item: ResourceUsageHistoryItem) => (
                  <tr
                    key={`${item.metricKey}-${item.period}`}
                    className="transition-colors hover:bg-[var(--admin-surface-low)]"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${metricDotTone(item.metricKey)}`}
                          aria-hidden
                        />
                        <span className="font-medium text-[var(--admin-on-surface)]">
                          <Link
                            href={`/admin/reports/resource-usage/metrics/${encodeURIComponent(item.metricKey)}`}
                            prefetch={false}
                            className="hover:text-[var(--admin-primary)] hover:underline"
                          >
                            {item.metricLabel}
                          </Link>
                        </span>
                      </div>
                      <p className="mt-0.5 ml-3.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                        {item.metricKey}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[var(--admin-on-surface-variant)]">
                      {item.period}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[var(--admin-on-surface)]">
                      {formatValue(item.value, item.unit)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                        {formatUnitBadge(item.unit)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <ChangeCell
                        changeAbsolute={item.changeAbsolute}
                        changePercent={item.changePercent}
                        unit={item.unit}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-[var(--admin-on-surface)]">
                        {formatRelative(item.calculatedAt)}
                      </p>
                      <p className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                        {formatExactUtc(item.calculatedAt)}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageInfo ? (
            <HistoryPagination
              page={page}
              pages={pages}
              totalPages={totalPages}
              pageInfo={pageInfo}
              onPageChange={setPage}
              embedded
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
