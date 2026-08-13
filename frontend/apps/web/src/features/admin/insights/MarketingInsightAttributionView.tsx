"use client";

import Link from "next/link";
import { useMemo, useState, type KeyboardEvent } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Info,
  RefreshCw,
  Search,
  Share2,
  Square,
  TriangleAlert,
} from "lucide-react";
import { ADMIN_INSIGHTS_HREF, adminInsightHref } from "./admin-insights-catalog";
import type {
  InsightMarketingAttributionBoard,
  InsightMarketingAttributionComposition,
  InsightMarketingAttributionDimension,
  InsightMarketingAttributionRow,
} from "./admin-insights-api";
import {
  csvEscape,
  formatInsightMoney,
  formatInsightMoneyWithCode,
  formatInsightNumber,
} from "./admin-insights-format";
import {
  insightBreadcrumbClassName,
  insightGhostButtonClassName,
  insightKpiLabelClassName,
  insightKpiValueClassName,
  insightPageClassName,
  insightPageDescClassName,
  insightPageTitleClassName,
  insightPanelClassName,
  insightPrimaryButtonClassName,
  insightSegmentButtonActiveClassName,
  insightSegmentButtonClassName,
  insightSegmentTrackClassName,
  insightShimmerClassName,
  insightTableHeadClassName,
  insightTableRowClassName,
} from "./admin-insights-shared";

type Props = {
  slug: string;
  sectionTitle: string;
  board: InsightMarketingAttributionBoard | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

type DimensionTab = "source" | "medium" | "campaign";

type SortKey = "value" | "events" | "eventShare" | "revenue" | "revenueShare" | "rate";

const PAGE_SIZE = 10;
const DIMENSION_TABS: Array<{ id: DimensionTab; label: string }> = [
  { id: "source", label: "Source" },
  { id: "medium", label: "Medium" },
  { id: "campaign", label: "Campaign" },
];

const NAMED_FILLS = [
  "var(--admin-primary)",
  "color-mix(in srgb, var(--admin-primary) 72%, var(--admin-surface-high))",
  "color-mix(in srgb, var(--admin-primary) 48%, var(--admin-surface-high))",
  "color-mix(in srgb, var(--admin-primary) 28%, var(--admin-surface-high))",
] as const;

const MUTED_FILL = "color-mix(in srgb, var(--admin-on-surface-variant) 55%, var(--admin-surface))";

function downloadCsv(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function isNotSetValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length === 0 ||
    normalized === "(not set)" ||
    normalized === "not set" ||
    normalized === "none"
  );
}

function compositionFill(segment: InsightMarketingAttributionComposition, index: number): string {
  if (segment.kind === "other" || segment.kind === "not-set") return MUTED_FILL;
  return NAMED_FILLS[index] ?? "var(--admin-primary)";
}

function rowFill(
  row: InsightMarketingAttributionRow,
  composition: InsightMarketingAttributionComposition[],
): string {
  const namedIndex = composition.findIndex((segment) => segment.id === row.id);
  if (namedIndex >= 0) return NAMED_FILLS[namedIndex] ?? "var(--admin-primary)";
  return MUTED_FILL;
}

