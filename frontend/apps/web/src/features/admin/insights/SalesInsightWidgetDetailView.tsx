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
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
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
  adminInsightAttributionHref,
  adminInsightHref,
  adminInsightOpportunityHref,
  adminInsightPipelineHref,
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
  formatInsightMoney,
  formatInsightMoneyWithCode,
  formatInsightNumber,
  formatPeriodLabel,
  formatPeriodLong,
  formatRelativeTime,
  widgetToCsv,
} from "./admin-insights-format";
import {
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
  SALES_FIXED_WINDOW_CAPTION,
  SALES_INSIGHT_FUNNEL_IDS,
  SALES_INSIGHT_INVERTED_WIDGET_IDS,
  SALES_INSIGHT_MONEY_WIDGET_IDS,
  SALES_INSIGHT_PERCENT_KPI_IDS,
  SALES_INSIGHT_TABLE_IDS,
  SALES_PIPELINE_EMPTY_CAPTION,
} from "./sales-insight-meta";

type DetailViz = "area" | "line" | "bar" | "funnel" | "table";

type SalesInsightWidgetDetailViewProps = {
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
  if (widget.id === "top-products" || widget.id === "top-sources") return "revenue";
  if (widget.id === "failed-payments") return "amount";
  return widget.data.measures?.[0] ?? (SALES_INSIGHT_FUNNEL_IDS.has(widget.id) ? "count" : "value");
}

function isMoneyWidget(widgetId: string): boolean {
  return SALES_INSIGHT_MONEY_WIDGET_IDS.has(widgetId);
}

function isInverted(widgetId: string): boolean {
  return SALES_INSIGHT_INVERTED_WIDGET_IDS.has(widgetId);
}

function isPercent(widgetId: string): boolean {
  return SALES_INSIGHT_PERCENT_KPI_IDS.has(widgetId);
}

function isFunnel(widgetId: string): boolean {
  return SALES_INSIGHT_FUNNEL_IDS.has(widgetId);
}

function isTableWidget(widgetId: string): boolean {
  return SALES_INSIGHT_TABLE_IDS.has(widgetId);
}

function moneyColumn(key: string): boolean {
  return key === "revenue" || key === "amount" || key === "value";
}

function widgetHasNoEvents(widget: InsightWidget): boolean {
  if (widget.data.rows.length === 0) return true;
  if (isFunnel(widget.id)) {
    return numericValue(cell(widget.data.rows[0], "count")) <= 0;
  }
  if (isPercent(widget.id) && widget.footnote === SALES_PIPELINE_EMPTY_CAPTION) return true;
  const key = measureKey(widget);
  return widget.data.rows.every((row) => numericValue(cell(row, key)) === 0);
}

function formatMetric(value: number, widgetId: string, currency?: string): string {
  if (isPercent(widgetId)) return `${formatInsightNumber(value)}%`;
  if (isMoneyWidget(widgetId)) return formatInsightMoneyWithCode(value, currency);
  const digits = value % 1 === 0 ? 0 : 1;
  return formatInsightNumber(value, digits);
}

function formatCompact(value: number, money: boolean): string {
  if (money) {
    if (value >= 1_000_000) return `${formatInsightNumber(value / 1_000_000, 1)}M`;
    if (value >= 1000) return `${formatInsightNumber(value / 1000, 0)}k`;
    return formatInsightNumber(value, value >= 100 ? 0 : 1);
  }
  return formatInsightNumber(value, value >= 100 ? 0 : 1);
}

