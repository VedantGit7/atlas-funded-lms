"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  History,
  Inbox,
  Info,
  LineChart,
  Megaphone,
  Receipt,
  RefreshCw,
  Search,
  Table2,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Select, dropdownPanelEnterEndClassName } from "@atlas/design-system";
import { adminInsightHref, adminInsightWidgetHref } from "./admin-insights-catalog";
import type {
  InsightDashboardRange,
  InsightWidget,
  InsightWidgetDetail,
  InsightWidgetRelatedIcon,
  InsightWidgetSplitRow,
} from "./admin-insights-api";
import {
  formatInsightMoney,
  formatInsightNumber,
  formatPeriodLabel,
  formatPeriodLong,
  formatRelativeTime,
  widgetToCsv,
} from "./admin-insights-format";
import {
  INSIGHT_RANGE_OPTIONS,
  insightGhostButtonClassName,
  insightKpiValueClassName,
  insightPageClassName,
  insightPageDescClassName,
  insightPageTitleClassName,
  insightPanelClassName,
  insightPanelHeaderClassName,
  insightPanelTitleClassName,
  insightPrimaryButtonClassName,
  insightSegmentButtonActiveClassName,
  insightSegmentButtonClassName,
  insightSegmentTrackClassName,
  insightSelectContentClassName,
  insightSelectTriggerClassName,
  insightShimmerClassName,
  insightTableHeadClassName,
  insightTableRowClassName,
} from "./admin-insights-shared";

type DetailViz = "line" | "bar" | "table";