function dimensionCsv(dimension: InsightMarketingAttributionDimension): string {
  const lines = [
    ["Value", "Events", "Share events", "Revenue", "Share rev", "Rev/event"]
      .map(csvEscape)
      .join(","),
  ];
  for (const row of dimension.rows) {
    lines.push(
      [
        row.value,
        row.events,
        row.eventSharePct == null ? "-" : `${row.eventSharePct}%`,
        row.revenueMajor.toFixed(2),
        row.revenueSharePct == null ? "-" : `${row.revenueSharePct}%`,
        row.revenuePerEvent == null ? "-" : row.revenuePerEvent.toFixed(2),
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return lines.join("\n");
}

function matchesSegmentFilter(
  row: InsightMarketingAttributionRow,
  segmentId: string | null,
  namedIds: Set<string>,
): boolean {
  if (!segmentId) return true;
  if (segmentId.endsWith(":other")) {
    return !namedIds.has(row.id) && !isNotSetValue(row.value);
  }
  if (segmentId.endsWith(":not-set")) {
    return isNotSetValue(row.value);
  }
  return row.id === segmentId;
}

function compareRows(
  left: InsightMarketingAttributionRow,
  right: InsightMarketingAttributionRow,
  key: SortKey,
): number {
  if (key === "value") return left.value.localeCompare(right.value);
  if (key === "events") return left.events - right.events;
  if (key === "eventShare") return (left.eventSharePct ?? -1) - (right.eventSharePct ?? -1);
  if (key === "revenue") return left.revenueMajor - right.revenueMajor;
  if (key === "revenueShare") {
    return (left.revenueSharePct ?? -1) - (right.revenueSharePct ?? -1);
  }
  return (left.revenuePerEvent ?? -1) - (right.revenuePerEvent ?? -1);
}

function Shimmer({ className, widthPct }: { className: string; widthPct?: number | undefined }) {
  return (
    <div
      className={`${insightShimmerClassName} ${className}`}
      style={widthPct != null ? { width: `${String(widthPct)}%` } : undefined}
    />
  );
}

function AttributionSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading attribution">
      <div className="flex items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
        <Shimmer className="h-5 w-5 rounded-full" />
        <Shimmer className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-12">
        <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:col-span-2 xl:col-span-4">
          <Shimmer className="mb-4 h-3 w-32" />
          <Shimmer className="mb-4 h-8 w-28" />
          <Shimmer className="h-3 w-40" />
        </section>
        <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:col-span-2 xl:col-span-4">
          <Shimmer className="mb-4 h-3 w-36" />
          <Shimmer className="mb-4 h-8 w-40" />
          <Shimmer className="h-3 w-16" />
        </section>
        <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:col-span-2 xl:col-span-4">
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((index) => (
              <div key={index} className="min-w-0">
                <Shimmer className="mb-4 h-3 w-16" />
                <Shimmer className="mb-4 h-8 w-10" />
                {index === 2 ? <Shimmer className="h-3 w-24" /> : null}
              </div>
            ))}
          </div>
        </section>
      </div>
      <Shimmer className="h-10 w-full max-w-md rounded" />
      <section className={`${insightPanelClassName} p-6`}>
        <div className="mb-4 flex justify-between">
          <Shimmer className="h-4 w-48" />
          <Shimmer className="h-4 w-28" />
        </div>
        <div className="flex h-8 overflow-hidden rounded-md">
          <Shimmer className="h-full rounded-none" widthPct={40} />
          <Shimmer className="h-full rounded-none opacity-80" widthPct={25} />
          <Shimmer className="h-full rounded-none opacity-60" widthPct={20} />
          <Shimmer className="h-full rounded-none opacity-40" widthPct={15} />
        </div>
      </section>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className={`${insightPanelClassName} hidden h-[400px] p-6 lg:col-span-7 lg:flex`}>
          <Shimmer className="mb-6 h-5 w-48" />
          <div className="relative flex-1">
            <Shimmer className="absolute h-4 w-4 rounded-full" />
            <Shimmer className="absolute left-[30%] top-[40%] h-5 w-5 rounded-full" />
            <Shimmer className="absolute left-[70%] top-[20%] h-3 w-3 rounded-full" />
          </div>
        </section>
        <section className={`${insightPanelClassName} h-[400px] p-6 lg:col-span-5`}>
          <Shimmer className="mb-6 h-5 w-40" />
          <div className="space-y-4">
            {[80, 65, 50, 40, 28].map((width) => (
              <div key={width} className="space-y-2">
                <div className="flex justify-between">
                  <Shimmer className="h-3 w-32" />
                  <Shimmer className="h-3 w-16" />
                </div>
                <Shimmer className="h-[3px]" widthPct={width} />
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className={insightPanelClassName}>
        <div className="flex h-11 items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4">
          <Shimmer className="h-4 w-36" />
          <Shimmer className="h-8 w-48" />
        </div>
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] px-4 last:border-b-0"
          >
            <Shimmer className="h-4 w-40" />
            <Shimmer className="ml-auto h-4 w-16" />
            <Shimmer className="h-4 w-20" />
            <Shimmer className="h-4 w-16" />
          </div>
        ))}
      </section>
    </div>
  );
}

function ErrorStrip({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-start gap-4 rounded border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-5">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)]">
        <AlertCircle className="h-5 w-5 text-[var(--admin-danger)]" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold text-[var(--admin-danger)]">
          Unable to load attribution
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">{message}</p>
        <button
          type="button"
          className={`${insightGhostButtonClassName} mt-4 border-[color-mix(in_srgb,var(--admin-danger)_40%,var(--admin-outline))] text-[var(--admin-danger)]`}
          onClick={onRetry}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry connection
        </button>
      </div>
    </div>
  );
}

function ShareBar({ pct, fill }: { pct: number | null; fill?: string | undefined }) {
  const width = pct == null ? 0 : Math.min(Math.max(pct, 0), 100);
  return (
    <div className="h-[3px] overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
      <div
        className="h-full rounded-full bg-[var(--admin-primary)]"
        style={{ width: `${String(width)}%`, ...(fill ? { backgroundColor: fill } : {}) }}
      />
    </div>
  );
}

function PatternPill({ pattern }: { pattern: InsightMarketingAttributionRow["pattern"] }) {
  if (!pattern) return null;
  const lowVolumeHighValue = pattern === "low-volume high-value";
  return (
    <span
      className={`rounded px-1.5 py-0.5 font-data text-[11px] font-medium leading-none ${
        lowVolumeHighValue
          ? "border border-[color-mix(in_srgb,var(--admin-success)_25%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_10%,transparent)] text-[var(--admin-success)]"
          : "border border-[color-mix(in_srgb,var(--admin-warning)_25%,transparent)] bg-[color-mix(in_srgb,var(--admin-warning)_10%,transparent)] text-[var(--admin-warning)]"
      }`}
    >
      {lowVolumeHighValue ? "LV/HV" : "HV/LV"}
    </span>
  );
}