function compatibleViz(widget: InsightWidget): DetailViz[] {
  if (isFunnel(widget.id) || widget.defaultViz === "funnel") return ["funnel", "bar", "table"];
  if (widget.id === "opportunity-pool") return ["table", "bar"];
  if (isTableWidget(widget.id) || widget.defaultViz === "table") return ["table", "bar"];
  if (widget.defaultViz === "kpi") return ["table"];
  if (widget.defaultViz === "area") return ["area", "line", "bar", "table"];
  if (widget.defaultViz === "bar") return ["bar", "table"];
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

function pipelineCounts(widget: InsightWidget): {
  visited: number;
  started: number;
  enrolled: number;
} {
  const rows = widget.data.rows;
  return {
    visited: numericValue(cell(rows[0], "count")),
    started: numericValue(cell(rows[1], "count")),
    enrolled: numericValue(cell(rows[2], "count")),
  };
}

function stepConversion(from: number, to: number): string {
  if (from <= 0) return "-";
  return `${formatInsightNumber(Math.round((to / from) * 100))}%`;
}

function overallConversion(visited: number, enrolled: number): string {
  if (visited <= 0) return "-";
  return `${formatInsightNumber(Math.round((enrolled / visited) * 100))}%`;
}

function collapseSplits(rows: InsightWidgetSplitRow[], limit = 4): InsightWidgetSplitRow[] {
  if (rows.length <= limit) return rows;
  const head = rows.slice(0, limit - 1);
  const tail = rows.slice(limit - 1);
  const value = tail.reduce((sum, row) => sum + row.value, 0);
  const share = Math.round(tail.reduce((sum, row) => sum + row.share, 0) * 10) / 10;
  return [...head, { label: "Other (aggregated)", value, share }];
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
  const labelKey =
    widget.data.dimensions?.[0] ??
    widget.data.columns.find(
      (column) =>
        column.kind === "dimension" || column.kind === "string" || column.key === "period",
    )?.key ??
    "period";
  return widget.data.rows.map((row) => {
    const raw = stringValue(cell(row, "period") ?? cell(row, labelKey));
    const isPeriod = Boolean(cell(row, "period")) || labelKey === "period";
    return {
      label: isPeriod ? formatPeriodLabel(raw, range) : raw,
      longLabel: isPeriod
        ? range === "30d"
          ? formatPeriodLabel(raw, range)
          : formatPeriodLong(raw)
        : raw,
      value: numericValue(
        cell(row, key === "count" && cell(row, "value") != null ? "value" : key) ??
          cell(row, "revenue"),
      ),
    };
  });
}

function DetailChart({
  points,
  viz,
  average,
  widgetTitle,
  money,
  currency,
}: {
  points: ChartPoint[];
  viz: "area" | "line" | "bar";
  average: number | null;
  widgetTitle: string;
  money: boolean;
  currency?: string | undefined;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [windowRange, setWindowRange] = useState<[number, number]>([
    0,
    Math.max(points.length - 1, 0),
  ]);
  const width = 800;
  const height = 300;
  const padL = 52;
  const padR = 16;
  const padT = 16;
  const padB = 32;
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
          <linearGradient id="si-detail-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--admin-primary)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--admin-primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[1, 0.75, 0.5, 0.25, 0].map((ratio) => {
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
                {formatCompact(max * ratio, money)}
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
              {`Average ${formatCompact(average ?? 0, money)}${money && currency ? ` ${currency}` : ""}`}
            </text>
          </g>
        ) : null}
        {viz === "bar"
          ? visible.map((point, index) => {
              const groupWidth = innerW / Math.max(visible.length, 1);
              const barW = Math.min(36, groupWidth - 8);
              const barH = (point.value / max) * innerH;
              const x = padL + index * groupWidth + groupWidth / 2 - barW / 2;
              const active = hover === index;
              return (
                <rect
                  key={point.longLabel}
                  x={x}
                  y={padT + innerH - barH}
                  width={barW}
                  height={barH}
                  rx={2}
                  fill="var(--admin-primary)"
                  opacity={active || hover == null ? 1 : 0.45}
                />
              );
            })
          : null}
        {viz === "area" ? <path d={areaPath} fill="url(#si-detail-area)" /> : null}
        {viz !== "bar" ? (
          <path
            d={linePath}
            fill="none"
            stroke="var(--admin-primary)"
            strokeWidth={2.5}
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
                  r={active ? 5 : 4}
                  fill={active ? "var(--admin-primary)" : "var(--admin-surface)"}
                  stroke="var(--admin-primary)"
                  strokeWidth={2}
                />
              ) : null}
              {(visible.length <= 13 || index === 0 || index === visible.length - 1 || active) && (
                <text
                  x={x}
                  y={height - 8}
                  textAnchor="middle"
                  fill={active ? "var(--admin-primary)" : "var(--admin-on-surface-variant)"}
                  fontSize={10}
                  fontWeight={active ? 600 : 400}
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
              stroke="var(--admin-outline)"
              strokeDasharray="2 2"
            />
            <rect
              x={Math.min(Math.max(xFor(hover, visible.length) - 72, padL), width - padR - 144)}
              y={Math.max(padT + 4, padT + innerH - (visible[hover].value / max) * innerH - 58)}
              width={144}
              height={52}
              rx={4}
              fill="var(--admin-on-surface)"
            />
            <text
              x={Math.min(Math.max(xFor(hover, visible.length), padL + 72), width - padR - 72)}
              y={Math.max(padT + 20, padT + innerH - (visible[hover].value / max) * innerH - 42)}
              textAnchor="middle"
              fill="var(--admin-surface)"
              fontSize={10}
              className="font-data"
            >
              {visible[hover].longLabel}
            </text>
            <text
              x={Math.min(Math.max(xFor(hover, visible.length), padL + 72), width - padR - 72)}
              y={Math.max(padT + 36, padT + innerH - (visible[hover].value / max) * innerH - 26)}
              textAnchor="middle"
              fill="var(--admin-surface)"
              fontSize={12}
              fontWeight={600}
              className="font-data"
            >
              {money
                ? formatInsightMoneyWithCode(visible[hover].value, currency)
                : formatInsightNumber(visible[hover].value)}
            </text>
            {(() => {
              const previous = hover > 0 ? visible[hover - 1] : undefined;
              if (!previous || previous.value <= 0) return null;
              const pct = Math.round(
                ((visible[hover].value - previous.value) / previous.value) * 100,
              );
              return (
                <text
                  x={Math.min(Math.max(xFor(hover, visible.length), padL + 72), width - padR - 72)}
                  y={Math.max(
                    padT + 50,
                    padT + innerH - (visible[hover].value / max) * innerH - 12,
                  )}
                  textAnchor="middle"
                  fill="var(--admin-surface)"
                  fontSize={10}
                  className="font-data"
                >
                  {`${pct >= 0 ? "+" : ""}${formatInsightNumber(pct)}% vs prev.`}
                </text>
              );
            })()}
          </g>
        ) : null}
      </svg>
      {points.length > 8 ? (
        <div className="relative mx-1 hidden h-8 overflow-hidden rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] md:block">
          <div
            className="absolute inset-y-0 border-x border-[var(--admin-outline)] bg-[color-mix(in_srgb,var(--admin-primary)_16%,transparent)]"
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

function FunnelConnector({ rate }: { rate: string }) {
  return (
    <div className="relative z-0 -my-1 flex w-full justify-center">
      <svg fill="none" height="40" viewBox="0 0 120 40" width="120" aria-hidden="true">
        <path d="M0 0L30 40H90L120 0H0Z" fill="var(--admin-border)" fillOpacity="0.55" />
        <path
          d="M0 0L30 40M120 0L90 40"
          stroke="var(--admin-outline)"
          strokeDasharray="2 2"
          strokeWidth="1"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="z-[1] rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-2 py-0.5 font-data text-[11px] text-[var(--admin-on-surface-variant)]">
          {rate}
        </span>
      </div>
    </div>
  );
}

function FunnelPanel({ widget }: { widget: InsightWidget }) {
  const { visited, started, enrolled } = pipelineCounts(widget);
  const empty = visited <= 0;
  const stages: Array<{ label: string; count: number; width: string; terminal: boolean }> = [
    { label: "Visited", count: visited, width: "90%", terminal: false },
    { label: "Started diagnostic", count: started, width: "75%", terminal: false },
    { label: "Enrolled", count: enrolled, width: "60%", terminal: true },
  ];
  const connectors = [stepConversion(visited, started), stepConversion(started, enrolled)];
  const dropoffs = [
    { count: null as number | null, rate: "-" },
    { count: Math.max(visited - started, 0), rate: stepConversion(visited, started) },
    { count: Math.max(started - enrolled, 0), rate: stepConversion(started, enrolled) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="relative flex min-h-[280px] w-full flex-col items-center justify-center py-4">
        {stages.map((stage, index) => (
          <div key={stage.label} className="flex w-full flex-col items-center">
            <div
              className={`relative z-[1] flex h-16 w-full items-center justify-between px-6 transition-colors ${
                stage.terminal
                  ? "rounded-b-lg border border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))]"
                  : index === 0
                    ? "rounded-t-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)]"
                    : "border border-[var(--admin-border)] bg-[var(--admin-surface-low)]"
              }`}
              style={{ maxWidth: stage.width }}
            >
              <span
                className={`text-sm font-medium ${
                  stage.terminal ? "text-[var(--admin-primary)]" : "text-[var(--admin-on-surface)]"
                }`}
              >
                {stage.label}
              </span>
              <span
                className={`font-data text-sm ${
                  stage.terminal
                    ? "font-semibold text-[var(--admin-primary)]"
                    : "text-[var(--admin-on-surface)]"
                }`}
              >
                {empty ? "-" : formatInsightNumber(stage.count)}
              </span>
            </div>
            {index < connectors.length ? (
              <FunnelConnector rate={empty ? "-" : (connectors[index] ?? "-")} />
            ) : null}
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--admin-border)]">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-[var(--admin-surface-low)]">
              <th className={`${insightTableHeadClassName} px-4 py-3`}>Stage name</th>
              <th className={`${insightTableHeadClassName} px-4 py-3 text-right`}>Count</th>
              <th className={`${insightTableHeadClassName} px-4 py-3 text-right`}>
                Conversion rate
              </th>
              <th className={`${insightTableHeadClassName} px-4 py-3 text-right`}>Drop-off</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage, index) => {
              const dropoff = dropoffs.at(index) ?? { count: null, rate: "-" };
              return (
                <tr
                  key={stage.label}
                  className={`${insightTableRowClassName} ${
                    stage.terminal
                      ? "bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                      : ""
                  }`}
                >
                  <td
                    className={`relative px-4 py-2 text-sm font-medium ${
                      stage.terminal
                        ? "text-[var(--admin-primary)]"
                        : "text-[var(--admin-on-surface)]"
                    }`}
                  >
                    {stage.terminal ? (
                      <span
                        className="absolute inset-y-0 left-0 w-0.5 bg-[var(--admin-primary)]"
                        aria-hidden="true"
                      />
                    ) : null}
                    {stage.label}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-data text-sm ${
                      stage.terminal ? "font-semibold text-[var(--admin-primary)]" : ""
                    }`}
                  >
                    {empty ? "-" : formatInsightNumber(stage.count)}
                  </td>
                  <td className="px-4 py-2 text-right font-data text-sm">
                    {empty ? "-" : dropoff.rate}
                  </td>
                  <td className="px-4 py-2 text-right font-data text-sm text-[var(--admin-danger)]">
                    {empty || dropoff.count == null ? "-" : formatInsightNumber(dropoff.count)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {widget.footnote ? (
        <p className="text-xs text-[var(--admin-on-surface-variant)]">{widget.footnote}</p>
      ) : null}
    </div>
  );
}

function SplitTable({
  rows,
  money,
  currency,
}: {
  rows: InsightWidgetSplitRow[];
  money?: boolean | undefined;
  currency?: string | undefined;
}) {
  const display = collapseSplits(rows);
  if (display.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-[var(--admin-on-surface-variant)]">
        This widget has no further breakdown.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            <th className={`${insightTableHeadClassName} px-6 py-3`}>Label</th>
            <th className={`${insightTableHeadClassName} px-6 py-3 text-right`}>
              {money && currency ? `Value (${currency})` : "Value"}
            </th>
            <th className={`${insightTableHeadClassName} px-6 py-3`}>Share</th>
          </tr>
        </thead>
        <tbody>
          {display.map((row, index) => {
            const aggregated = row.label.startsWith("Other");
            return (
              <tr key={row.label} className={insightTableRowClassName}>
                <td
                  className={`px-6 py-2 text-sm ${
                    aggregated
                      ? "text-[var(--admin-on-surface-variant)]"
                      : "font-medium text-[var(--admin-on-surface)]"
                  }`}
                >
                  {row.label}
                </td>
                <td className="px-6 py-2 text-right font-data text-sm">
                  {money
                    ? formatInsightMoney(row.value)
                    : formatInsightNumber(row.value, row.value % 1 === 0 ? 0 : 1)}
                </td>
                <td className="px-6 py-2">
                  <div className="flex items-center gap-3">
                    <span className="w-10 text-right font-data text-xs text-[var(--admin-on-surface-variant)]">
                      {`${formatInsightNumber(row.share, row.share % 1 === 0 ? 0 : 1)}%`}
                    </span>
                    <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-[var(--admin-surface-variant)]">
                      <div
                        className={`h-full rounded-full ${
                          aggregated ? "bg-[var(--admin-outline)]" : "bg-[var(--admin-primary)]"
                        }`}
                        style={{
                          width: `${String(row.share)}%`,
                          opacity: aggregated
                            ? 0.5
                            : index === 0
                              ? 1
                              : Math.max(0.4, 1 - index * 0.15),
                        }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SortMark({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return null;
  return dir === "desc" ? (
    <ArrowDown className="h-3.5 w-3.5 text-[var(--admin-primary)]" aria-hidden="true" />
  ) : (
    <ArrowUp className="h-3.5 w-3.5 text-[var(--admin-primary)]" aria-hidden="true" />
  );
}

function DataTable({ widget, currency }: { widget: InsightWidget; currency?: string | undefined }) {
  const columns = exportColumns(widget);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string>(
    columns.find(
      (column) => column.key === "revenue" || column.key === "amount" || column.kind === "measure",
    )?.key ??
      columns[0]?.key ??
      "title",
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const pageSize = 8;
  const totalMeasure = measureKey(widget);
  const grandTotal =
    widget.data.rows.reduce((sum, row) => sum + numericValue(cell(row, totalMeasure)), 0) || 1;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const keys = columns.map((column) => column.key);
    let rows = widget.data.rows;
    if (needle) {
      rows = rows.filter((row) =>
        keys.some((key) => stringValue(cell(row, key)).toLowerCase().includes(needle)),
      );
    }
    return [...rows].sort((a, b) => {
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
  }, [columns, query, sortDir, sortKey, widget.data.rows]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const slice = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const failed = widget.id === "failed-payments";
  const showShare = widget.id === "top-products" || widget.id === "top-sources";

  function toggleSort(key: string, measure: boolean) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(measure ? "desc" : "asc");
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
        <label className="relative h-9 w-72 max-w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder={widget.id === "top-products" ? "Search products..." : "Search records..."}
            className="h-full w-full rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] pl-9 pr-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
          />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="bg-[var(--admin-surface-low)]">
              {columns.map((column) => {
                const measure = column.kind === "measure" || column.kind === "number";
                return (
                  <th
                    key={column.key}
                    className={`${insightTableHeadClassName} px-4 py-3 ${measure ? "text-right" : ""}`}
                  >
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1 ${measure ? "w-full justify-end" : ""}`}
                      onClick={() => {
                        toggleSort(column.key, measure);
                      }}
                    >
                      {column.label}
                      <SortMark active={sortKey === column.key} dir={sortDir} />
                    </button>
                  </th>
                );
              })}
              {showShare ? (
                <th className={`${insightTableHeadClassName} px-4 py-3 text-right`}>Share</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {slice.map((row, index) => {
              const href = stringValue(cell(row, "href"));
              const share =
                Math.round((numericValue(cell(row, totalMeasure)) / grandTotal) * 1000) / 10;
              return (
                <tr
                  key={`${stringValue(cell(row, columns[0]?.key ?? "id"), "row")}-${String(index)}`}
                  className={`${insightTableRowClassName} group ${
                    failed
                      ? "bg-[color-mix(in_srgb,var(--admin-danger)_5%,var(--admin-surface))]"
                      : ""
                  }`}
                >
                  {columns.map((column, columnIndex) => {
                    const raw = cell(row, column.key);
                    const measure = column.kind === "measure" || column.kind === "number";
                    const money = moneyColumn(column.key) && isMoneyWidget(widget.id);
                    let display = stringValue(raw, "");
                    if (measure && money)
                      display = formatInsightMoneyWithCode(numericValue(raw), currency);
                    else if (measure) display = formatInsightNumber(numericValue(raw));
                    else if (
                      column.key === "period" ||
                      column.key === "created" ||
                      column.kind === "date"
                    ) {
                      display = formatPeriodLong(stringValue(raw));
                    }
                    const lead = columnIndex === 0;
                    return (
                      <td
                        key={column.key}
                        className={`px-4 py-2 text-sm ${
                          measure ? "text-right font-data" : "text-[var(--admin-on-surface)]"
                        } ${lead && failed ? "border-l-2 border-[var(--admin-danger)]" : ""} ${
                          lead && widget.id === "top-products"
                            ? "font-medium text-[var(--admin-primary)]"
                            : ""
                        }`}
                      >
                        {lead && href ? (
                          <Link
                            href={href}
                            prefetch={false}
                            className="outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                          >
                            {display || "Untitled"}
                          </Link>
                        ) : (
                          display
                        )}
                      </td>
                    );
                  })}
                  {showShare ? (
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-data text-sm">{`${formatInsightNumber(share, share % 1 === 0 ? 0 : 1)}%`}</span>
                        <div className="h-[3px] w-16 overflow-hidden rounded-full bg-[var(--admin-surface-variant)]">
                          <div
                            className="h-full bg-[var(--admin-primary)]"
                            style={{ width: `${String(share)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex h-12 items-center justify-between border-t border-[var(--admin-border)] px-4 text-xs text-[var(--admin-on-surface-variant)]">
        <span>
          {filtered.length === 0
            ? "No matching rows"
            : `Showing ${String(safePage * pageSize + 1)}-${String(Math.min((safePage + 1) * pageSize, filtered.length))} of ${String(filtered.length)}`}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:opacity-40"
            disabled={safePage === 0}
            onClick={() => {
              setPage((current) => Math.max(0, current - 1));
            }}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-[18px] w-[18px]" />
          </button>
          {Array.from({ length: pageCount }, (_, index) => (
            <button
              key={index}
              type="button"
              className={`flex h-8 w-8 items-center justify-center rounded text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 ${
                index === safePage
                  ? "bg-[var(--admin-primary-container)] font-medium text-[var(--admin-primary)]"
                  : "text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
              }`}
              onClick={() => {
                setPage(index);
              }}
              aria-current={index === safePage ? "page" : undefined}
            >
              {index + 1}
            </button>
          ))}
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:opacity-40"
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
    </div>
  );
}

function UnderlyingTable({
  widget,
  range,
  currency,
}: {
  widget: InsightWidget;
  range: InsightDashboardRange;
  currency?: string | undefined;
}) {
  const columns = exportColumns(widget);
  return (
    <div className="overflow-x-auto rounded border border-[var(--admin-border)]">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr>
            {columns.map((column) => {
              const measure = column.kind === "measure" || column.kind === "number";
              return (
                <th
                  key={column.key}
                  className={`${insightTableHeadClassName} px-4 py-2.5 ${measure ? "text-right" : ""}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {column.label}
                    <span className="font-data text-[10px] font-normal uppercase tracking-wide text-[var(--admin-outline)]">
                      {column.kind}
                    </span>
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {widget.data.rows.map((row, index) => (
            <tr
              key={`${stringValue(cell(row, columns[0]?.key ?? "id"), "row")}-${String(index)}`}
              className={insightTableRowClassName}
            >
              {columns.map((column) => {
                const raw = cell(row, column.key);
                const measure = column.kind === "measure" || column.kind === "number";
                const money = moneyColumn(column.key) && isMoneyWidget(widget.id);
                let display = stringValue(raw, "");
                if (measure && money)
                  display = formatInsightMoneyWithCode(numericValue(raw), currency);
                else if (measure)
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
      <div className="border-t border-[var(--admin-border)] px-4 py-2 text-xs text-[var(--admin-on-surface-variant)]">
        {`${String(widget.data.rows.length)} ${widget.data.rows.length === 1 ? "row" : "rows"}`}
      </div>
    </div>
  );
}

function EmptyCanvas({
  title,
  body,
  href,
  hrefLabel,
  icon,
  success,
}: {
  title: string;
  body: string;
  href?: string | null | undefined;
  hrefLabel?: string | undefined;
  icon?: ReactNode | undefined;
  success?: boolean | undefined;
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-b-xl bg-[color-mix(in_srgb,var(--admin-page)_50%,transparent)] px-8 py-12 text-center">
      <div
        className={`mb-4 ${success ? "text-[var(--admin-success)]" : "text-[var(--admin-outline)]"}`}
      >
        {icon ?? <Activity className="h-12 w-12" aria-hidden="true" />}
      </div>
      <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">{body}</p>
      {href ? (
        <Link
          href={href}
          prefetch={false}
          className={`${insightGhostButtonClassName} mt-6 border-[var(--admin-primary)] text-[var(--admin-primary)] hover:bg-[var(--admin-primary-container)]`}
        >
          {hrefLabel ?? "Open related report"}
        </Link>
      ) : null}
    </div>
  );
}

function WidgetDetailSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-6" aria-busy="true" aria-label="Loading widget detail">
      <div className="col-span-12 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
          >
            <Shimmer className="mb-3 h-3 w-1/3" />
            <Shimmer className="h-8 w-1/2" />
          </div>
        ))}
      </div>
      <div className="col-span-12 flex flex-col gap-6 lg:col-span-8">
        <div className="flex h-[400px] flex-col rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <div className="mb-6 flex items-center justify-between border-b border-[var(--admin-border)] pb-4">
            <Shimmer className="h-5 w-40" />
            <div className="flex gap-2">
              <Shimmer className="h-8 w-16" />
              <Shimmer className="h-8 w-16" />
            </div>
          </div>
          <div className="flex flex-1 items-end gap-4">
            {["60%", "80%", "40%", "90%", "30%", "70%", "50%"].map((height) => (
              <div
                key={height}
                className={insightShimmerClassName}
                style={{ height, width: "100%", borderRadius: "2px 2px 0 0" }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="col-span-12 flex flex-col gap-6 lg:col-span-4">
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="border-b border-[var(--admin-border)] p-4">
            <Shimmer className="h-4 w-32" />
          </div>
          <div className="flex flex-col gap-3 p-4">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex items-center justify-between py-2">
                <Shimmer className="h-3 w-24" />
                <Shimmer className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="border-b border-[var(--admin-border)] p-4">
            <Shimmer className="h-4 w-28" />
          </div>
          <div className="flex flex-col gap-4 p-4">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="rounded bg-[var(--admin-surface-low)] p-3">
                <Shimmer className="mb-2 h-3 w-full" />
                <Shimmer className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        </div>
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
    case "receipt":
    case "payments":
    case "wallet":
      return <CreditCard className={className} aria-hidden="true" />;
    case "campaign":
      return <Filter className={className} aria-hidden="true" />;
    case "live":
      return <Activity className={className} aria-hidden="true" />;
    case "inbox":
      return <Inbox className={className} aria-hidden="true" />;
  }
}

function HeadlineCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-[140px] flex-1">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
        {label}
      </p>
      {children}
    </div>
  );
}

export function SalesInsightWidgetDetailView({
  slug,
  sectionTitle,
  detail,
  loading,
  error,
  range,
  overlay,
  onRefresh,
}: SalesInsightWidgetDetailViewProps) {
  const router = useRouter();
  const widget = detail?.widget ?? null;
  const vizOptions = widget ? compatibleViz(widget) : (["line", "area", "table"] as DetailViz[]);
  const [viz, setViz] = useState<DetailViz>(widget ? defaultViz(widget) : "line");
  const [copied, setCopied] = useState<"id" | "csv" | null>(null);
  const [dataOpen, setDataOpen] = useState(false);
  const [activeSplit, setActiveSplit] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const currency = detail?.currency;

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
  const inverted = widget ? isInverted(widget.id) : false;
  const money = widget ? isMoneyWidget(widget.id) : false;
  const funnel = widget ? isFunnel(widget.id) : false;
  const attribution = widget?.id === "top-sources";
  const opportunity = widget?.id === "opportunity-pool";
  const tableDefault = widget ? isTableWidget(widget.id) : false;
  const pipeline = widget ? pipelineCounts(widget) : { visited: 0, started: 0, enrolled: 0 };
  const totalValue = points.reduce((sum, point) => sum + point.value, 0);
  const headlineValue =
    detail?.comparison?.current ??
    (widget == null
      ? 0
      : widget.defaultViz === "kpi"
        ? numericValue(cell(widget.data.rows[0], "value"))
        : funnel
          ? pipeline.enrolled
          : totalValue || numericValue(cell(widget.data.rows[0], measureKey(widget))));

  function flashCopied(kind: "id" | "csv") {
    setCopied(kind);
    window.setTimeout(() => {
      setCopied(null);
    }, 1600);
  }

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
                aria-label="Back to Sales Insight"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className={insightPageTitleClassName}>
                {widget?.title ?? (loading ? "Loading widget" : "Widget")}
              </h1>
              {widget ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-0.5 font-data text-[10px] uppercase tracking-wider text-[var(--admin-on-surface-variant)] outline-none hover:border-[var(--admin-outline)] hover:bg-[var(--admin-surface-low)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                  onClick={() => {
                    void copyText(widget.id).then((ok) => {
                      if (ok) flashCopied("id");
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
          <button
            type="button"
            className={insightGhostButtonClassName}
            disabled={!widget}
            onClick={() => {
              if (!widget) return;
              void copyText(widgetToCsv(csvCols, csvRows)).then((ok) => {
                if (ok) flashCopied("csv");
              });
            }}
          >
            {copied === "csv" ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
            Copy as CSV
          </button>
          <button
            type="button"
            className={insightGhostButtonClassName}
            disabled={!widget}
            onClick={() => {
              if (!widget) return;
              downloadCsv(`${widget.id}.csv`, widgetToCsv(csvCols, csvRows));
            }}
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          {funnel ? (
            <Link
              href={adminInsightPipelineHref(slug)}
              prefetch={false}
              className={insightPrimaryButtonClassName}
            >
              Compare windows
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          ) : attribution ? (
            <Link
              href={adminInsightAttributionHref(slug)}
              prefetch={false}
              className={insightPrimaryButtonClassName}
            >
              Open attribution
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          ) : opportunity ? (
            <Link
              href={adminInsightOpportunityHref(slug)}
              prefetch={false}
              className={insightPrimaryButtonClassName}
            >
              Open opportunity
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
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            <div className="flex flex-col gap-6 lg:col-span-8">
              <section className="flex flex-wrap items-end gap-8 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
                {funnel ? (
                  <>
                    <HeadlineCell label="Conversion">
                      <div className={`${insightKpiValueClassName} text-[var(--admin-primary)]`}>
                        {overallConversion(pipeline.visited, pipeline.enrolled)}
                      </div>
                    </HeadlineCell>
                    <div
                      className="hidden h-10 w-px bg-[var(--admin-border)] md:block"
                      aria-hidden="true"
                    />
                    <HeadlineCell label="Visited">
                      <div className={insightKpiValueClassName}>
                        {empty ? "-" : formatInsightNumber(pipeline.visited)}
                      </div>
                    </HeadlineCell>
                    <div
                      className="hidden h-10 w-px bg-[var(--admin-border)] lg:block"
                      aria-hidden="true"
                    />
                    <HeadlineCell label="Enrolled">
                      <div className={insightKpiValueClassName}>
                        {empty ? "-" : formatInsightNumber(pipeline.enrolled)}
                      </div>
                    </HeadlineCell>
                  </>
                ) : (
                  <>
                    <HeadlineCell
                      label={
                        widget.id === "failed-payments"
                          ? "Total failed volume"
                          : (detail.comparison?.currentLabel ??
                            (money ? "Total revenue" : "Current"))
                      }
                    >
                      <div
                        className={`${insightKpiValueClassName} ${inverted ? "text-[var(--admin-warning)]" : ""}`}
                      >
                        {empty && isPercent(widget.id)
                          ? "-"
                          : empty && widget.id === "failed-payments"
                            ? formatInsightMoneyWithCode(0, currency)
                            : formatMetric(headlineValue, widget.id, currency)}
                      </div>
                      {empty && widget.id === "failed-payments" ? (
                        <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 text-sm text-[var(--admin-on-surface-variant)]">
                          <CheckCircle2
                            className="h-4 w-4 text-[var(--admin-success)]"
                            aria-hidden="true"
                          />
                          No failed payments in this window
                        </div>
                      ) : inverted ? (
                        <p className="mt-1 text-[10px] text-[var(--admin-warning)]">
                          Higher is worse
                        </p>
                      ) : null}
                    </HeadlineCell>
                    <div
                      className="hidden h-10 w-px bg-[var(--admin-border)] md:block"
                      aria-hidden="true"
                    />
                    <HeadlineCell label={detail.comparison?.previousLabel ?? "Previous period"}>
                      {detail.comparison ? (
                        <span className="font-data text-sm text-[var(--admin-on-surface-variant)]">
                          {formatMetric(detail.comparison.previous, widget.id, currency)}
                        </span>
                      ) : (
                        <p className="text-sm text-[var(--admin-on-surface-variant)]">
                          No comparable previous period
                        </p>
                      )}
                    </HeadlineCell>
                    <HeadlineCell label="Delta">
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
                            {`${detail.comparison.deltaAbs >= 0 ? "+" : ""}${formatMetric(detail.comparison.deltaAbs, widget.id, currency)}`}
                          </span>
                          {detail.comparison.deltaPct != null ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-[color-mix(in_srgb,currentColor_20%,transparent)] bg-[color-mix(in_srgb,currentColor_10%,transparent)] px-2 py-0.5 font-data text-[11px]">
                              <TrendingUp className="h-3 w-3" aria-hidden="true" />
                              {`${detail.comparison.deltaPct >= 0 ? "+" : ""}${formatInsightNumber(detail.comparison.deltaPct, 1)}%`}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--admin-on-surface-variant)]">
                          No comparable previous period
                        </p>
                      )}
                    </HeadlineCell>
                    {detail.average != null ? (
                      <>
                        <div
                          className="hidden h-10 w-px bg-[var(--admin-border)] lg:block"
                          aria-hidden="true"
                        />
                        <HeadlineCell
                          label={
                            widget.id === "top-products" ? "Average / product" : "Average / mo"
                          }
                        >
                          <span className="font-data text-sm text-[var(--admin-on-surface)]">
                            {formatMetric(detail.average, widget.id, currency)}
                          </span>
                        </HeadlineCell>
                      </>
                    ) : null}
                    {detail.failureRate ? (
                      <>
                        <div
                          className="hidden h-10 w-px bg-[var(--admin-border)] lg:block"
                          aria-hidden="true"
                        />
                        <HeadlineCell label="Failure rate">
                          <span className="font-data text-sm text-[var(--admin-warning)]">
                            {`${formatInsightNumber(detail.failureRate.currentPct, detail.failureRate.currentPct % 1 === 0 ? 0 : 1)}%`}
                          </span>
                          {detail.failureRate.note ? (
                            <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                              {detail.failureRate.note}
                            </p>
                          ) : null}
                        </HeadlineCell>
                      </>
                    ) : null}
                  </>
                )}
              </section>

              {funnel ? (
                <section className={`${insightPanelClassName} p-6`}>
                  <div className="mb-4 flex items-center justify-between border-b border-[var(--admin-border)] pb-4">
                    <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                      Funnel visualization
                    </h2>
                  </div>
                  {viz === "table" && !empty ? (
                    <SplitTable
                      rows={widget.data.rows.map((row) => {
                        const count = numericValue(cell(row, "count"));
                        const total = pipeline.visited || 1;
                        return {
                          label: stringValue(cell(row, "stage")),
                          value: count,
                          share: Math.round((count / total) * 1000) / 10,
                        };
                      })}
                    />
                  ) : viz === "bar" && !empty ? (
                    <DetailChart
                      points={widget.data.rows.map((row) => ({
                        label: stringValue(cell(row, "stage")),
                        longLabel: stringValue(cell(row, "stage")),
                        value: numericValue(cell(row, "count")),
                      }))}
                      viz="bar"
                      average={null}
                      widgetTitle={widget.title}
                      money={false}
                    />
                  ) : (
                    <FunnelPanel widget={widget} />
                  )}
                </section>
              ) : tableDefault && viz === "table" ? (
                empty ? (
                  <section className={insightPanelClassName}>
                    <header className="flex items-center justify-between border-b border-[var(--admin-border)] px-5 py-4">
                      <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                        {widget.id === "failed-payments" ? "Transaction timeline" : widget.title}
                      </h2>
                    </header>
                    <EmptyCanvas
                      title={
                        widget.id === "failed-payments"
                          ? "No failed payments recorded."
                          : widget.id === "top-products"
                            ? "No products yet"
                            : widget.id === "top-sources"
                              ? "No attribution events recorded"
                              : "No data in this window"
                      }
                      body={
                        widget.id === "failed-payments"
                          ? "Everything is running smoothly. Your transaction pipeline is currently clear of errors or declined payments for the selected window."
                          : widget.id === "opportunity-pool"
                            ? "Enrollment segments appear after the first enrollment is recorded."
                            : widget.id === "top-sources"
                              ? "Sources come from tracked visits. Open attribution once campaign events start arriving."
                              : "Records appear here once activity starts."
                      }
                      href={
                        widget.id === "top-sources"
                          ? adminInsightAttributionHref(slug)
                          : widget.id === "opportunity-pool"
                            ? adminInsightOpportunityHref(slug)
                            : reportHref
                      }
                      hrefLabel={
                        widget.id === "failed-payments"
                          ? "Open reports"
                          : widget.id === "top-sources"
                            ? "Open attribution"
                            : widget.id === "opportunity-pool"
                              ? "Open opportunity"
                              : undefined
                      }
                      success={widget.id === "failed-payments"}
                      icon={
                        widget.id === "failed-payments" ? (
                          <CheckCircle2 className="h-12 w-12" aria-hidden="true" />
                        ) : undefined
                      }
                    />
                  </section>
                ) : (
                  <DataTable widget={widget} currency={currency} />
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
                  <div className={viz === "table" ? "p-0" : "p-5"}>
                    {empty ? (
                      <EmptyCanvas
                        title={
                          widget.id === "monthly-revenue"
                            ? "No paid revenue in the last 12 months"
                            : "No data in this window"
                        }
                        body={
                          widget.id === "monthly-revenue"
                            ? "Paid orders will plot here once checkout activity starts."
                            : "Activity appears here once events are recorded."
                        }
                        href={reportHref}
                      />
                    ) : viz === "table" ? (
                      <div className="p-5">
                        <UnderlyingTable widget={widget} range={range} currency={currency} />
                      </div>
                    ) : (
                      <DetailChart
                        points={points}
                        viz={viz === "bar" ? "bar" : viz === "area" ? "area" : "line"}
                        average={detail.average}
                        widgetTitle={widget.title}
                        money={money}
                        currency={currency}
                      />
                    )}
                  </div>
                  {detail.insightNote && !empty ? (
                    <div className="mx-5 mb-5 mt-1 flex items-start gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-4">
                      <Lightbulb
                        className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-primary)]"
                        aria-hidden="true"
                      />
                      <p className="text-sm leading-relaxed text-[var(--admin-on-surface)]">
                        <span className="font-semibold text-[var(--admin-primary)]">Insight: </span>
                        {detail.insightNote}
                      </p>
                    </div>
                  ) : null}
                </section>
              )}

              {!funnel && !tableDefault && viz !== "table" ? (
                <section className={insightPanelClassName}>
                  {detail.splitOptions.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-[var(--admin-on-surface-variant)]">
                      This widget has no further breakdown.
                    </p>
                  ) : (
                    <>
                      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-low)_50%,transparent)] px-5 py-3">
                        <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                          Data breakdown
                        </h2>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                            Split by
                          </span>
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
                        </div>
                      </header>
                      <SplitTable
                        rows={detail.splits[activeSplit] ?? []}
                        money={money}
                        currency={currency}
                      />
                    </>
                  )}
                </section>
              ) : null}

              {tableDefault && !empty && viz === "table" && detail.splitOptions.length > 0 ? (
                <section className={insightPanelClassName}>
                  <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-3">
                    <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                      Data breakdown
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
                  <SplitTable
                    rows={detail.splits[activeSplit] ?? []}
                    money={money}
                    currency={currency}
                  />
                </section>
              ) : null}

              {viz !== "table" && !tableDefault && !empty ? (
                <div>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-4 text-left outline-none hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                    onClick={() => {
                      setDataOpen((open) => !open);
                    }}
                    aria-expanded={dataOpen}
                  >
                    <span className="flex items-center gap-3 text-base font-semibold text-[var(--admin-on-surface)]">
                      <Table2
                        className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
                        aria-hidden="true"
                      />
                      {dataOpen ? "Hide underlying data" : "Show underlying data"}
                    </span>
                    <span
                      className={`relative h-5 w-10 rounded-full border border-[var(--admin-outline)] p-0.5 transition-colors ${
                        dataOpen ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-surface-variant)]"
                      }`}
                      aria-hidden="true"
                    >
                      <span
                        className={`block h-4 w-4 rounded-full bg-[var(--admin-surface)] shadow-sm transition-transform ${
                          dataOpen ? "translate-x-5" : ""
                        }`}
                      />
                    </span>
                  </button>
                  {dataOpen ? (
                    <div
                      className={`mt-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 ${inlineExpandClassName}`}
                    >
                      <UnderlyingTable widget={widget} range={range} currency={currency} />
                      <button
                        type="button"
                        className="mt-3 text-sm font-medium text-[var(--admin-primary)] hover:underline"
                        onClick={() => {
                          void copyText(widgetToCsv(csvCols, csvRows)).then((ok) => {
                            if (ok) flashCopied("csv");
                          });
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
              <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--admin-on-surface)]">
                Related insights
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
                    href={item.href}
                    prefetch={false}
                    className="group flex items-start justify-between gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 outline-none transition-[background-color,border-color,transform] duration-200 hover:-translate-y-px hover:border-[var(--admin-outline)] hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--admin-surface-low)] text-[var(--admin-primary)] group-hover:bg-[var(--admin-primary-container)]">
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
                    <ArrowRight
                      className="mt-1 h-[18px] w-[18px] shrink-0 text-[var(--admin-on-surface-variant)] opacity-0 transition-opacity group-hover:opacity-100"
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
                    <dt>Window</dt>
                    <dd className="text-right text-[var(--admin-on-surface)]">
                      {SALES_FIXED_WINDOW_CAPTION}
                    </dd>
                  </div>
                  {currency ? (
                    <div className="flex justify-between border-b border-[var(--admin-border)] pb-1">
                      <dt>Currency</dt>
                      <dd className="text-[var(--admin-on-surface)]">{currency}</dd>
                    </div>
                  ) : null}
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
        aria-labelledby="si-widget-overlay-title"
        className="flex h-[calc(100dvh-64px)] w-full max-w-[1440px] flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_8px_32px_color-mix(in_srgb,var(--admin-on-surface)_12%,transparent)]"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--admin-border)] px-6">
          <h2
            id="si-widget-overlay-title"
            className="truncate text-xl font-semibold tracking-tight text-[var(--admin-on-surface)]"
          >
            {widget?.title ?? "Widget"}
          </h2>
          <div className="flex items-center gap-2">
            {widget ? (
              <Link
                href={adminInsightWidgetHref(slug, widget.id)}
                prefetch={false}
                className={insightGhostButtonClassName}
              >
                Open full page
              </Link>
            ) : null}
            <button
              ref={closeButtonRef}
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
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