type InsightWidgetDetailViewProps = {
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

function formatValue(value: number, money: boolean): string {
  return money ? formatInsightMoney(value) : formatInsightNumber(value, value % 1 === 0 ? 0 : 1);
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

function relatedIcon(icon: InsightWidgetRelatedIcon): ReactNode {
  const className = "h-[18px] w-[18px]";
  switch (icon) {
    case "receipt":
      return <Receipt className={className} aria-hidden="true" />;
    case "payments":
      return <Wallet className={className} aria-hidden="true" />;
    case "forecast":
      return <TrendingUp className={className} aria-hidden="true" />;
    case "wallet":
      return <Wallet className={className} aria-hidden="true" />;
    case "history":
      return <History className={className} aria-hidden="true" />;
    case "warning":
      return <AlertCircle className={className} aria-hidden="true" />;
    case "users":
      return <Users className={className} aria-hidden="true" />;
    case "live":
      return <Activity className={className} aria-hidden="true" />;
    case "campaign":
      return <Megaphone className={className} aria-hidden="true" />;
    case "inbox":
      return <Inbox className={className} aria-hidden="true" />;
    default:
      return <ArrowUpRight className={className} aria-hidden="true" />;
  }
}

function compatibleViz(widget: InsightWidget): DetailViz[] {
  if (widget.defaultViz === "table") return ["table", "bar"];
  if (widget.defaultViz === "kpi") return ["table", "line"];
  if (widget.defaultViz === "bar" || widget.defaultViz === "funnel") {
    return ["bar", "line", "table"];
  }
  return ["line", "bar", "table"];
}

function defaultViz(widget: InsightWidget): DetailViz {
  const options = compatibleViz(widget);
  if (widget.defaultViz === "line" || widget.defaultViz === "area") return "line";
  if (widget.defaultViz === "bar" || widget.defaultViz === "funnel") return "bar";
  if (widget.defaultViz === "table") return "table";
  return options[0] ?? "table";
}

function exportColumns(widget: InsightWidget) {
  return widget.data.columns.filter((column) => column.key !== "href");
}

function Shimmer({ className }: { className: string }) {
  return <div className={`${insightShimmerClassName} ${className}`} />;
}

function WidgetDetailSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-8 lg:grid-cols-12"
      aria-busy="true"
      aria-label="Loading widget"
    >
      <div className="flex h-[600px] flex-col rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 lg:col-span-8">
        <div className="mb-6 flex justify-between">
          <div className="flex gap-4">
            <Shimmer className="h-8 w-24" />
            <Shimmer className="h-8 w-32" />
          </div>
          <Shimmer className="h-8 w-16" />
        </div>
        <Shimmer className="mb-6 w-full flex-1" />
        <Shimmer className="mb-4 h-16 w-full" />
        <div className="flex justify-center gap-6">
          <Shimmer className="h-4 w-20" />
          <Shimmer className="h-4 w-24" />
        </div>
      </div>
      <div className="flex flex-col gap-6 lg:col-span-4">
        <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
          <Shimmer className="mb-4 h-4 w-32" />
          <Shimmer className="mb-2 h-10 w-24" />
          <Shimmer className="h-3 w-40" />
        </div>
        <div className="flex flex-1 flex-col rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
          <Shimmer className="mb-5 h-5 w-40" />
          <div className="space-y-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Shimmer className="h-8 w-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Shimmer className="h-4 w-full" />
                  <Shimmer className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyCanvas({
  title,
  body,
  onAdjust,
}: {
  title: string;
  body: string;
  onAdjust: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-[color-mix(in_srgb,var(--admin-bg)_50%,var(--admin-surface))] px-8 py-12 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]">
        <Activity className="h-10 w-10" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">{body}</p>
      <button type="button" className={`${insightGhostButtonClassName} mt-6`} onClick={onAdjust}>
        Adjust filters
      </button>
    </div>
  );
}

type ChartPoint = {
  label: string;
  longLabel: string;
  values: number[];
};

function buildPoints(widget: InsightWidget, range: InsightDashboardRange): ChartPoint[] {
  const dimensionKey =
    widget.data.dimensions?.[0] ??
    widget.data.columns.find(
      (column) => column.kind === "dimension" || column.kind === "date" || column.kind === "string",
    )?.key ??
    "period";
  const measures =
    widget.data.measures && widget.data.measures.length > 0
      ? widget.data.measures
      : widget.data.columns
          .filter((column) => column.kind === "measure" || column.kind === "number")
          .map((column) => column.key);
  return widget.data.rows.map((row) => {
    const raw = stringValue(cell(row, dimensionKey));
    return {
      label: dimensionKey === "period" ? formatPeriodLabel(raw, range) : raw,
      longLabel: dimensionKey === "period" ? formatPeriodLong(raw) : raw,
      values: measures.map((key) => numericValue(cell(row, key))),
    };
  });
}

function DetailChart({
  points,
  viz,
  average,
  money,
  currency,
}: {
  points: ChartPoint[];
  viz: "line" | "bar";
  average: number | null;
  money: boolean;
  currency?: string | undefined;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [windowRange, setWindowRange] = useState<[number, number]>([
    0,
    Math.max(points.length - 1, 0),
  ]);
  const width = 720;
  const height = 280;
  const padL = 56;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const visible = points.slice(windowRange[0], windowRange[1] + 1);
  const allValues = visible.flatMap((point) => point.values);
  const max = Math.max(...allValues, average ?? 0, 1);
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const yTicks = [1, 0.8, 0.6, 0.4, 0.2, 0];
  const avgY = average != null ? padT + innerH - (average / max) * innerH : null;
  const seriesCount = visible[0]?.values.length ?? 1;

  const xFor = (index: number, count: number) =>
    padL + (count <= 1 ? innerW / 2 : (index / Math.max(count - 1, 1)) * innerW);

  const linePath = (seriesIndex: number) => {
    if (visible.length === 0) return "";
    return visible
      .map((point, index) => {
        const x = xFor(index, visible.length);
        const y = padT + innerH - ((point.values[seriesIndex] ?? 0) / max) * innerH;
        return `${index === 0 ? "M" : "L"} ${String(x)} ${String(y)}`;
      })
      .join(" ");
  };

  return (
    <div className="flex flex-col gap-4">
      <svg
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        className="h-[320px] w-full"
        role="img"
        aria-label={viz === "line" ? "Line chart" : "Bar chart"}
        onMouseLeave={() => {
          setHover(null);
        }}
      >
        {yTicks.map((ratio) => {
          const y = padT + innerH * (1 - ratio);
          return (
            <g key={ratio}>
              <line
                x1={padL}
                x2={width - padR}
                y1={y}
                y2={y}
                stroke="var(--admin-border)"
                strokeDasharray={ratio === 0 ? undefined : "4"}
              />
              <text
                x={padL - 8}
                y={y + 3}
                textAnchor="end"
                fill="var(--admin-on-surface-variant)"
                fontSize={11}
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
              fontSize={11}
              className="font-data"
            >
              {`Avg ${formatValue(average ?? 0, money)}`}
            </text>
          </g>
        ) : null}
        {viz === "line"
          ? Array.from({ length: seriesCount }, (_, seriesIndex) => (
              <path
                key={`line-${String(seriesIndex)}`}
                d={linePath(seriesIndex)}
                fill="none"
                stroke="var(--admin-primary)"
                strokeOpacity={seriesIndex === 0 ? 1 : 0.45}
                strokeWidth={2.25}
                strokeLinecap="round"
              />
            ))
          : visible.map((point, index) => {
              const groupWidth = innerW / Math.max(visible.length, 1);
              const barW = Math.min(28, (groupWidth - 8) / seriesCount);
              return point.values.map((value, seriesIndex) => {
                const barH = (value / max) * innerH;
                const x =
                  padL +
                  index * groupWidth +
                  groupWidth / 2 -
                  (seriesCount * barW) / 2 +
                  seriesIndex * barW;
                return (
                  <rect
                    key={`${point.label}-${String(seriesIndex)}`}
                    x={x}
                    y={padT + innerH - barH}
                    width={barW}
                    height={barH}
                    rx={3}
                    fill="var(--admin-primary)"
                    opacity={seriesIndex === 0 ? 0.95 : 0.5}
                  />
                );
              });
            })}
        {visible.map((point, index) => {
          const x = xFor(index, visible.length);
          const y = padT + innerH - ((point.values[0] ?? 0) / max) * innerH;
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
              {viz === "line" ? (
                <circle
                  cx={x}
                  cy={y}
                  r={active ? 5 : 3.5}
                  fill="var(--admin-surface)"
                  stroke="var(--admin-primary)"
                  strokeWidth={2}
                />
              ) : null}
              {(visible.length <= 8 || index === 0 || index === visible.length - 1 || active) && (
                <text
                  x={x}
                  y={height - 8}
                  textAnchor="middle"
                  fill="var(--admin-on-surface-variant)"
                  fontSize={11}
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
            <rect
              x={Math.min(Math.max(xFor(hover, visible.length) - 70, padL), width - padR - 140)}
              y={Math.max(
                padT + 4,
                padT + innerH - ((visible[hover].values[0] ?? 0) / max) * innerH - 52,
              )}
              width={140}
              height={44}
              rx={4}
              fill="var(--admin-on-surface)"
            />
            <text
              x={Math.min(Math.max(xFor(hover, visible.length), padL + 70), width - padR - 70)}
              y={Math.max(
                padT + 22,
                padT + innerH - ((visible[hover].values[0] ?? 0) / max) * innerH - 34,
              )}
              textAnchor="middle"
              fill="var(--admin-surface)"
              fontSize={10}
              className="font-data"
            >
              {visible[hover].longLabel}
            </text>
            <text
              x={Math.min(Math.max(xFor(hover, visible.length), padL + 70), width - padR - 70)}
              y={Math.max(
                padT + 38,
                padT + innerH - ((visible[hover].values[0] ?? 0) / max) * innerH - 18,
              )}
              textAnchor="middle"
              fill="var(--admin-surface)"
              fontSize={12}
              fontWeight={600}
              className="font-data"
            >
              {`${formatValue(
                visible[hover].values.reduce((sum, value) => sum + value, 0),
                money,
              )}${currency ? ` ${currency}` : ""}`}
            </text>
          </g>
        ) : null}
      </svg>
      {points.length > 4 ? (
        <div className="relative h-8 overflow-hidden rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
          <div
            className="absolute inset-y-0 cursor-ew-resize border-x border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_18%,transparent)]"
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
                  const start = Math.max(0, index - 3);
                  const end = Math.min(points.length - 1, index + 3);
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

function SplitBars({ rows, money }: { rows: InsightWidgetSplitRow[]; money: boolean }) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--admin-on-surface-variant)]">
        This widget has no further breakdown.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, index) => (
        <div key={row.label} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-[var(--admin-on-surface)]">{row.label}</span>
            <span className="font-data text-[var(--admin-on-surface-variant)]">
              {`${String(row.share)}% (${formatValue(row.value, money)})`}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--admin-outline)]">
            <div
              className="h-full rounded-full bg-[var(--admin-primary)]"
              style={{
                width: `${String(row.share)}%`,
                opacity: index === 0 ? 1 : Math.max(0.45, 1 - index * 0.15),
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function UnderlyingTable({
  widget,
  money,
  danger,
}: {
  widget: InsightWidget;
  money: boolean;
  danger: boolean;
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
        const as = stringValue(av);
        const bs = stringValue(bv);
        return sortDir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
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
            className="h-full w-full rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] pl-9 pr-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
          />
        </label>
        <div className="flex items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
          <span>{`${String(filtered.length === 0 ? 0 : safePage * pageSize + 1)}-${String(Math.min((safePage + 1) * pageSize, filtered.length))} of ${String(filtered.length)}`}</span>
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
      <div className="overflow-x-auto rounded border border-[var(--admin-border)] bg-[var(--admin-surface)]">
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
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {slice.map((row, index) => {
              const href = stringValue(cell(row, "href"));
              return (
                <tr
                  key={`${stringValue(cell(row, columns[0]?.key ?? "id"), "row")}-${String(index)}`}
                  className={`${insightTableRowClassName} ${
                    danger
                      ? "bg-[color-mix(in_srgb,var(--admin-danger)_5%,var(--admin-surface))]"
                      : ""
                  }`}
                >
                  {columns.map((column, columnIndex) => {
                    const raw = cell(row, column.key);
                    const measure = column.kind === "measure" || column.kind === "number";
                    const isPeriod = column.key === "period" || column.kind === "date";
                    let display = stringValue(raw, "");
                    if (measure)
                      display = formatValue(
                        numericValue(raw),
                        money || column.key === "amount" || column.key === "revenue",
                      );
                    else if (column.key === "period") display = formatPeriodLong(stringValue(raw));
                    else if (isPeriod && stringValue(raw).includes("T")) {
                      display = formatRelativeTime(stringValue(raw));
                    }
                    const content =
                      columnIndex === 0 && href ? (
                        <Link
                          href={href}
                          prefetch={false}
                          className="text-[var(--admin-primary)] hover:underline"
                        >
                          {display || "View"}
                        </Link>
                      ) : (
                        display
                      );
                    return (
                      <td
                        key={column.key}
                        className={`px-4 py-2 text-sm ${measure ? "text-right font-data" : ""} ${
                          columnIndex === 0 && danger
                            ? "border-l-2 border-[var(--admin-danger)]"
                            : ""
                        }`}
                      >
                        {column.key === "reason" ? (
                          <span className="inline-flex rounded-full border border-[color-mix(in_srgb,var(--admin-danger)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)] px-2 py-0.5 font-data text-[11px] uppercase tracking-wide text-[var(--admin-danger)]">
                            {display}
                          </span>
                        ) : (
                          content
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="font-data text-[11px] text-[var(--admin-on-surface-variant)]">
        {`Showing ${String(slice.length)} of ${String(filtered.length)} rows`}
      </p>
    </div>
  );
}

export function InsightWidgetDetailView({
  slug,
  sectionTitle,
  detail,
  loading,
  error,
  range,
  overlay,
  onRangeChange,
  onRefresh,
}: InsightWidgetDetailViewProps) {
  const router = useRouter();
  const widget = detail?.widget ?? null;
  const vizOptions = widget ? compatibleViz(widget) : (["line", "bar", "table"] as DetailViz[]);
  const [viz, setViz] = useState<DetailViz>(widget ? defaultViz(widget) : "line");
  const [copied, setCopied] = useState<"id" | "csv" | null>(null);
  const [dataOpen, setDataOpen] = useState(true);
  const [pendingSplit, setPendingSplit] = useState("");
  const [activeSplit, setActiveSplit] = useState("");

  useEffect(() => {
    if (!widget) return;
    setViz(defaultViz(widget));
    const firstSplit = detail?.splitOptions[0]?.id ?? "";
    setPendingSplit(firstSplit);
    setActiveSplit(firstSplit);
  }, [detail?.splitOptions, widget]);

  useEffect(() => {
    if (!overlay) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") router.push(adminInsightHref(slug));
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [overlay, router, slug]);

  const money =
    detail?.comparison?.unit === "money" ||
    widget?.id === "monthly-revenue" ||
    widget?.id === "failed-payments";
  const points = widget ? buildPoints(widget, range) : [];
  const empty = widget != null && widget.data.rows.length === 0;
  const closeHref = adminInsightHref(slug);
  const reportHref = widget?.href ?? null;
  const csvRows = widget ? widget.data.rows : [];
  const csvCols = widget ? exportColumns(widget) : [];

  const body = (
    <div
      className={overlay ? "flex min-h-0 flex-1 flex-col overflow-hidden" : insightPageClassName}
    >
      <div
        className={
          overlay ? "flex min-h-0 flex-1 flex-col overflow-y-auto p-6" : "flex flex-col gap-6"
        }
      >
        <div className="flex flex-col gap-4">
          {!overlay ? (
            <nav
              className="flex items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]"
              aria-label="Breadcrumb"
            >
              <Link href="/admin" prefetch={false} className="hover:text-[var(--admin-primary)]">
                Admin
              </Link>
              <span>/</span>
              <Link
                href={adminInsightHref(slug)}
                prefetch={false}
                className="hover:text-[var(--admin-primary)]"
              >
                {sectionTitle}
              </Link>
              <span>/</span>
              <span className="text-[var(--admin-on-surface)]">{widget?.title ?? "Widget"}</span>
            </nav>
          ) : null}

          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                {!overlay ? (
                  <Link
                    href={closeHref}
                    prefetch={false}
                    className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)]"
                    aria-label="Back to dashboard"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Link>
                ) : null}
                <h1 className={insightPageTitleClassName}>{widget?.title ?? "Widget"}</h1>
                {widget ? (
                  <span className="inline-flex items-center gap-1 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-data text-[11px] text-[var(--admin-on-surface-variant)]">
                    {widget.id}
                    <button
                      type="button"
                      title="Copy widget ID"
                      className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]"
                      onClick={() => {
                        void copyText(widget.id).then((ok) => {
                          if (ok) {
                            setCopied("id");
                            window.setTimeout(() => {
                              setCopied(null);
                            }, 1600);
                          }
                        });
                      }}
                    >
                      {copied === "id" ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </span>
                ) : loading ? (
                  <Shimmer className="h-4 w-48" />
                ) : null}
              </div>
              <p className={insightPageDescClassName}>
                {detail?.description ?? (loading ? " " : "Widget detail")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
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
                      {option === "line" ? <LineChart className="h-[18px] w-[18px]" /> : null}
                      {option === "bar" ? <BarChart3 className="h-[18px] w-[18px]" /> : null}
                      {option === "table" ? <Table2 className="h-[18px] w-[18px]" /> : null}
                      {option === "line" ? "Line" : option === "bar" ? "Bar" : "Table"}
                    </button>
                  );
                })}
              </div>
              <Select
                ariaLabel="Date range"
                value={range}
                onValueChange={(value) => {
                  onRangeChange(value as InsightDashboardRange);
                }}
                options={[...INSIGHT_RANGE_OPTIONS]}
                className={`${insightSelectTriggerClassName} h-10 min-w-[10rem]`}
                contentClassName={`${insightSelectContentClassName} ${dropdownPanelEnterEndClassName}`}
              />
              <button
                type="button"
                className={insightGhostButtonClassName}
                disabled={!widget}
                onClick={() => {
                  if (!widget) return;
                  void copyText(widgetToCsv(csvCols, csvRows)).then((ok) => {
                    if (ok) {
                      setCopied("csv");
                      window.setTimeout(() => {
                        setCopied(null);
                      }, 1600);
                    }
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
              {reportHref ? (
                <Link href={reportHref} prefetch={false} className={insightPrimaryButtonClassName}>
                  Open full report
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        {error ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_5%,var(--admin-surface))] px-6 py-10 text-center">
            <AlertCircle className="mb-3 h-6 w-6 text-[var(--admin-danger)]" />
            <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
              Could not load this widget.
            </h3>
            <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">{error}</p>
            <button
              type="button"
              className={`${insightGhostButtonClassName} mt-6`}
              onClick={onRefresh}
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        ) : null}

        {loading && !detail ? <WidgetDetailSkeleton /> : null}

        {detail && widget && !error ? (
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            <div className="flex flex-col gap-6 lg:col-span-8">
              <section className={insightPanelClassName}>
                <header className={insightPanelHeaderClassName}>
                  <div className="flex items-center gap-4">
                    <span className="inline-flex items-center gap-2 text-sm text-[var(--admin-on-surface)]">
                      <span className="h-3 w-3 rounded-full bg-[var(--admin-primary)]" />
                      Current period
                    </span>
                    {detail.average != null ? (
                      <span className="inline-flex items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
                        <span className="h-3 w-3 rounded-full border-2 border-dashed border-[var(--admin-outline)]" />
                        Period average
                      </span>
                    ) : null}
                  </div>
                  {detail.currency ? (
                    <span className="rounded bg-[var(--admin-surface-high)] px-2 py-1 font-data text-[11px] text-[var(--admin-on-surface-variant)]">
                      {`Currency: ${detail.currency}`}
                    </span>
                  ) : null}
                </header>
                <div className="min-h-[360px] p-6">
                  {empty ? (
                    <EmptyCanvas
                      title={`No ${widget.title.toLowerCase()} yet`}
                      body="There is no data recorded for this period. Try a wider date range or check related reports."
                      onAdjust={() => {
                        onRangeChange("12m");
                      }}
                    />
                  ) : viz === "table" ? (
                    <UnderlyingTable
                      widget={widget}
                      money={money}
                      danger={widget.id === "failed-payments"}
                    />
                  ) : (
                    <DetailChart
                      points={points}
                      viz={viz}
                      average={detail.average}
                      money={money}
                      currency={detail.currency}
                    />
                  )}
                </div>
                {detail.insightNote && !empty ? (
                  <div className="flex items-start gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
                    <Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-on-surface-variant)]" />
                    <p className="text-sm text-[var(--admin-on-surface)]">{detail.insightNote}</p>
                  </div>
                ) : null}
              </section>

              {viz !== "table" && !empty ? (
                <section className={insightPanelClassName}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-[var(--admin-surface-high)]"
                    onClick={() => {
                      setDataOpen((open) => !open);
                    }}
                  >
                    <span className={insightPanelTitleClassName}>Show underlying data</span>
                    <ChevronRight
                      className={`h-5 w-5 text-[var(--admin-on-surface-variant)] transition-transform ${dataOpen ? "rotate-90" : ""}`}
                    />
                  </button>
                  {dataOpen ? (
                    <div className="border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
                      <UnderlyingTable
                        widget={widget}
                        money={money}
                        danger={widget.id === "failed-payments"}
                      />
                    </div>
                  ) : null}
                </section>
              ) : null}
            </div>

            <aside className="sticky top-4 flex flex-col gap-6 lg:col-span-4">
              {detail.failureRate ? (
                <section className={`${insightPanelClassName} relative overflow-hidden p-5`}>
                  <div className="absolute inset-y-0 left-0 w-1 bg-[var(--admin-danger)]" />
                  <h3
                    className={`${insightPanelTitleClassName} mb-3 border-b border-[var(--admin-border)] pb-2`}
                  >
                    Failure rate
                  </h3>
                  <div className="flex items-end gap-3">
                    <span
                      className={insightKpiValueClassName}
                    >{`${formatInsightNumber(detail.failureRate.currentPct, 1)}%`}</span>
                    {detail.failureRate.deltaPct != null ? (
                      <span className="mb-1 inline-flex items-center gap-1 rounded border border-[color-mix(in_srgb,var(--admin-danger)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)] px-2 py-1 text-sm text-[var(--admin-danger)]">
                        <ArrowUp className="h-4 w-4" />
                        {`${detail.failureRate.deltaPct > 0 ? "+" : ""}${formatInsightNumber(detail.failureRate.deltaPct, 1)}%`}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
                    {detail.failureRate.note ?? "Share of recorded checkout attempts that failed."}
                  </p>
                </section>
              ) : null}

              {detail.comparison ? (
                <section className={`${insightPanelClassName} p-5`}>
                  <h3
                    className={`${insightPanelTitleClassName} mb-4 flex items-center justify-between`}
                  >
                    Period comparison
                    <TrendingUp className="h-[18px] w-[18px] text-[var(--admin-on-surface-variant)]" />
                  </h3>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-end justify-between border-b border-[var(--admin-border)] pb-2">
                      <span className="inline-flex items-center text-sm text-[var(--admin-on-surface-variant)]">
                        <span className="mr-2 h-2 w-2 rounded-full bg-[var(--admin-primary)]" />
                        {detail.comparison.currentLabel}
                      </span>
                      <span className={insightKpiValueClassName}>
                        {formatValue(detail.comparison.current, detail.comparison.unit === "money")}
                      </span>
                    </div>
                    <div className="flex items-end justify-between border-b border-[var(--admin-border)] pb-2">
                      <span className="inline-flex items-center text-sm text-[var(--admin-on-surface-variant)]">
                        <span className="mr-2 h-2 w-2 rounded-full border border-[var(--admin-outline)]" />
                        {detail.comparison.previousLabel}
                      </span>
                      <span className="font-data text-[28px] font-medium leading-9 text-[var(--admin-on-surface-variant)]">
                        {formatValue(
                          detail.comparison.previous,
                          detail.comparison.unit === "money",
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] p-3">
                      <span className="text-sm font-medium text-[var(--admin-on-surface)]">
                        Net delta
                      </span>
                      <div className="text-right">
                        <div
                          className={`inline-flex items-center font-data text-sm ${
                            detail.comparison.deltaAbs >= 0
                              ? "text-[var(--admin-success)]"
                              : "text-[var(--admin-danger)]"
                          }`}
                        >
                          {detail.comparison.deltaAbs >= 0 ? (
                            <ArrowUp className="mr-1 h-4 w-4" />
                          ) : (
                            <ArrowDown className="mr-1 h-4 w-4" />
                          )}
                          {`${detail.comparison.deltaAbs >= 0 ? "+" : ""}${formatValue(detail.comparison.deltaAbs, detail.comparison.unit === "money")}`}
                        </div>
                        {detail.comparison.deltaPct != null ? (
                          <div
                            className={`mt-1 inline-block rounded border px-1.5 py-0.5 font-data text-[11px] ${
                              detail.comparison.deltaPct >= 0
                                ? "border-[color-mix(in_srgb,var(--admin-success)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,transparent)] text-[var(--admin-success)]"
                                : "border-[color-mix(in_srgb,var(--admin-danger)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)] text-[var(--admin-danger)]"
                            }`}
                          >
                            {`${detail.comparison.deltaPct >= 0 ? "+" : ""}${formatInsightNumber(detail.comparison.deltaPct, 1)}% vs prior`}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </section>
              ) : null}

              <section className={`${insightPanelClassName} p-5`}>
                <h3 className={`${insightPanelTitleClassName} mb-4`}>Deep dive</h3>
                {detail.splitOptions.length === 0 ? (
                  <p className="text-sm text-[var(--admin-on-surface-variant)]">
                    This widget has no further breakdown.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                      Split by dimension
                    </span>
                    <Select
                      ariaLabel="Split dimension"
                      value={pendingSplit}
                      onValueChange={setPendingSplit}
                      options={detail.splitOptions.map((option) => ({
                        value: option.id,
                        label: option.label,
                      }))}
                      className={`${insightSelectTriggerClassName} h-10 w-full`}
                      contentClassName={`${insightSelectContentClassName} ${dropdownPanelEnterEndClassName}`}
                    />
                    <button
                      type="button"
                      className={insightGhostButtonClassName}
                      onClick={() => {
                        setActiveSplit(pendingSplit);
                      }}
                    >
                      Apply split
                    </button>
                    <SplitBars
                      rows={detail.splits[activeSplit] ?? []}
                      money={money && widget.id !== "failed-payments"}
                    />
                  </div>
                )}
              </section>

              <section className={`${insightPanelClassName} p-5`}>
                <h3 className={`${insightPanelTitleClassName} mb-4`}>Related resources</h3>
                {detail.related.length === 0 ? (
                  <p className="text-sm text-[var(--admin-on-surface-variant)]">
                    No linked reports for this widget.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {detail.related.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        prefetch={false}
                        className="group rounded border border-transparent p-3 hover:border-[var(--admin-border)] hover:bg-[var(--admin-surface-low)]"
                      >
                        <div className="mb-1 flex items-center text-sm font-semibold text-[var(--admin-primary)]">
                          <span className="mr-2">{relatedIcon(item.icon)}</span>
                          {item.title}
                        </div>
                        <p className="pl-7 text-sm text-[var(--admin-on-surface-variant)]">
                          {item.description}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (!overlay) return body;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--admin-scrim)] p-8 backdrop-blur-sm">
      <div className="flex h-[90%] w-[95%] max-w-[1600px] flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded border border-[color-mix(in_srgb,var(--admin-primary)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] text-[var(--admin-primary)]">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                {widget?.title ?? "Widget"}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                {detail?.description ?? sectionTitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={adminInsightWidgetHref(slug, widget?.id ?? "")}
              prefetch={false}
              className={insightGhostButtonClassName}
            >
              Open full page
            </Link>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
              aria-label="Close overlay"
              onClick={() => {
                router.push(closeHref);
              }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>
        {body}
      </div>
    </div>
  );
}