function ScatterPlot({
  dimension,
  currency,
  activeId,
  onSelect,
}: {
  dimension: InsightMarketingAttributionDimension;
  currency: string;
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const maxEvents = Math.max(dimension.maxEvents, 1);
  const maxRevenue = Math.max(dimension.maxRevenue, 1);
  const rate = dimension.revenuePerEvent;
  const xOf = (events: number) => (events / maxEvents) * 100;
  const yOf = (revenue: number) => 100 - (revenue / maxRevenue) * 100;

  let lineX2 = 100;
  let lineY2 = 0;
  if (rate != null && rate > 0) {
    const expectedAtMax = maxEvents * rate;
    if (expectedAtMax <= maxRevenue) {
      lineX2 = 100;
      lineY2 = yOf(expectedAtMax);
    } else {
      lineX2 = xOf(maxRevenue / rate);
      lineY2 = 0;
    }
  }

  const hover = dimension.rows.find((row) => row.id === hoverId) ?? null;

  return (
    <div className="relative min-h-0 flex-1">
      <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 -rotate-90 whitespace-nowrap text-[12px] text-[var(--admin-on-surface-variant)]">
        Attributed revenue
      </div>
      <div className="relative ml-8 h-full min-h-[240px] border-b border-l border-[var(--admin-border)]">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <line
            x1="0"
            y1="100"
            x2={lineX2}
            y2={lineY2}
            stroke="var(--admin-outline)"
            strokeDasharray="4 4"
            strokeWidth="0.6"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <p className="absolute left-3 top-3 rounded bg-[color-mix(in_srgb,var(--admin-surface)_80%,transparent)] px-2 py-1 text-[12px] text-[var(--admin-on-surface-variant)]">
          Low volume, high value
        </p>
        <p className="absolute bottom-3 right-3 rounded bg-[color-mix(in_srgb,var(--admin-surface)_80%,transparent)] px-2 py-1 text-[12px] text-[var(--admin-on-surface-variant)]">
          High volume, low value
        </p>
        {dimension.rows.map((row) => {
          const left = xOf(row.events);
          const bottom = (row.revenueMajor / maxRevenue) * 100;
          const active = activeId === row.id || hoverId === row.id;
          return (
            <button
              key={row.id}
              type="button"
              className="group absolute -translate-x-1/2 translate-y-1/2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40"
              style={{
                left: `${String(left)}%`,
                bottom: `${String(bottom)}%`,
                zIndex: active ? 2 : 1,
              }}
              aria-label={`${row.value}: ${formatInsightNumber(row.events)} events, ${formatInsightMoneyWithCode(row.revenueMajor, currency)}`}
              onMouseEnter={() => {
                setHoverId(row.id);
              }}
              onMouseLeave={() => {
                setHoverId(null);
              }}
              onFocus={() => {
                setHoverId(row.id);
              }}
              onBlur={() => {
                setHoverId(null);
              }}
              onClick={() => {
                onSelect(row.id);
              }}
              onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(row.id);
                }
              }}
            >
              <span
                className="block h-2.5 w-2.5 rounded-full transition-transform duration-150 group-hover:scale-150"
                style={{
                  backgroundColor: rowFill(row, dimension.composition),
                  opacity: active || !activeId ? 0.95 : 0.35,
                }}
              />
              <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap font-data text-[10px] text-[var(--admin-on-surface-variant)]">
                {row.value}
              </span>
            </button>
          );
        })}
        {hover ? (
          <div
            className="pointer-events-none absolute z-10 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-1 font-data text-[11px] text-[var(--admin-on-surface)] shadow-sm"
            style={{
              left: `min(${String(xOf(hover.events))}%, calc(100% - 8rem))`,
              bottom: `min(${String((hover.revenueMajor / maxRevenue) * 100 + 6)}%, calc(100% - 2.5rem))`,
            }}
          >
            {hover.value}
            <span className="ml-2 text-[var(--admin-on-surface-variant)]">
              {formatInsightNumber(hover.events)} / {formatInsightMoney(hover.revenueMajor)}
            </span>
          </div>
        ) : null}
      </div>
      <p className="mt-6 text-center text-[12px] text-[var(--admin-on-surface-variant)]">
        Events volume
      </p>
    </div>
  );
}

