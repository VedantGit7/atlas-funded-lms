"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  AreaChart,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Filter,
  History,
  Inbox,
  Lightbulb,
  LineChart,
  RefreshCw,
  Search,
  Table2,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { inlineExpandClassName } from "../../studio/courses/admin-form-dropdown-shared";
import {
  ADMIN_INSIGHTS_HREF,
  adminInsightContentHealthHref,
  adminInsightFunnelHref,
  adminInsightHref,
  adminInsightWidgetHref,
} from "./admin-insights-catalog";
import type {
  InsightDashboardRange,
  InsightWidget,
  InsightWidgetDetail,
  InsightWidgetRelatedIcon,
  InsightWidgetSplitRow,
} from "./admin-insights-api";
import {
  formatInsightNumber,
  formatPeriodLabel,
  formatPeriodLong,
  formatRelativeTime,
  widgetToCsv,
} from "./admin-insights-format";
import {
  INSIGHT_RANGE_OPTIONS,
  insightBreadcrumbClassName,
  insightGhostButtonClassName,
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
import {
  SCHOOL_VITALS_INVERTED_KPI_IDS,
  SCHOOL_VITALS_PERCENT_KPI_IDS,
} from "./school-vitals-meta";

type DetailViz = "area" | "line" | "bar" | "funnel" | "table";

type SchoolVitalsWidgetDetailViewProps = {
  slug: string;
  sectionTitle: string;
  detail: InsightWidgetDetail | null;
  loading: boolean;
  error: string | null;
  range: InsightDashboardRange;
  overlay: boolean;
  onRangeChange: (range: InsightDashboardRange) => void;
  onRefresh: () => void;
};

function numericValue(value: string | number | null | undefined): number {
  if (typeof value === "number") return value;
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringValue(value: string | number | null | undefined, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function cell(
  row: Record<string, string | number | null> | undefined,
  key: string,
): string | number | null {
  return row?.[key] ?? null;
}

function downloadCsv(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
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

function exportColumns(widget: InsightWidget) {
  return widget.data.columns.filter((column) => column.key !== "href");
}

function measureKey(widget: InsightWidget): string {
  return widget.data.measures?.[0] ?? (widget.id === "engagement-funnel" ? "count" : "value");
}

function widgetHasNoEvents(widget: InsightWidget): boolean {
  if (widget.id === "content-health") return widget.data.rows.length === 0;
  if (widget.data.rows.length === 0) return true;
  const key = measureKey(widget);
  return widget.data.rows.every((row) => numericValue(cell(row, key)) === 0);
}

function isInverted(widgetId: string): boolean {
  return SCHOOL_VITALS_INVERTED_KPI_IDS.has(widgetId);
}

function isPercent(widgetId: string): boolean {
  return SCHOOL_VITALS_PERCENT_KPI_IDS.has(widgetId);
}

function formatMetric(value: number, widgetId: string): string {
  const digits = value % 1 === 0 ? 0 : 1;
  return isPercent(widgetId)
    ? `${formatInsightNumber(value, digits)}%`
    : formatInsightNumber(value, digits);
}

function compatibleViz(widget: InsightWidget): DetailViz[] {
  if (widget.id === "engagement-funnel" || widget.defaultViz === "funnel") {
    return ["funnel", "bar", "table"];
  }
  if (
    widget.id === "content-health" ||
    widget.id === "top-courses" ||
    widget.defaultViz === "table"
  ) {
    return ["table", "bar"];
  }
  if (widget.defaultViz === "kpi") return ["table"];
  if (widget.defaultViz === "area") return ["area", "line", "bar", "table"];
  return ["line", "area", "bar", "table"];
}

function defaultViz(widget: InsightWidget): DetailViz {
  const options = compatibleViz(widget);
  if (widget.defaultViz === "area" && options.includes("area")) return "area";
  if (widget.defaultViz === "funnel" && options.includes("funnel")) return "funnel";
  if (widget.defaultViz === "table" && options.includes("table")) return "table";
  if (widget.defaultViz === "bar" && options.includes("bar")) return "bar";
  if (widget.defaultViz === "line" && options.includes("line")) return "line";
  return options[0] ?? "table";
}

function relatedHref(href: string, range: InsightDashboardRange): string {
  if (!href.includes("/admin/insights/") || href.includes("?")) return href;
  return `${href}?range=${range}`;
}

function Shimmer({ className }: { className: string }) {
  return <div className={`${insightShimmerClassName} ${className}`} />;
}

function deltaToneClass(widgetId: string, delta: number): string {
  if (delta === 0) return "text-[var(--admin-on-surface-variant)]";
  const upIsBad = isInverted(widgetId);
  if (delta > 0) return upIsBad ? "text-[var(--admin-warning)]" : "text-[var(--admin-success)]";
  return upIsBad ? "text-[var(--admin-success)]" : "text-[var(--admin-warning)]";
}

type ChartPoint = {
  label: string;
  longLabel: string;
  value: number;
};

function buildPoints(widget: InsightWidget, range: InsightDashboardRange): ChartPoint[] {
  const key = measureKey(widget);
  return widget.data.rows.map((row) => {
    const raw = stringValue(
      cell(row, "period") ?? cell(row, widget.data.dimensions?.[0] ?? "period"),
    );
    return {
      label: formatPeriodLabel(raw, range),
      longLabel: range === "30d" ? formatPeriodLabel(raw, range) : formatPeriodLong(raw),
      value: numericValue(cell(row, key)),
    };
  });
}

function peakPoint(points: ChartPoint[]): ChartPoint | null {
  if (points.length === 0) return null;
  return points.reduce((best, point) => (point.value > best.value ? point : best));
}

function DetailChart({
  points,
  viz,
  average,
  widgetTitle,
}: {
  points: ChartPoint[];
  viz: "area" | "line" | "bar";
  average: number | null;
  widgetTitle: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [windowRange, setWindowRange] = useState<[number, number]>([
    0,
    Math.max(points.length - 1, 0),
  ]);
  const width = 720;
  const height = 300;
  const padL = 48;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const visible = points.slice(windowRange[0], windowRange[1] + 1);
  const max = Math.max(...visible.map((point) => point.value), average ?? 0, 1);
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const avgY = average != null ? padT + innerH - (average / max) * innerH : null;
  const xFor = (index: number, count: number) =>
    padL + (count <= 1 ? innerW / 2 : (index / Math.max(count - 1, 1)) * innerW);

  const linePath = visible
    .map((point, index) => {
      const x = xFor(index, visible.length);
      const y = padT + innerH - (point.value / max) * innerH;
      return `${index === 0 ? "M" : "L"} ${String(x)} ${String(y)}`;
    })
    .join(" ");
  const areaPath =
    visible.length === 0
      ? ""
      : `${linePath} L ${String(xFor(visible.length - 1, visible.length))} ${String(padT + innerH)} L ${String(xFor(0, visible.length))} ${String(padT + innerH)} Z`;

  return (
    <div className="flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        className="h-[420px] w-full max-md:h-[280px]"
        role="img"
        aria-label={`${widgetTitle} ${viz} chart`}
        onMouseLeave={() => {
          setHover(null);
        }}
      >
        <defs>
          <linearGradient id="sv-detail-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--admin-primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--admin-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[1, 0.5, 0].map((ratio) => {
          const y = padT + innerH * (1 - ratio);
          return (
            <g key={ratio}>
              <line
                x1={padL}
                x2={width - padR}
                y1={y}
                y2={y}
                stroke="var(--admin-border)"
                strokeDasharray={ratio === 0 || ratio === 1 ? undefined : "4 4"}
              />
              <text
                x={padL - 8}
                y={y + 3}
                textAnchor="end"
                fill="var(--admin-on-surface-variant)"
                fontSize={10}
                className="font-data"
              >
                {formatInsightNumber(max * ratio, max >= 100 ? 0 : 1)}
              </text>
            </g>
          );
        })}
        {avgY != null ? (
          <g>
            <line
              x1={padL}
              x2={width - padR}
              y1={avgY}
              y2={avgY}
              stroke="var(--admin-outline)"
              strokeDasharray="5 4"
            />
            <text
              x={width - padR}
              y={avgY - 6}
              textAnchor="end"
              fill="var(--admin-on-surface-variant)"
              fontSize={10}
              className="font-data"
            >
              {`Average ${formatInsightNumber(average ?? 0, (average ?? 0) >= 100 ? 0 : 1)}`}
            </text>
          </g>
        ) : null}
        {viz === "bar"
          ? visible.map((point, index) => {
              const groupWidth = innerW / Math.max(visible.length, 1);
              const barW = Math.min(28, groupWidth - 6);
              const barH = (point.value / max) * innerH;
              const x = padL + index * groupWidth + groupWidth / 2 - barW / 2;
              return (
                <rect
                  key={point.longLabel}
                  x={x}
                  y={padT + innerH - barH}
                  width={barW}
                  height={barH}
                  rx={2}
                  fill="var(--admin-primary)"
                />
              );
            })
          : null}
        {viz === "area" ? <path d={areaPath} fill="url(#sv-detail-area)" /> : null}
        {viz !== "bar" ? (
          <path
            d={linePath}
            fill="none"
            stroke="var(--admin-primary)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {visible.map((point, index) => {
          const x = xFor(index, visible.length);
          const y = padT + innerH - (point.value / max) * innerH;
          const active = hover === index;
          return (
            <g
              key={point.longLabel}
              onMouseEnter={() => {
                setHover(index);
              }}
            >
              <rect
                x={x - innerW / Math.max(visible.length, 1) / 2}
                y={padT}
                width={innerW / Math.max(visible.length, 1)}
                height={innerH}
                fill="transparent"
              />
              {viz !== "bar" ? (
                <circle
                  cx={x}
                  cy={y}
                  r={active ? 5 : 0}
                  fill="var(--admin-surface)"
                  stroke="var(--admin-primary)"
                  strokeWidth={2}
                />
              ) : null}
              {(visible.length <= 6 || index === 0 || index === visible.length - 1 || active) && (
                <text
                  x={x}
                  y={height - 8}
                  textAnchor="middle"
                  fill="var(--admin-on-surface-variant)"
                  fontSize={10}
                  className="font-data"
                >
                  {point.label}
                </text>
              )}
            </g>
          );
        })}
        {hover != null && visible[hover] ? (
          <g>
            <line
              x1={xFor(hover, visible.length)}
              x2={xFor(hover, visible.length)}
              y1={padT}
              y2={padT + innerH}
              stroke="var(--admin-primary)"
              strokeDasharray="3 3"
              opacity={0.45}
            />
            <rect
              x={Math.min(Math.max(xFor(hover, visible.length) - 64, padL), width - padR - 128)}
              y={Math.max(padT + 4, padT + innerH - (visible[hover].value / max) * innerH - 48)}
              width={128}
              height={40}
              rx={4}
              fill="var(--admin-on-surface)"
            />
            <text
              x={Math.min(Math.max(xFor(hover, visible.length), padL + 64), width - padR - 64)}
              y={Math.max(padT + 20, padT + innerH - (visible[hover].value / max) * innerH - 32)}
              textAnchor="middle"
              fill="var(--admin-surface)"
              fontSize={10}
              className="font-data"
            >
              {visible[hover].longLabel}
            </text>
            <text
              x={Math.min(Math.max(xFor(hover, visible.length), padL + 64), width - padR - 64)}
              y={Math.max(padT + 36, padT + innerH - (visible[hover].value / max) * innerH - 16)}
              textAnchor="middle"
              fill="var(--admin-surface)"
              fontSize={12}
              fontWeight={600}
              className="font-data"
            >
              {formatInsightNumber(visible[hover].value)}
            </text>
          </g>
        ) : null}
      </svg>
      {points.length > 8 ? (
        <div className="relative hidden h-8 overflow-hidden rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] md:block">
          <div
            className="absolute inset-y-0 border-x border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_18%,transparent)]"
            style={{
              left: `${String((windowRange[0] / Math.max(points.length - 1, 1)) * 100)}%`,
              right: `${String(100 - (windowRange[1] / Math.max(points.length - 1, 1)) * 100)}%`,
            }}
            aria-hidden="true"
          />
          <div className="relative z-[1] flex h-full">
            {points.map((point, index) => (
              <button
                key={`brush-${point.longLabel}`}
                type="button"
                className="h-full flex-1 outline-none focus-visible:bg-[color-mix(in_srgb,var(--admin-primary)_20%,transparent)]"
                aria-label={`Focus ${point.longLabel}`}
                onClick={() => {
                  const start = Math.max(0, index - 4);
                  const end = Math.min(points.length - 1, index + 4);
                  setWindowRange([start, end]);
                }}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FunnelPanel({ widget }: { widget: InsightWidget }) {
  const rows = widget.data.rows;
  const total = rows.reduce((sum, row) => sum + numericValue(cell(row, "count")), 0);
  const max = Math.max(...rows.map((row) => numericValue(cell(row, "count"))), 1);
  return (
    <div className="flex flex-col gap-4">
      {rows.map((row, index) => {
        const count = numericValue(cell(row, "count"));
        const share = total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
        const width = `${String(Math.max((count / max) * 100, count > 0 ? 6 : 0))}%`;
        return (
          <div
            key={`${stringValue(cell(row, "stage"))}-${String(index)}`}
            className="grid grid-cols-12 items-center gap-3"
          >
            <div className="col-span-12 truncate text-sm text-[var(--admin-on-surface)] md:col-span-3 md:text-right">
              {stringValue(cell(row, "stage"))}
            </div>
            <div className="col-span-12 h-6 overflow-hidden rounded-sm bg-[var(--admin-surface-variant)] md:col-span-6">
              <div
                className="h-full rounded-sm bg-[var(--admin-primary)]"
                style={{ width, opacity: Math.max(0.5, 1 - index * 0.08) }}
              />
            </div>
            <div className="col-span-12 flex justify-between font-data text-sm text-[var(--admin-on-surface)] md:col-span-3">
              <span>{formatInsightNumber(count)}</span>
              <span className="text-[var(--admin-on-surface-variant)]">
                {formatInsightNumber(share, share % 1 === 0 ? 0 : 1)}%
              </span>
            </div>
          </div>
        );
      })}
      {widget.footnote ? (
        <p className="border-t border-[var(--admin-border)] pt-4 text-xs text-[var(--admin-on-surface-variant)]">
          {widget.footnote}
        </p>
      ) : null}
    </div>
  );
}

function SplitTable({ rows }: { rows: InsightWidgetSplitRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--admin-on-surface-variant)]">
        This widget has no further breakdown.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            <th className={`${insightTableHeadClassName} px-4 py-3`}>Label</th>
            <th className={`${insightTableHeadClassName} px-4 py-3 text-right`}>Value</th>
            <th className={`${insightTableHeadClassName} px-4 py-3`}>Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.label} className={insightTableRowClassName}>
              <td className="px-4 py-2 text-sm font-medium text-[var(--admin-on-surface)]">
                {row.label}
              </td>
              <td className="px-4 py-2 text-right font-data text-sm">
                {formatInsightNumber(row.value)}
              </td>
              <td className="px-4 py-2">
                <div className="flex items-center gap-3">
                  <span className="w-12 font-data text-xs text-[var(--admin-on-surface-variant)]">
                    {formatInsightNumber(row.share, row.share % 1 === 0 ? 0 : 1)}%
                  </span>
                  <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-[var(--admin-surface-variant)]">
                    <div
                      className="h-full rounded-full bg-[var(--admin-primary)]"
                      style={{
                        width: `${String(row.share)}%`,
                        opacity: index === 0 ? 1 : Math.max(0.4, 1 - index * 0.15),
                      }}
                    />
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContentHealthTable({ widget }: { widget: InsightWidget }) {
  const [query, setQuery] = useState("");
  const [tone, setTone] = useState<"all" | "warning" | "neutral">("all");
  const [sortKey, setSortKey] = useState("count");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let next = widget.data.rows;
    if (needle) {
      next = next.filter((row) =>
        ["signal", "consequence", "tone"].some((key) =>
          stringValue(cell(row, key)).toLowerCase().includes(needle),
        ),
      );
    }
    if (tone !== "all") {
      next = next.filter((row) => stringValue(cell(row, "tone"), "neutral") === tone);
    }
    return [...next].sort((a, b) => {
      const av = cell(a, sortKey);
      const bv = cell(b, sortKey);
      const an = typeof av === "number" ? av : Number(av);
      const bn = typeof bv === "number" ? bv : Number(bv);
      if (Number.isFinite(an) && Number.isFinite(bn)) {
        return sortDir === "asc" ? an - bn : bn - an;
      }
      return sortDir === "asc"
        ? stringValue(av).localeCompare(stringValue(bv))
        : stringValue(bv).localeCompare(stringValue(av));
    });
  }, [query, sortDir, sortKey, tone, widget.data.rows]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "count" ? "desc" : "asc");
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] px-4 py-3">
        <label className="relative h-9 w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="Search signals..."
            className="h-full w-full rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] pl-9 pr-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
          />
        </label>
        <div className={insightSegmentTrackClassName} role="group" aria-label="Filter by tone">
          {(["all", "warning", "neutral"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={
                tone === option
                  ? insightSegmentButtonActiveClassName
                  : insightSegmentButtonClassName
              }
              onClick={() => {
                setTone(option);
              }}
            >
              {option === "all" ? "All" : option === "warning" ? "Warning" : "Neutral"}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              {(
                [
                  { key: "signal", label: "Signal", numeric: false },
                  { key: "count", label: "Count", numeric: true },
                  { key: "tone", label: "Consequence", numeric: false },
                  { key: "href", label: "Action", numeric: false },
                ] as const
              ).map((column) => (
                <th
                  key={column.key}
                  className={`${insightTableHeadClassName} px-4 py-3 ${column.numeric ? "text-right" : ""}`}
                >
                  {column.key === "href" ? (
                    column.label
                  ) : (
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1 ${column.numeric ? "w-full justify-end" : ""}`}
                      onClick={() => {
                        toggleSort(column.key);
                      }}
                    >
                      {column.label}
                      {sortKey === column.key ? (
                        sortDir === "desc" ? (
                          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                        )
                      ) : null}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const warning =
                stringValue(cell(row, "tone")) === "warning" &&
                numericValue(cell(row, "count")) > 0;
              const href = stringValue(cell(row, "href"));
              return (
                <tr
                  key={`${stringValue(cell(row, "signal"))}-${String(index)}`}
                  className={`${insightTableRowClassName} group`}
                >
                  <td className="px-4 py-2 text-sm font-medium text-[var(--admin-on-surface)]">
                    {stringValue(cell(row, "signal"))}
                  </td>
                  <td className="px-4 py-2 text-right font-data text-sm">
                    {formatInsightNumber(numericValue(cell(row, "count")))}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex rounded border px-2 py-0.5 font-data text-[11px] uppercase tracking-wide ${
                        warning
                          ? "border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,transparent)] text-[var(--admin-warning)]"
                          : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]"
                      }`}
                    >
                      {warning ? "Warning" : "Neutral"}
                    </span>
                    <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                      {stringValue(cell(row, "consequence"))}
                    </p>
                  </td>
                  <td className="px-4 py-2">
                    {href ? (
                      <Link
                        href={href}
                        prefetch={false}
                        className="inline-flex items-center gap-1 text-sm font-medium text-[var(--admin-primary)] opacity-100 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                      >
                        Review
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex h-12 items-center justify-between border-t border-[var(--admin-border)] px-4 text-xs text-[var(--admin-on-surface-variant)]">
        <span>{`Showing ${String(rows.length)} of ${String(widget.data.rows.length)} signals`}</span>
      </div>
    </div>
  );
}

function UnderlyingTable({
  widget,
  range,
}: {
  widget: InsightWidget;
  range: InsightDashboardRange;
}) {
  const columns = exportColumns(widget);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const pageSize = 12;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let rows = widget.data.rows;
    if (needle) {
      rows = rows.filter((row) =>
        columns.some((column) => stringValue(cell(row, column.key)).toLowerCase().includes(needle)),
      );
    }
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = cell(a, sortKey);
        const bv = cell(b, sortKey);
        const an = typeof av === "number" ? av : Number(av);
        const bn = typeof bv === "number" ? bv : Number(bv);
        if (Number.isFinite(an) && Number.isFinite(bn)) {
          return sortDir === "asc" ? an - bn : bn - an;
        }
        return sortDir === "asc"
          ? stringValue(av).localeCompare(stringValue(bv))
          : stringValue(bv).localeCompare(stringValue(av));
      });
    }
    return rows;
  }, [columns, query, sortDir, sortKey, widget.data.rows]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const slice = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="relative h-9 w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Filter records..."
            className="h-full w-full rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] pl-9 pr-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
          />
        </label>
        <div className="flex items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
          <span>
            {`${String(filtered.length === 0 ? 0 : safePage * pageSize + 1)}-${String(Math.min((safePage + 1) * pageSize, filtered.length))} of ${String(filtered.length)}`}
          </span>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded border border-[var(--admin-border)] disabled:opacity-40"
            disabled={safePage === 0}
            onClick={() => {
              setPage((current) => Math.max(0, current - 1));
            }}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded border border-[var(--admin-border)] disabled:opacity-40"
            disabled={safePage >= pageCount - 1}
            onClick={() => {
              setPage((current) => current + 1);
            }}
            aria-label="Next page"
          >
            <ChevronRight className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
      <div className="overflow-x-auto rounded border border-[var(--admin-border)]">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr>
              {columns.map((column) => {
                const measure = column.kind === "measure" || column.kind === "number";
                return (
                  <th key={column.key} className={`${insightTableHeadClassName} px-4 py-2.5`}>
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1 ${measure ? "w-full justify-end" : ""}`}
                      onClick={() => {
                        if (sortKey === column.key) {
                          setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
                        } else {
                          setSortKey(column.key);
                          setSortDir(measure ? "desc" : "asc");
                        }
                      }}
                    >
                      {column.label}
                      <span className="font-data text-[10px] font-normal uppercase tracking-wide text-[var(--admin-outline)]">
                        {column.kind}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {slice.map((row, index) => (
              <tr
                key={`${stringValue(cell(row, columns[0]?.key ?? "id"), "row")}-${String(index)}`}
                className={insightTableRowClassName}
              >
                {columns.map((column) => {
                  const raw = cell(row, column.key);
                  const measure = column.kind === "measure" || column.kind === "number";
                  let display = stringValue(raw, "");
                  if (measure)
                    display = formatInsightNumber(
                      numericValue(raw),
                      numericValue(raw) % 1 === 0 ? 0 : 1,
                    );
                  else if (column.key === "period")
                    display = formatPeriodLabel(stringValue(raw), range);
                  return (
                    <td
                      key={column.key}
                      className={`px-4 py-2 text-sm ${measure ? "text-right font-data" : "text-[var(--admin-on-surface)]"}`}
                    >
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyCanvas({
  title,
  body,
  href,
  hrefLabel,
}: {
  title: string;
  body: string;
  href?: string | null;
  hrefLabel?: string;
}) {
  return (
    <div className="flex min-h-[256px] flex-col items-center justify-center rounded border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-8 py-12 text-center">
      <Activity className="mb-4 h-12 w-12 text-[var(--admin-outline)]" aria-hidden="true" />
      <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">{body}</p>
      {href ? (
        <Link
          href={href}
          prefetch={false}
          className="mt-4 text-sm font-semibold text-[var(--admin-primary)] hover:underline"
        >
          {hrefLabel ?? "Open related report"}
        </Link>
      ) : null}
    </div>
  );
}

function WidgetDetailSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-6 lg:grid-cols-12"
      aria-busy="true"
      aria-label="Loading widget detail"
    >
      <div className="flex flex-col gap-6 lg:col-span-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6"
            >
              <Shimmer className="mb-4 h-4 w-1/2" />
              <Shimmer className="h-8 w-3/4" />
            </div>
          ))}
        </div>
        <div className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <Shimmer className="mb-6 h-5 w-1/4" />
          <Shimmer className="h-[320px] w-full" />
        </div>
        <div className="overflow-hidden rounded border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] px-4 last:border-b-0"
            >
              <Shimmer className="h-4 w-1/4" />
              <Shimmer className="h-4 w-1/5" />
              <Shimmer className="ml-auto h-4 w-1/6" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4 lg:col-span-4">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
          >
            <Shimmer className="mb-3 h-4 w-1/2" />
            <Shimmer className="h-6 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

function relatedGlyph(icon: InsightWidgetRelatedIcon): ReactNode {
  const className = "h-[18px] w-[18px]";
  switch (icon) {
    case "forecast":
      return <TrendingUp className={className} aria-hidden="true" />;
    case "history":
      return <History className={className} aria-hidden="true" />;
    case "warning":
      return <AlertCircle className={className} aria-hidden="true" />;
    case "users":
      return <Users className={className} aria-hidden="true" />;
    case "live":
      return <Activity className={className} aria-hidden="true" />;
    case "inbox":
      return <Inbox className={className} aria-hidden="true" />;
    case "receipt":
    case "payments":
    case "wallet":
    case "campaign":
      return <ArrowUpRight className={className} aria-hidden="true" />;
  }
}

export function SchoolVitalsWidgetDetailView({
  slug,
  sectionTitle,
  detail,
  loading,
  error,
  range,
  overlay,
  onRangeChange,
  onRefresh,
}: SchoolVitalsWidgetDetailViewProps) {
  const router = useRouter();
  const widget = detail?.widget ?? null;
  const vizOptions = widget ? compatibleViz(widget) : (["line", "area", "table"] as DetailViz[]);
  const [viz, setViz] = useState<DetailViz>(widget ? defaultViz(widget) : "line");
  const [copied, setCopied] = useState<"id" | "csv" | null>(null);
  const [dataOpen, setDataOpen] = useState(false);
  const [activeSplit, setActiveSplit] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!widget) return;
    setViz(defaultViz(widget));
    setActiveSplit(detail?.splitOptions[0]?.id ?? "");
  }, [detail?.splitOptions, widget]);

  useEffect(() => {
    if (!overlay) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") router.push(adminInsightHref(slug));
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [overlay, router, slug]);

  const empty = widget != null && widgetHasNoEvents(widget);
  const closeHref = adminInsightHref(slug);
  const reportHref =
    widget?.href ??
    detail?.related.find((item) => item.href.startsWith("/admin/reports"))?.href ??
    null;
  const csvCols = widget ? exportColumns(widget) : [];
  const csvRows = widget ? widget.data.rows : [];
  const points = widget ? buildPoints(widget, range) : [];
  const peak = peakPoint(points);
  const inverted = widget ? isInverted(widget.id) : false;
  const headlineValue =
    detail?.comparison?.current ??
    (widget == null
      ? 0
      : widget.defaultViz === "kpi"
        ? numericValue(cell(widget.data.rows[0], "value"))
        : widget.id === "daily-active-users" && points.length > 0
          ? Math.round(points.reduce((sum, point) => sum + point.value, 0) / points.length)
          : points.reduce((sum, point) => sum + point.value, 0) ||
            numericValue(cell(widget.data.rows[0], measureKey(widget))));
  const hideHeadlineStrip = widget?.id === "content-health";

  const canvas = (
    <div
      className={overlay ? "flex min-h-0 flex-1 flex-col overflow-y-auto" : insightPageClassName}
    >
      {!overlay ? (
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
          <span className="font-medium text-[var(--admin-on-surface)]">
            {widget?.title ?? "Widget"}
          </span>
        </nav>
      ) : null}

      <header
        className={`flex flex-col justify-between gap-4 xl:flex-row xl:items-start ${overlay ? "px-6 pt-5" : ""}`}
      >
        {!overlay ? (
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={closeHref}
                prefetch={false}
                className="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                aria-label="Back to School Vitals"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className={insightPageTitleClassName}>
                {widget?.title ?? (loading ? "Loading widget" : "Widget")}
              </h1>
              {widget ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 font-data text-[10px] text-[var(--admin-on-surface-variant)] outline-none hover:border-[var(--admin-outline)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                  onClick={() => {
                    void copyText(widget.id).then((ok) => {
                      if (!ok) return;
                      setCopied("id");
                      window.setTimeout(() => {
                        setCopied(null);
                      }, 1600);
                    });
                  }}
                >
                  {widget.id}
                  {copied === "id" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
              ) : loading ? (
                <Shimmer className="h-4 w-32" />
              ) : null}
            </div>
            <p className={insightPageDescClassName}>
              {detail?.description ?? (loading ? " " : "Widget detail")}
            </p>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <div className={insightSegmentTrackClassName} role="group" aria-label="Visualization">
            {vizOptions.map((option) => {
              const active = viz === option;
              return (
                <button
                  key={option}
                  type="button"
                  className={
                    active ? insightSegmentButtonActiveClassName : insightSegmentButtonClassName
                  }
                  onClick={() => {
                    setViz(option);
                  }}
                >
                  {option === "area" ? <AreaChart className="h-4 w-4" aria-hidden="true" /> : null}
                  {option === "line" ? <LineChart className="h-4 w-4" aria-hidden="true" /> : null}
                  {option === "bar" ? <BarChart3 className="h-4 w-4" aria-hidden="true" /> : null}
                  {option === "funnel" ? <Filter className="h-4 w-4" aria-hidden="true" /> : null}
                  {option === "table" ? <Table2 className="h-4 w-4" aria-hidden="true" /> : null}
                  {option === "area"
                    ? "Area"
                    : option === "line"
                      ? "Line"
                      : option === "bar"
                        ? "Bar"
                        : option === "funnel"
                          ? "Funnel"
                          : "Table"}
                </button>
              );
            })}
          </div>
          <div className={insightSegmentTrackClassName} role="radiogroup" aria-label="Date range">
            {INSIGHT_RANGE_OPTIONS.map((option) => {
              const active = option.value === range;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={
                    active ? insightSegmentButtonActiveClassName : insightSegmentButtonClassName
                  }
                  onClick={() => {
                    onRangeChange(option.value);
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className={insightGhostButtonClassName}
            disabled={!widget}
            onClick={() => {
              if (!widget) return;
              void copyText(widgetToCsv(csvCols, csvRows)).then((ok) => {
                if (!ok) return;
                setCopied("csv");
                window.setTimeout(() => {
                  setCopied(null);
                }, 1600);
              });
            }}
          >
            {copied === "csv" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            Copy as CSV
          </button>
          <button
            type="button"
            className={insightGhostButtonClassName}
            disabled={!widget}
            onClick={() => {
              if (!widget) return;
              downloadCsv(`${widget.id}-${range}.csv`, widgetToCsv(csvCols, csvRows));
            }}
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          {widget?.id === "engagement-funnel" ? (
            <Link
              href={`${adminInsightFunnelHref(slug)}?range=${range}`}
              prefetch={false}
              className={insightPrimaryButtonClassName}
            >
              Open full funnel
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          ) : widget?.id === "content-health" ? (
            <Link
              href={`${adminInsightContentHealthHref(slug)}?range=${range}`}
              prefetch={false}
              className={insightPrimaryButtonClassName}
            >
              Open full content health
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          ) : reportHref ? (
            <Link href={reportHref} prefetch={false} className={insightPrimaryButtonClassName}>
              Open the full report
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </header>

      <div className={overlay ? "flex min-h-0 flex-1 flex-col gap-6 p-6" : "flex flex-col gap-6"}>
        {error ? (
          <div className="flex items-start gap-4 rounded border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-5">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]" />
            <div>
              <h3 className="text-base font-semibold text-[var(--admin-danger)]">
                Could not load this widget
              </h3>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">{error}</p>
              <button
                type="button"
                className={`${insightGhostButtonClassName} mt-4`}
                onClick={onRefresh}
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            </div>
          </div>
        ) : null}

        {loading && !detail ? <WidgetDetailSkeleton /> : null}

        {detail && widget && !error ? (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            <div className="flex flex-col gap-6 lg:col-span-8">
              {hideHeadlineStrip ? null : (
                <section className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="border-b border-[var(--admin-border)] p-5 sm:border-r xl:border-b-0">
                      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                        {detail.comparison?.currentLabel ?? "Selected window"}
                      </span>
                      <div
                        className={`${insightKpiValueClassName} ${inverted ? "text-[var(--admin-warning)]" : ""}`}
                      >
                        {empty
                          ? "0"
                          : formatMetric(detail.comparison?.current ?? headlineValue, widget.id)}
                      </div>
                      {empty ? (
                        <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                          No data in selected window
                        </p>
                      ) : inverted ? (
                        <p className="mt-1 text-[10px] text-[var(--admin-warning)]">
                          Higher is worse
                        </p>
                      ) : null}
                    </div>
                    <div className="border-b border-[var(--admin-border)] p-5 sm:border-r-0 xl:border-b-0 xl:border-r">
                      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                        {detail.comparison?.previousLabel ?? "Previous window"}
                      </span>
                      {detail.comparison ? (
                        <div className="font-data text-[22px] text-[var(--admin-on-surface-variant)] line-through opacity-70">
                          {formatMetric(detail.comparison.previous, widget.id)}
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--admin-on-surface-variant)]">
                          No comparable previous period
                        </p>
                      )}
                    </div>
                    <div className="border-b border-[var(--admin-border)] p-5 sm:border-r xl:border-b-0">
                      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                        Change
                      </span>
                      {detail.comparison ? (
                        <div
                          className={`flex items-center gap-2 font-data text-sm ${deltaToneClass(widget.id, detail.comparison.deltaAbs)}`}
                        >
                          {detail.comparison.deltaAbs >= 0 ? (
                            <ArrowUp className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <ArrowDown className="h-4 w-4" aria-hidden="true" />
                          )}
                          <span>
                            {`${detail.comparison.deltaAbs >= 0 ? "+" : ""}${formatMetric(detail.comparison.deltaAbs, widget.id)}`}
                          </span>
                          {detail.comparison.deltaPct != null ? (
                            <span className="rounded border border-[color-mix(in_srgb,currentColor_20%,transparent)] bg-[color-mix(in_srgb,currentColor_10%,transparent)] px-1.5 py-0.5 text-[11px]">
                              {`${detail.comparison.deltaPct >= 0 ? "+" : ""}${formatInsightNumber(detail.comparison.deltaPct, 1)}%`}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--admin-on-surface-variant)]">
                          No comparable previous period
                        </p>
                      )}
                    </div>
                    <div className="p-5">
                      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                        {peak ? `Peak (${peak.longLabel})` : "Average"}
                      </span>
                      <div className="font-data text-[22px] text-[var(--admin-on-surface)]">
                        {peak
                          ? formatInsightNumber(peak.value)
                          : detail.average != null
                            ? formatInsightNumber(detail.average, detail.average >= 100 ? 0 : 1)
                            : "n/a"}
                      </div>
                      {detail.average != null && peak ? (
                        <p className="mt-1 text-[11px] uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                          {`Average ${formatInsightNumber(detail.average, detail.average >= 100 ? 0 : 1)}`}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </section>
              )}

              {widget.id === "engagement-funnel" ? (
                <section className={`${insightPanelClassName} p-5`}>
                  <div className="mb-4 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
                    These are event counts over the window, not a single cohort moving through
                    steps. A learner can appear in several stages, and later stages are not subsets
                    of earlier ones.
                  </div>
                  {empty ? (
                    <EmptyCanvas
                      title="No learning events recorded in this window"
                      body="Engagement funnels need session data to render stage counts."
                      href={reportHref}
                    />
                  ) : viz === "table" ? (
                    <SplitTable
                      rows={widget.data.rows.map((row) => {
                        const count = numericValue(cell(row, "count"));
                        const total =
                          widget.data.rows.reduce(
                            (sum, item) => sum + numericValue(cell(item, "count")),
                            0,
                          ) || 1;
                        return {
                          label: stringValue(cell(row, "stage")),
                          value: count,
                          share: Math.round((count / total) * 1000) / 10,
                        };
                      })}
                    />
                  ) : viz === "bar" || viz === "funnel" ? (
                    <FunnelPanel widget={widget} />
                  ) : (
                    <DetailChart
                      points={points}
                      viz={viz === "area" ? "area" : "line"}
                      average={detail.average}
                      widgetTitle={widget.title}
                    />
                  )}
                </section>
              ) : widget.id === "content-health" ? (
                empty ? (
                  <EmptyCanvas
                    title="No content health signals yet"
                    body="Dormant courses, inactivity, and moderation load will list here."
                  />
                ) : (
                  <ContentHealthTable widget={widget} />
                )
              ) : (
                <section className={insightPanelClassName}>
                  <header className="flex items-center justify-between border-b border-[var(--admin-border)] px-5 py-3">
                    <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                      {viz === "table" ? "Records" : "Trend"}
                    </h2>
                    {detail.average != null && viz !== "table" ? (
                      <div className="flex items-center gap-3 text-xs text-[var(--admin-on-surface-variant)]">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-3 w-3 rounded-full border border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_20%,transparent)]" />
                          Current period
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block w-3 border-t border-dashed border-[var(--admin-outline)]" />
                          Average
                        </span>
                      </div>
                    ) : null}
                  </header>
                  <div className="p-5">
                    {empty ? (
                      <EmptyCanvas
                        title="No learning events recorded in this window"
                        body="Activity appears here once learners interact with modules."
                        href={reportHref}
                      />
                    ) : viz === "table" ? (
                      <UnderlyingTable widget={widget} range={range} />
                    ) : viz === "funnel" ? (
                      <FunnelPanel widget={widget} />
                    ) : (
                      <DetailChart
                        points={points}
                        viz={viz === "bar" ? "bar" : viz === "area" ? "area" : "line"}
                        average={detail.average}
                        widgetTitle={widget.title}
                      />
                    )}
                  </div>
                  {detail.insightNote && !empty ? (
                    <div className="flex items-start gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-4">
                      <Lightbulb
                        className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-primary)]"
                        aria-hidden="true"
                      />
                      <p className="text-sm text-[var(--admin-on-surface-variant)]">
                        <span className="font-medium text-[var(--admin-on-surface)]">
                          Insight:{" "}
                        </span>
                        {detail.insightNote}
                      </p>
                    </div>
                  ) : null}
                </section>
              )}

              {widget.id === "engagement-funnel" && !empty ? (
                <section className={insightPanelClassName}>
                  <header className="border-b border-[var(--admin-border)] px-5 py-3">
                    <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                      Stage splits
                    </h2>
                  </header>
                  <SplitTable
                    rows={widget.data.rows.map((row) => {
                      const count = numericValue(cell(row, "count"));
                      const total =
                        widget.data.rows.reduce(
                          (sum, item) => sum + numericValue(cell(item, "count")),
                          0,
                        ) || 1;
                      return {
                        label: stringValue(cell(row, "stage")),
                        value: count,
                        share: Math.round((count / total) * 1000) / 10,
                      };
                    })}
                  />
                </section>
              ) : null}

              {widget.id !== "content-health" &&
              widget.id !== "engagement-funnel" &&
              viz !== "table" ? (
                <section className={insightPanelClassName}>
                  {detail.splitOptions.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-[var(--admin-on-surface-variant)]">
                      This widget has no further breakdown.
                    </p>
                  ) : (
                    <>
                      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-3">
                        <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                          Split by
                        </h2>
                        <div
                          className={insightSegmentTrackClassName}
                          role="group"
                          aria-label="Split dimension"
                        >
                          {detail.splitOptions.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              className={
                                activeSplit === option.id
                                  ? insightSegmentButtonActiveClassName
                                  : insightSegmentButtonClassName
                              }
                              onClick={() => {
                                setActiveSplit(option.id);
                              }}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </header>
                      <SplitTable rows={detail.splits[activeSplit] ?? []} />
                    </>
                  )}
                </section>
              ) : null}

              {viz !== "table" && widget.id !== "content-health" && !empty ? (
                <div>
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] py-3 text-sm font-medium text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                    onClick={() => {
                      setDataOpen((open) => !open);
                    }}
                    aria-expanded={dataOpen}
                  >
                    <Table2 className="h-4 w-4" aria-hidden="true" />
                    {dataOpen ? "Hide underlying data" : "Show underlying data"}
                  </button>
                  {dataOpen ? (
                    <div
                      className={`mt-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 ${inlineExpandClassName}`}
                    >
                      <UnderlyingTable widget={widget} range={range} />
                      <button
                        type="button"
                        className="mt-3 text-sm font-medium text-[var(--admin-primary)] hover:underline"
                        onClick={() => {
                          void copyText(widgetToCsv(csvCols, csvRows));
                        }}
                      >
                        Copy as CSV
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <aside className="flex flex-col gap-4 lg:col-span-4">
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                Related metrics
              </h2>
              {detail.related.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-10 text-center">
                  <Inbox className="mb-2 h-6 w-6 text-[var(--admin-outline)]" aria-hidden="true" />
                  <p className="text-sm text-[var(--admin-on-surface-variant)]">
                    No related insights found.
                  </p>
                </div>
              ) : (
                detail.related.map((item) => (
                  <Link
                    key={item.href}
                    href={relatedHref(item.href, range)}
                    prefetch={false}
                    className="group flex items-start justify-between gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 outline-none transition-colors hover:border-[var(--admin-outline)] hover:bg-[var(--admin-surface-low)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)] group-hover:bg-[var(--admin-primary-container)] group-hover:text-[var(--admin-primary)]">
                        {relatedGlyph(item.icon)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--admin-on-surface)] group-hover:text-[var(--admin-primary)]">
                          {item.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-[var(--admin-on-surface-variant)]">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <ChevronRight
                      className="mt-1 h-5 w-5 shrink-0 text-[var(--admin-on-surface-variant)]"
                      aria-hidden="true"
                    />
                  </Link>
                ))
              )}
              <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Widget metadata
                </h3>
                <dl className="flex flex-col gap-2 font-data text-[11px] text-[var(--admin-on-surface-variant)]">
                  <div className="flex justify-between border-b border-[var(--admin-border)] pb-1">
                    <dt>ID</dt>
                    <dd className="text-[var(--admin-on-surface)]">{widget.id}</dd>
                  </div>
                  <div className="flex justify-between border-b border-[var(--admin-border)] pb-1">
                    <dt>Range</dt>
                    <dd className="text-[var(--admin-on-surface)]">{range}</dd>
                  </div>
                  <div className="flex justify-between pb-1">
                    <dt>Last refreshed</dt>
                    <dd className="text-[var(--admin-on-surface)]">
                      {formatRelativeTime(detail.generatedAt)}
                    </dd>
                  </div>
                </dl>
              </section>
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (!overlay) return canvas;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--admin-scrim)] p-4 backdrop-blur-sm motion-safe:animate-[admin-fade-in_0.15s_ease-out] md:p-8"
      role="presentation"
      onClick={() => {
        router.push(closeHref);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sv-widget-overlay-title"
        className="flex h-[calc(100dvh-64px)] w-full max-w-[1440px] flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_8px_32px_color-mix(in_srgb,var(--admin-on-surface)_12%,transparent)]"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--admin-border)] px-6 py-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-[var(--admin-primary-container)] text-[var(--admin-primary)]">
              <Activity className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2
                id="sv-widget-overlay-title"
                className="truncate text-xl font-semibold tracking-tight text-[var(--admin-on-surface)]"
              >
                {widget?.title ?? "Widget"}
              </h2>
              <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                {detail?.description ?? sectionTitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={insightGhostButtonClassName}
              disabled={!widget}
              onClick={() => {
                if (!widget) return;
                downloadCsv(`${widget.id}-${range}.csv`, widgetToCsv(csvCols, csvRows));
              }}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <Link
              href={`${adminInsightWidgetHref(slug, widget?.id ?? "")}?range=${range}`}
              prefetch={false}
              className={insightGhostButtonClassName}
            >
              Open full page
            </Link>
            <button
              ref={closeButtonRef}
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
              aria-label="Close overlay"
              onClick={() => {
                router.push(closeHref);
              }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>
        {canvas}
      </div>
    </div>
  );
}