function RankedList({
  dimension,
  currency,
  unstableThreshold,
  activeId,
  onSelect,
}: {
  dimension: InsightMarketingAttributionDimension;
  currency: string;
  unstableThreshold: number;
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const ranked = useMemo(() => {
    return dimension.rows
      .filter((row) => row.revenuePerEvent != null)
      .slice()
      .sort((left, right) => (right.revenuePerEvent ?? 0) - (left.revenuePerEvent ?? 0));
  }, [dimension.rows]);
  const maxRate = Math.max(...ranked.map((row) => row.revenuePerEvent ?? 0), 1);
  const hasUnstable = ranked.some((row) => row.unstable);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {ranked.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--admin-on-surface-variant)]">
            No values yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {ranked.map((row) => {
              const width = ((row.revenuePerEvent ?? 0) / maxRate) * 100;
              const active = activeId === row.id;
              return (
                <li key={row.id} className={row.unstable ? "opacity-60" : undefined}>
                  <button
                    type="button"
                    className={`w-full rounded-md px-1 py-1 text-left outline-none transition-colors duration-150 hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 ${active ? "bg-[color-mix(in_srgb,var(--admin-primary)_8%,transparent)]" : ""}`}
                    onClick={() => {
                      onSelect(row.id);
                    }}
                  >
                    <div className="mb-1 flex items-end justify-between gap-3">
                      <span className="font-data text-[12px] text-[var(--admin-on-surface)]">
                        {row.value}
                      </span>
                      <span className="font-data text-[12px] font-medium text-[var(--admin-on-surface)]">
                        {row.revenuePerEvent == null
                          ? "-"
                          : formatInsightMoney(row.revenuePerEvent)}{" "}
                        <span className="text-[10px] font-normal text-[var(--admin-on-surface-variant)]">
                          {currency}
                        </span>
                      </span>
                    </div>
                    <ShareBar pct={width} fill={rowFill(row, dimension.composition)} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {hasUnstable ? (
        <p className="mt-4 flex items-start gap-1.5 border-t border-[var(--admin-border)] pt-3 text-[11px] text-[var(--admin-warning)]">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Rates below {formatInsightNumber(unstableThreshold)} events may be inflated.
        </p>
      ) : null}
    </div>
  );
}

function CrossDimensionPanel({ board }: { board: InsightMarketingAttributionBoard }) {
  const pairs = board.crossPairs;
  const caption = board.crossCaption ?? "Cross-dimension pairs are not available for this payload.";

  if (pairs.length === 0) {
    return (
      <section className={`${insightPanelClassName} p-5`} aria-label="Cross-dimension pairs">
        <p className="text-sm text-[var(--admin-on-surface-variant)]">{caption}</p>
      </section>
    );
  }

  const sourceTotals = new Map<string, number>();
  const mediumTotals = new Map<string, number>();
  for (const pair of pairs) {
    sourceTotals.set(pair.source, (sourceTotals.get(pair.source) ?? 0) + pair.events);
    mediumTotals.set(pair.medium, (mediumTotals.get(pair.medium) ?? 0) + pair.events);
  }
  const topSources = [...sourceTotals.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([value]) => value);
  const topMediums = [...mediumTotals.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([value]) => value);
  const lookup = new Map(pairs.map((pair) => [`${pair.source}|${pair.medium}`, pair]));
  const maxShare = Math.max(...pairs.map((pair) => pair.sharePct), 1);

  const cellTint = (sharePct: number) => {
    const mix = Math.round((sharePct / maxShare) * 72);
    return `color-mix(in srgb, var(--admin-primary) ${String(mix)}%, var(--admin-surface-high))`;
  };

  return (
    <section className={`${insightPanelClassName} p-5`} aria-label="Cross-dimension pairs">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">Source by medium</h2>
        <p className="text-[12px] text-[var(--admin-on-surface-variant)]">{caption}</p>
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[480px] border-collapse text-left text-[12px]">
          <thead>
            <tr className={insightTableHeadClassName}>
              <th className="px-3 py-2">Source</th>
              {topMediums.map((medium) => (
                <th key={medium} className="px-3 py-2 text-right font-data">
                  {medium}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topSources.map((source) => (
              <tr key={source} className={insightTableRowClassName}>
                <td className="px-3 py-2 font-data text-[var(--admin-on-surface)]">{source}</td>
                {topMediums.map((medium) => {
                  const pair = lookup.get(`${source}|${medium}`);
                  if (!pair) {
                    return (
                      <td
                        key={medium}
                        className="px-3 py-2 text-right font-data text-[var(--admin-on-surface-variant)]"
                      >
                        -
                      </td>
                    );
                  }
                  return (
                    <td key={medium} className="px-3 py-2 text-right">
                      <span
                        className="inline-block rounded px-2 py-1 font-data text-[var(--admin-on-surface)]"
                        style={{ backgroundColor: cellTint(pair.sharePct) }}
                        title={`${formatInsightNumber(pair.sharePct, 1)}% of attributed events`}
                      >
                        {formatInsightNumber(pair.events)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-2 md:hidden">
        {pairs.slice(0, 8).map((pair) => (
          <li
            key={`${pair.source}|${pair.medium}`}
            className="flex items-center justify-between rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2"
          >
            <span className="font-data text-[12px] text-[var(--admin-on-surface)]">
              {pair.source} / {pair.medium}
            </span>
            <span className="font-data text-[12px] text-[var(--admin-on-surface-variant)]">
              {formatInsightNumber(pair.events)}{" "}
              <span className="text-[10px]">({formatInsightNumber(pair.sharePct, 1)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SortHeader({
  label,
  active,
  dir,
  align,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  align?: "right" | undefined;
  onClick: () => void;
}) {
  return (
    <th className={`px-4 py-3 ${align === "right" ? "text-right" : ""}`}>
      <button
        type="button"
        className={`inline-flex items-center gap-1 uppercase outline-none hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 ${active ? "text-[var(--admin-on-surface)]" : ""} ${align === "right" ? "ml-auto" : ""}`}
        onClick={onClick}
      >
        {label}
        {active ? (
          <ArrowDown
            className={`h-3.5 w-3.5 ${dir === "asc" ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        ) : null}
      </button>
    </th>
  );
}

function CopyableValue({
  value,
  copiedId,
  rowId,
  onCopy,
}: {
  value: string;
  copiedId: string | null;
  rowId: string;
  onCopy: (value: string, rowId: string) => void;
}) {
  const copied = copiedId === rowId;
  return (
    <button
      type="button"
      className="group inline-flex max-w-full items-center gap-1.5 rounded outline-none hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
      title="Copy value"
      onClick={() => {
        onCopy(value, rowId);
      }}
    >
      <span className="font-data text-sm">{value}</span>
      {copied ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-[var(--admin-success)]" aria-hidden="true" />
      ) : (
        <Copy
          className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

function DimensionBody({
  board,
  dimension,
  segmentId,
  query,
  sortKey,
  sortDir,
  page,
  copiedRowId,
  onToggleSegment,
  onQueryChange,
  onToggleSort,
  onPageChange,
  onCopyValue,
}: {
  board: InsightMarketingAttributionBoard;
  dimension: InsightMarketingAttributionDimension;
  segmentId: string | null;
  query: string;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  page: number;
  copiedRowId: string | null;
  onToggleSegment: (id: string) => void;
  onQueryChange: (value: string) => void;
  onToggleSort: (key: SortKey) => void;
  onPageChange: (page: number) => void;
  onCopyValue: (value: string, rowId: string) => void;
}) {
  const namedIds = useMemo(
    () =>
      new Set(
        dimension.composition
          .filter((segment) => segment.kind === "named")
          .map((segment) => segment.id),
      ),
    [dimension.composition],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return dimension.rows.filter((row) => {
      if (needle && !row.value.toLowerCase().includes(needle)) return false;
      return matchesSegmentFilter(row, segmentId, namedIds);
    });
  }, [dimension.rows, namedIds, query, segmentId]);

  const sorted = useMemo(() => {
    const rows = filtered.slice().sort((left, right) => compareRows(left, right, sortKey));
    if (sortDir === "desc") rows.reverse();
    return rows;
  }, [filtered, sortDir, sortKey]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const maxEvents = Math.max(dimension.maxEvents, 1);
  const maxRevenue = Math.max(...dimension.rows.map((row) => row.revenueMajor), 1);

  const toggleSegment = (id: string) => {
    onToggleSegment(id);
    onPageChange(0);
  };

  return (
    <>
      <section className={`${insightPanelClassName} p-6`} aria-label="Event composition">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
            Event composition by {dimension.label}
          </h2>
          <span className="text-sm text-[var(--admin-on-surface-variant)]">By event share</span>
        </div>
        {board.empty || dimension.composition.length === 0 ? (
          <div className="flex h-24 flex-col items-center justify-center rounded-md border border-dashed border-[var(--admin-outline)] bg-[var(--admin-surface-low)] text-center">
            <p className="text-sm font-medium text-[var(--admin-on-surface)]">No values yet</p>
            <p className="mt-1 text-[12px] text-[var(--admin-on-surface-variant)]">
              Composition appears after the first attributed event.
            </p>
          </div>
        ) : (
          <>
            <div
              className="flex h-8 overflow-hidden rounded-md bg-[var(--admin-surface-high)]"
              role="img"
              aria-label={`Event composition by ${dimension.label.toLowerCase()}`}
            >
              {dimension.composition.map((segment, index) => (
                <button
                  key={segment.id}
                  type="button"
                  title={`${segment.label}: ${segment.sharePct == null ? "-" : `${formatInsightNumber(segment.sharePct, 1)}%`}`}
                  className={`h-full outline-none transition-opacity duration-150 hover:opacity-80 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--admin-primary)]/40 ${segmentId === segment.id ? "opacity-100" : segmentId ? "opacity-40" : ""}`}
                  style={{
                    width: `${String(Math.max(segment.sharePct ?? 0, 2))}%`,
                    backgroundColor: compositionFill(segment, index),
                  }}
                  onClick={() => {
                    toggleSegment(segment.id);
                  }}
                />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-[12px] text-[var(--admin-on-surface-variant)]">
              {dimension.composition.map((segment, index) => (
                <button
                  key={segment.id}
                  type="button"
                  className={`inline-flex items-center gap-1.5 rounded px-1 py-0.5 outline-none hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 ${segmentId === segment.id ? "text-[var(--admin-on-surface)]" : ""} ${segment.kind === "not-set" ? "ml-auto" : ""}`}
                  onClick={() => {
                    toggleSegment(segment.id);
                  }}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: compositionFill(segment, index) }}
                    aria-hidden="true"
                  />
                  <span className={segment.kind === "named" ? "font-data" : ""}>
                    {segment.label}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section
          className={`${insightPanelClassName} p-6 lg:col-span-7`}
          aria-label="Events against revenue"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
              Events against revenue
            </h2>
            <p className="hidden text-[12px] text-[var(--admin-on-surface-variant)] lg:block">
              {dimension.caption}
            </p>
          </div>
          <p className="mb-4 text-[12px] text-[var(--admin-on-surface-variant)] lg:hidden">
            Scatter needs a wider screen.
          </p>
          <div className="hidden h-[400px] flex-col lg:flex">
            {board.empty ? (
              <div className="flex flex-1 items-center justify-center text-sm text-[var(--admin-on-surface-variant)]">
                {dimension.caption}
              </div>
            ) : (
              <ScatterPlot
                dimension={dimension}
                currency={board.currency}
                activeId={segmentId}
                onSelect={toggleSegment}
              />
            )}
          </div>
        </section>
        <section
          className={`${insightPanelClassName} flex h-[400px] flex-col p-6 lg:col-span-5`}
          aria-label="Revenue per event"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
              Revenue per event
            </h2>
            <span className="font-data text-sm text-[var(--admin-on-surface-variant)]">
              Avg:{" "}
              {dimension.revenuePerEvent == null
                ? "-"
                : `${formatInsightMoney(dimension.revenuePerEvent)} ${board.currency}`}
            </span>
          </div>
          <RankedList
            dimension={dimension}
            currency={board.currency}
            unstableThreshold={board.unstableEventThreshold}
            activeId={segmentId}
            onSelect={toggleSegment}
          />
        </section>
      </div>

      <section className={insightPanelClassName} aria-label={`${dimension.label} breakdown`}>
        <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
            {dimension.label} breakdown
          </h2>
          <label className="relative block">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            <span className="sr-only">{`Filter ${dimension.label.toLowerCase()} values`}</span>
            <input
              className="h-8 w-full rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] pl-8 pr-3 text-[12px] text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30 sm:w-48"
              placeholder={`Filter ${dimension.label.toLowerCase()}...`}
              value={query}
              onChange={(event) => {
                onQueryChange(event.target.value);
                onPageChange(0);
              }}
            />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left">
            <thead>
              <tr className={insightTableHeadClassName}>
                <th className="w-10 px-2 py-3" aria-label="Select row" />
                <SortHeader
                  label="Value"
                  active={sortKey === "value"}
                  dir={sortDir}
                  onClick={() => {
                    onToggleSort("value");
                  }}
                />
                <SortHeader
                  label="Events"
                  active={sortKey === "events"}
                  dir={sortDir}
                  align="right"
                  onClick={() => {
                    onToggleSort("events");
                  }}
                />
                <SortHeader
                  label="% events"
                  active={sortKey === "eventShare"}
                  dir={sortDir}
                  align="right"
                  onClick={() => {
                    onToggleSort("eventShare");
                  }}
                />
                <SortHeader
                  label="Attributed rev"
                  active={sortKey === "revenue"}
                  dir={sortDir}
                  align="right"
                  onClick={() => {
                    onToggleSort("revenue");
                  }}
                />
                <SortHeader
                  label="% rev"
                  active={sortKey === "revenueShare"}
                  dir={sortDir}
                  align="right"
                  onClick={() => {
                    onToggleSort("revenueShare");
                  }}
                />
                <SortHeader
                  label="Rev/event"
                  active={sortKey === "rate"}
                  dir={sortDir}
                  align="right"
                  onClick={() => {
                    onToggleSort("rate");
                  }}
                />
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => {
                const eventBar = (row.events / maxEvents) * 100;
                const revenueBar = (row.revenueMajor / maxRevenue) * 100;
                const active = segmentId === row.id;
                return (
                  <tr
                    key={row.id}
                    className={`${insightTableRowClassName} ${active ? "bg-[color-mix(in_srgb,var(--admin-primary)_8%,transparent)]" : ""} ${row.unstable ? "opacity-60" : ""}`}
                  >
                    <td className="px-2 py-2 text-center">
                      <button
                        type="button"
                        className="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                        title={`Copy ${row.value}`}
                        aria-label={`Copy ${row.value}`}
                        onClick={() => {
                          onCopyValue(row.value, row.id);
                        }}
                      >
                        <Square className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                    <td className="relative px-4 py-2 text-[var(--admin-on-surface)]">
                      {active ? (
                        <span
                          className="absolute bottom-0 left-0 top-0 w-0.5 bg-[var(--admin-primary)]"
                          aria-hidden="true"
                        />
                      ) : null}
                      <div className="flex flex-wrap items-center gap-2">
                        <CopyableValue
                          value={row.value}
                          copiedId={copiedRowId}
                          rowId={row.id}
                          onCopy={onCopyValue}
                        />
                        <PatternPill pattern={row.pattern} />
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-data text-sm">{formatInsightNumber(row.events)}</span>
                        <div className="w-16">
                          <ShareBar pct={eventBar} fill={rowFill(row, dimension.composition)} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right font-data text-sm text-[var(--admin-on-surface-variant)]">
                      {row.eventSharePct == null
                        ? "-"
                        : `${formatInsightNumber(row.eventSharePct, 1)}%`}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-data text-sm">
                          {formatInsightMoney(row.revenueMajor)}
                        </span>
                        <div className="w-16">
                          <ShareBar pct={revenueBar} fill={rowFill(row, dimension.composition)} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right font-data text-sm text-[var(--admin-on-surface-variant)]">
                      {row.revenueSharePct == null
                        ? "-"
                        : `${formatInsightNumber(row.revenueSharePct, 1)}%`}
                    </td>
                    <td className="px-4 py-2 text-right font-data text-sm text-[var(--admin-on-surface-variant)]">
                      {row.revenuePerEvent == null ? "-" : formatInsightMoney(row.revenuePerEvent)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <Link
                        href={row.href}
                        prefetch={false}
                        className="inline-flex rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                        aria-label={`Open report for ${row.value}`}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {pageRows.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]"
                    colSpan={8}
                  >
                    No values match this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[var(--admin-border)] px-4 py-3">
          <span className="text-[12px] text-[var(--admin-on-surface-variant)]">
            {sorted.length === 0
              ? `Showing 0 ${dimension.label.toLowerCase()} values`
              : `Showing ${String(safePage * PAGE_SIZE + 1)}-${String(Math.min((safePage + 1) * PAGE_SIZE, sorted.length))} of ${String(sorted.length)} ${dimension.label.toLowerCase()} values`}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
              disabled={safePage <= 0}
              aria-label="Previous page"
              onClick={() => {
                onPageChange(Math.max(safePage - 1, 0));
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
              disabled={safePage >= pageCount - 1}
              aria-label="Next page"
              onClick={() => {
                onPageChange(Math.min(safePage + 1, pageCount - 1));
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

export function MarketingInsightAttributionView({
  slug,
  sectionTitle,
  board,
  loading,
  error,
  onRefresh,
}: Props) {
  const [activeTab, setActiveTab] = useState<DimensionTab>("source");
  const [copiedCsv, setCopiedCsv] = useState(false);
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [segmentId, setSegmentId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("events");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const dimension = board?.dimensions[activeTab] ?? null;
  const csv = useMemo(() => (dimension ? dimensionCsv(dimension) : ""), [activeTab, dimension]);

  const onCopyCsv = () => {
    if (!csv) return;
    void copyText(csv).then((ok) => {
      if (!ok) return;
      setCopiedCsv(true);
      window.setTimeout(() => {
        setCopiedCsv(false);
      }, 1600);
    });
  };

  const onCopyValue = (value: string, rowId: string) => {
    void copyText(value).then((ok) => {
      if (!ok) return;
      setCopiedRowId(rowId);
      window.setTimeout(() => {
        setCopiedRowId(null);
      }, 1600);
    });
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "value" ? "asc" : "desc");
  };

  const toggleSegment = (id: string) => {
    setSegmentId((current) => (current === id ? null : id));
    setPage(0);
  };

  const switchTab = (tab: DimensionTab) => {
    setActiveTab(tab);
    setSegmentId(null);
    setQuery("");
    setSortKey("events");
    setSortDir("desc");
    setPage(0);
  };

  return (
    <div className={insightPageClassName} aria-busy={loading}>
      <nav className={insightBreadcrumbClassName} aria-label="Breadcrumb">
        <Link href="/admin" prefetch={false} className="hover:text-[var(--admin-on-surface)]">
          Admin
        </Link>
        <span className="text-[var(--admin-outline)]" aria-hidden="true">
          /
        </span>
        <Link
          href={ADMIN_INSIGHTS_HREF}
          prefetch={false}
          className="hover:text-[var(--admin-on-surface)]"
        >
          Insights
        </Link>
        <span className="text-[var(--admin-outline)]" aria-hidden="true">
          /
        </span>
        <Link
          href={adminInsightHref(slug)}
          prefetch={false}
          className="hover:text-[var(--admin-on-surface)]"
        >
          {sectionTitle}
        </Link>
        <span className="text-[var(--admin-outline)]" aria-hidden="true">
          /
        </span>
        <span className="font-medium text-[var(--admin-on-surface)]">Attribution</span>
      </nav>

      <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <Link
              href={adminInsightHref(slug)}
              prefetch={false}
              className="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
              aria-label={`Back to ${sectionTitle}`}
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className={insightPageTitleClassName}>{board?.title ?? "Attribution"}</h1>
          </div>
          <p className={insightPageDescClassName}>
            {board?.subtitle ?? "The same events split by source, medium, and UTM campaign."}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 xl:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={insightGhostButtonClassName}
              disabled={!board || !csv}
              onClick={onCopyCsv}
            >
              {copiedCsv ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
              {copiedCsv ? "Copied" : "Copy as CSV"}
            </button>
            <button
              type="button"
              className={insightGhostButtonClassName}
              disabled={!board || !csv}
              onClick={() => {
                if (!csv) return;
                downloadCsv(`marketing-attribution-${activeTab}.csv`, csv);
              }}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export
            </button>
            <Link
              href={board?.salesAttributionHref ?? adminInsightHref("sales-insight")}
              prefetch={false}
              className={insightPrimaryButtonClassName}
            >
              Open Sales Insight
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          {board?.caption ? (
            <p className="max-w-md text-[12px] text-[var(--admin-on-surface-variant)]">
              {board.caption}
            </p>
          ) : null}
        </div>
      </header>

      {error ? <ErrorStrip message={error} onRetry={onRefresh} /> : null}
      {loading && !board ? <AttributionSkeleton /> : null}

      {board ? (
        <>
          <div className="flex items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 text-sm text-[var(--admin-on-surface-variant)]">
            <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p>{board.caveat}</p>
          </div>

          <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="grid grid-cols-1 divide-y divide-[var(--admin-border)] md:grid-cols-12 md:divide-x md:divide-y-0">
              <section className="flex min-w-0 flex-col justify-between gap-2 p-5 md:col-span-4 md:p-6">
                <span className={insightKpiLabelClassName}>Attribution events</span>
                <div className={`${insightKpiValueClassName} break-all`}>
                  {board.empty ? "0" : formatInsightNumber(board.events)}
                </div>
                <p className="text-[12px] leading-4 text-[var(--admin-on-surface-variant)]">
                  {formatInsightNumber(board.events30d)} in the last 30 days
                </p>
              </section>
              <section className="flex min-w-0 flex-col justify-between gap-2 p-5 md:col-span-4 md:p-6">
                <span className={insightKpiLabelClassName}>Attributed revenue</span>
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className={`${insightKpiValueClassName} break-all`}>
                    {board.empty ? "-" : formatInsightMoney(board.attributedRevenue)}
                  </span>
                  <span className="font-data text-[12px] text-[var(--admin-on-surface-variant)]">
                    {board.currency}
                  </span>
                </div>
                <p className="text-[12px] leading-4 text-[var(--admin-on-surface-variant)]">
                  First-touch attributed value
                </p>
              </section>
              <section className="grid min-w-0 grid-cols-3 divide-x divide-[var(--admin-border)] md:col-span-4">
                <div className="flex min-w-0 flex-col justify-between gap-2 p-4 sm:p-5">
                  <span className={`${insightKpiLabelClassName} truncate`}>Sources</span>
                  <div className={`${insightKpiValueClassName} break-all`}>
                    {board.empty ? "0" : formatInsightNumber(board.sourceCount)}
                  </div>
                </div>
                <div className="flex min-w-0 flex-col justify-between gap-2 p-4 sm:p-5">
                  <span className={`${insightKpiLabelClassName} truncate`}>Mediums</span>
                  <div className={`${insightKpiValueClassName} break-all`}>
                    {board.empty ? "0" : formatInsightNumber(board.mediumCount)}
                  </div>
                </div>
                <div className="flex min-w-0 flex-col justify-between gap-2 p-4 sm:p-5">
                  <span className={`${insightKpiLabelClassName} truncate`}>Campaigns</span>
                  <div className={`${insightKpiValueClassName} break-all`}>
                    {board.empty ? "0" : formatInsightNumber(board.campaignCount)}
                  </div>
                  <p className="text-[11px] leading-4 text-[var(--admin-on-surface-variant)]">
                    {board.empty
                      ? "None with revenue"
                      : `${formatInsightNumber(board.campaignsWithRevenue)} with revenue`}
                  </p>
                </div>
              </section>
            </div>
          </div>

          <div
            className={insightSegmentTrackClassName}
            role="tablist"
            aria-label="Attribution dimension"
          >
            {DIMENSION_TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={
                    active ? insightSegmentButtonActiveClassName : insightSegmentButtonClassName
                  }
                  onClick={() => {
                    switchTab(tab.id);
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {board.empty ? (
            <section className={`${insightPanelClassName} px-6 py-16 text-center`}>
              <div className="mx-auto flex max-w-md flex-col items-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--admin-surface-high)]">
                  <Share2
                    className="h-6 w-6 text-[var(--admin-on-surface-variant)]"
                    aria-hidden="true"
                  />
                </div>
                <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                  No attribution events recorded
                </h2>
                <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
                  When visitors convert with tracked UTMs, sources, mediums, and campaigns appear
                  here. Configure forms and capture to start recording attribution events.
                </p>
                <Link
                  href={board.trackingHref}
                  prefetch={false}
                  className={`${insightPrimaryButtonClassName} mt-6`}
                >
                  Configure tracking
                </Link>
              </div>
            </section>
          ) : dimension ? (
            <>
              <DimensionBody
                board={board}
                dimension={dimension}
                segmentId={segmentId}
                query={query}
                sortKey={sortKey}
                sortDir={sortDir}
                page={page}
                copiedRowId={copiedRowId}
                onToggleSegment={toggleSegment}
                onQueryChange={setQuery}
                onToggleSort={toggleSort}
                onPageChange={setPage}
                onCopyValue={onCopyValue}
              />
              {activeTab === "source" ? <CrossDimensionPanel board={board} /> : null}
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
