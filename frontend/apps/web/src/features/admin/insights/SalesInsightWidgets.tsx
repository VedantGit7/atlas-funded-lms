"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AreaChart,
  BarChart3,
  CreditCard,
  Filter,
  Inbox,
  LayoutGrid,
  LineChart,
  Maximize2,
  PieChart,
  Share2,
  ShoppingBag,
  Table2,
} from "lucide-react";
import { AreaChartView, BarChartView, LineChartView, TableView } from "../../analytics/viz/charts";
import { getCompatibleVizTypes } from "../../analytics/viz/compatibility";
import { getPreferredVizType, setPreferredVizType } from "../../analytics/viz/preference";
import {
  chartFill,
  chartGridStroke,
  chartLineStroke,
} from "../../analytics/analytics-admin-shared";
import type { VizType } from "../../analytics/viz";
import {
  adminInsightAttributionHref,
  adminInsightOpportunityHref,
  adminInsightPipelineHref,
  adminInsightWidgetHref,
} from "./admin-insights-catalog";
import type { InsightWidget } from "./admin-insights-api";
import {
  formatInsightMoney,
  formatInsightMoneyWithCode,
  formatInsightNumber,
  formatPeriodLabel,
  formatPeriodLong,
} from "./admin-insights-format";
import {
  insightGroupTitleClassName,
  insightKpiLabelClassName,
  insightKpiValueClassName,
  insightPanelClassName,
  insightShimmerClassName,
  insightTableHeadClassName,
  insightTableRowClassName,
} from "./admin-insights-shared";
import {
  SALES_FIXED_WINDOW_CAPTION,
  SALES_INSIGHT_CATALOGUE_KPI_IDS,
  SALES_INSIGHT_CHART_WIDGET_IDS,
  SALES_INSIGHT_CONVERSION_KPI_IDS,
  SALES_INSIGHT_INVERTED_KPI_IDS,
  SALES_INSIGHT_MONEY_KPI_IDS,
  SALES_INSIGHT_PERCENT_KPI_IDS,
  SALES_INSIGHT_REVENUE_KPI_IDS,
  SALES_PIPELINE_EMPTY_CAPTION,
  salesPipelinePairCaption,
} from "./sales-insight-meta";

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

function widgetPreferenceKey(widgetId: string): string {
  return `insight:sales-insight:${widgetId}`;
}

function pipelineCounts(widget: InsightWidget | undefined): {
  visited: number;
  enrolled: number;
  started: number;
} {
  const rows = widget?.data.rows ?? [];
  const visited = numericValue(cell(rows[0], "count"));
  const started = numericValue(cell(rows[1], "count"));
  const enrolled = numericValue(cell(rows[2], "count"));
  return { visited, started, enrolled };
}

function stepConversion(from: number, to: number): string {
  if (from <= 0) return "-";
  return `${formatInsightNumber(Math.round((to / from) * 100))}%`;
}

function formatCompactMoney(value: number): string {
  if (value >= 1_000_000) return `${formatInsightNumber(value / 1_000_000, 1)}M`;
  if (value >= 1000) return `${formatInsightNumber(value / 1000, 0)}K`;
  return formatInsightNumber(value);
}

function orderStatusTone(label: string): "danger" | "success" | "neutral" {
  const normalized = label.toLowerCase();
  if (normalized.includes("fail")) return "danger";
  if (normalized.includes("paid") || normalized.includes("succeed")) return "success";
  return "neutral";
}

function SalesInsightKpiCell({
  widget,
  currency,
  href,
}: {
  widget: InsightWidget;
  currency?: string | undefined;
  href: string;
}) {
  const value = numericValue(cell(widget.data.rows[0], "value"));
  const inverted = SALES_INSIGHT_INVERTED_KPI_IDS.has(widget.id);
  const percent = SALES_INSIGHT_PERCENT_KPI_IDS.has(widget.id);
  const money = SALES_INSIGHT_MONEY_KPI_IDS.has(widget.id);
  const emptyPipeline = percent && widget.footnote === SALES_PIPELINE_EMPTY_CAPTION;

  let valueLabel: string;
  if (emptyPipeline) valueLabel = "-";
  else if (percent) valueLabel = `${formatInsightNumber(value)}%`;
  else if (money) valueLabel = formatInsightMoney(value);
  else valueLabel = formatInsightNumber(value);

  const valueClass = inverted
    ? `${insightKpiValueClassName} text-[var(--admin-warning)]`
    : insightKpiValueClassName;

  return (
    <div className="flex flex-col gap-1">
      <p className={insightKpiLabelClassName}>{widget.title}</p>
      <div className="flex flex-wrap items-baseline gap-2">
        <Link
          href={widget.href ?? href}
          prefetch={false}
          className={`${valueClass} outline-none hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30`}
        >
          {valueLabel}
        </Link>
        {money && currency && !emptyPipeline ? (
          <span className="font-data text-lg text-[var(--admin-on-surface-variant)]">
            {currency}
          </span>
        ) : null}
      </div>
      {inverted ? (
        <p className="text-[10px] text-[var(--admin-warning)]">
          {widget.footnote ?? "Higher is worse."}
        </p>
      ) : widget.footnote ? (
        <p className="text-[10px] text-[var(--admin-on-surface-variant)]">{widget.footnote}</p>
      ) : null}
      {percent && !emptyPipeline ? (
        <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--admin-outline)_35%,transparent)]">
          <div
            className="h-full bg-[var(--admin-primary)]"
            style={{ width: `${String(Math.min(Math.max(value, 0), 100))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function SalesInsightKpiGroups({
  widgets,
  slug,
  currency,
}: {
  widgets: InsightWidget[];
  slug: string;
  currency?: string | undefined;
}) {
  const byId = useMemo(() => new Map(widgets.map((widget) => [widget.id, widget])), [widgets]);

  const renderColumn = (title: string, ids: readonly string[], last = false) => {
    const items = ids
      .map((id) => byId.get(id))
      .filter((widget): widget is InsightWidget => Boolean(widget));
    if (items.length === 0) return null;
    return (
      <section
        className={`flex flex-col gap-6 ${
          last ? "md:col-span-2" : "border-[var(--admin-border)] md:border-r md:pr-6"
        }`}
        aria-label={title}
      >
        <h2 className={insightGroupTitleClassName}>{title}</h2>
        {last ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {items.map((widget) => (
              <SalesInsightKpiCell
                key={widget.id}
                widget={widget}
                currency={currency}
                href={adminInsightWidgetHref(slug, widget.id)}
              />
            ))}
          </div>
        ) : (
          items.map((widget) => (
            <SalesInsightKpiCell
              key={widget.id}
              widget={widget}
              currency={currency}
              href={adminInsightWidgetHref(slug, widget.id)}
            />
          ))
        )}
      </section>
    );
  };

  const hasAny =
    SALES_INSIGHT_REVENUE_KPI_IDS.some((id) => byId.has(id)) ||
    SALES_INSIGHT_CATALOGUE_KPI_IDS.some((id) => byId.has(id)) ||
    SALES_INSIGHT_CONVERSION_KPI_IDS.some((id) => byId.has(id));
  if (!hasAny) return null;

  return (
    <div>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-4">
        {renderColumn("Revenue", SALES_INSIGHT_REVENUE_KPI_IDS)}
        {renderColumn("Catalogue and audience", SALES_INSIGHT_CATALOGUE_KPI_IDS)}
        {renderColumn("Conversion", SALES_INSIGHT_CONVERSION_KPI_IDS, true)}
      </div>
      <p className="mt-6 text-center text-xs text-[var(--admin-on-surface-variant)]">
        {SALES_FIXED_WINDOW_CAPTION}
      </p>
    </div>
  );
}

const VIZ_ICONS: Partial<Record<VizType, typeof LineChart>> = {
  line: LineChart,
  area: AreaChart,
  bar: BarChart3,
  table: Table2,
  pie: PieChart,
  donut: PieChart,
  funnel: Filter,
  sparkline: Activity,
  kpi: LayoutGrid,
};

function WidgetEmpty({
  title,
  body,
  icon,
  action,
}: {
  title: string;
  body: string;
  icon: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-[var(--admin-outline)] bg-[var(--admin-surface-low)] px-6 py-10 text-center">
      <div className="mb-4 text-[var(--admin-on-surface-variant)]">{icon}</div>
      <h4 className="text-sm font-medium text-[var(--admin-on-surface)]">{title}</h4>
      <p className="mt-1 max-w-xs text-xs text-[var(--admin-on-surface-variant)]">{body}</p>
      {action}
    </div>
  );
}

function SalesInsightWidgetFrame({
  widget,
  slug,
  children,
  compatible,
  vizType,
  onVizChange,
}: {
  widget: InsightWidget;
  slug: string;
  children: ReactNode;
  compatible: VizType[];
  vizType: VizType;
  onVizChange: (next: VizType) => void;
}) {
  const isPipeline = widget.id === "pipeline" || widget.id === "pipeline-30d";
  const isAttribution = widget.id === "top-sources";
  const isOpportunity = widget.id === "opportunity-pool";
  const detailHref = isPipeline
    ? adminInsightPipelineHref(slug)
    : isAttribution
      ? adminInsightAttributionHref(slug)
      : isOpportunity
        ? adminInsightOpportunityHref(slug)
        : adminInsightWidgetHref(slug, widget.id);
  const overlayHref = `${adminInsightWidgetHref(slug, widget.id)}?overlay=1`;
  const switcher = compatible.filter((type) => VIZ_ICONS[type]);

  return (
    <section
      className={`${insightPanelClassName} group relative min-h-[280px]`}
      aria-label={widget.title}
    >
      <header className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-[var(--admin-on-surface)]">
            <Link
              href={detailHref}
              prefetch={false}
              className="outline-none hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
            >
              {widget.title}
            </Link>
          </h3>
        </div>
        <div className="flex items-center gap-1">
          {switcher.length > 1 ? (
            <div className="flex rounded bg-[var(--admin-surface-low)] p-0.5 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
              {switcher.map((type) => {
                const Icon = VIZ_ICONS[type] ?? Table2;
                const active = type === vizType;
                return (
                  <button
                    key={type}
                    type="button"
                    className={`rounded p-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 ${
                      active
                        ? "bg-[var(--admin-surface)] text-[var(--admin-on-surface)] shadow-sm"
                        : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                    }`}
                    aria-label={`View as ${type}`}
                    aria-pressed={active}
                    onClick={() => {
                      onVizChange(type);
                    }}
                  >
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          ) : null}
          <Link
            href={overlayHref}
            prefetch={false}
            className="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
            aria-label={`Open ${widget.title} overlay`}
          >
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-5">{children}</div>
      {widget.footnote ? (
        <p className="border-t border-[var(--admin-border)] px-5 py-3 text-center text-xs text-[var(--admin-on-surface-variant)]">
          {widget.footnote}
        </p>
      ) : null}
    </section>
  );
}

const CHART_WIDTH = 720;
const CHART_HEIGHT = 220;
const CHART_PAD = { left: 44, right: 8, top: 12, bottom: 28 };

function pickXTicks(length: number): number[] {
  if (length <= 1) return [0];
  if (length <= 8) return Array.from({ length }, (_, index) => index);
  return [0, Math.floor(length / 2), length - 1];
}

function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  const first = points[0];
  if (!first) return "";
  if (points.length === 1) return `M ${String(first.x)} ${String(first.y)}`;
  let path = `M ${String(first.x)} ${String(first.y)}`;
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1];
    const current = points[index];
    if (!prev || !current) continue;
    const cx = (prev.x + current.x) / 2;
    path += ` C ${String(cx)} ${String(prev.y)}, ${String(cx)} ${String(current.y)}, ${String(current.x)} ${String(current.y)}`;
  }
  return path;
}

function MonthlyRevenueChart({
  widget,
  currency,
}: {
  widget: InsightWidget;
  currency?: string | undefined;
}) {
  const rows = widget.data.rows;
  const values = rows.map((row) => numericValue(cell(row, "value")));
  const max = Math.max(...values, 1);
  const avg = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const innerWidth = CHART_WIDTH - CHART_PAD.left - CHART_PAD.right;
  const innerHeight = CHART_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;
  const points = values.map((value, index) => {
    const x =
      CHART_PAD.left +
      (values.length === 1
        ? innerWidth / 2
        : (index / Math.max(values.length - 1, 1)) * innerWidth);
    const y = CHART_PAD.top + innerHeight - (value / max) * innerHeight;
    return { x, y, value };
  });
  const linePath = buildSmoothPath(points);
  const areaPath =
    points.length === 0
      ? ""
      : `${linePath} L ${String(points[points.length - 1]?.x ?? 0)} ${String(CHART_PAD.top + innerHeight)} L ${String(points[0]?.x ?? 0)} ${String(CHART_PAD.top + innerHeight)} Z`;
  const avgY = CHART_PAD.top + innerHeight - (avg / max) * innerHeight;
  const ticks = pickXTicks(rows.length);
  const axisSuffix = currency ? ` ${currency}` : "";

  return (
    <div className="relative h-64">
      <svg
        viewBox={`0 0 ${String(CHART_WIDTH)} ${String(CHART_HEIGHT)}`}
        className="h-full w-full"
        role="img"
        aria-label={`${widget.title} line chart`}
      >
        {[0, 0.5, 1].map((ratio) => {
          const y = CHART_PAD.top + innerHeight * (1 - ratio);
          return (
            <line
              key={ratio}
              x1={CHART_PAD.left}
              x2={CHART_WIDTH - CHART_PAD.right}
              y1={y}
              y2={y}
              stroke={chartGridStroke}
              strokeDasharray={ratio === 0 || ratio === 1 ? undefined : "4 4"}
            />
          );
        })}
        <line
          x1={CHART_PAD.left}
          x2={CHART_WIDTH - CHART_PAD.right}
          y1={avgY}
          y2={avgY}
          stroke="var(--admin-outline)"
          strokeDasharray="5 5"
        />
        <text
          x={CHART_WIDTH - CHART_PAD.right - 4}
          y={avgY - 6}
          textAnchor="end"
          fill="var(--admin-on-surface-variant)"
          fontSize={10}
          fontFamily="var(--font-jetbrains), ui-monospace, monospace"
        >
          {`Avg ${formatCompactMoney(avg)}${axisSuffix}`}
        </text>
        <text
          x={CHART_PAD.left - 8}
          y={CHART_PAD.top + 4}
          textAnchor="end"
          fill="var(--admin-on-surface-variant)"
          fontSize={10}
          fontFamily="var(--font-jetbrains), ui-monospace, monospace"
        >
          {formatCompactMoney(max)}
        </text>
        <text
          x={CHART_PAD.left - 8}
          y={CHART_PAD.top + innerHeight}
          textAnchor="end"
          fill="var(--admin-on-surface-variant)"
          fontSize={10}
          fontFamily="var(--font-jetbrains), ui-monospace, monospace"
        >
          0
        </text>
        <path d={areaPath} fill={chartFill} />
        <path
          d={linePath}
          fill="none"
          stroke={chartLineStroke}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point, index) =>
          ticks.includes(index) ? (
            <text
              key={`tick-${String(index)}`}
              x={point.x}
              y={CHART_HEIGHT - 6}
              textAnchor="middle"
              fill="var(--admin-on-surface-variant)"
              fontSize={10}
              fontFamily="var(--font-jetbrains), ui-monospace, monospace"
            >
              {formatPeriodLabel(stringValue(cell(rows[index], "period")), "12m")}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}

function SequentialFunnel({ widget }: { widget: InsightWidget }) {
  const { visited, started, enrolled } = pipelineCounts(widget);
  const empty = visited <= 0;
  const stages = [
    { label: "Visited", count: visited, width: empty ? 90 : 100 },
    {
      label: "Started diagnostic",
      count: started,
      width: empty ? 70 : Math.max((started / Math.max(visited, 1)) * 100, started > 0 ? 8 : 0),
    },
    {
      label: "Enrolled",
      count: enrolled,
      width: empty ? 50 : Math.max((enrolled / Math.max(visited, 1)) * 100, enrolled > 0 ? 8 : 0),
    },
  ];
  const connectors = [
    { from: visited, to: started },
    { from: started, to: enrolled },
  ];

  return (
    <div className="flex flex-1 flex-col justify-center gap-3">
      {stages.map((stage, index) => (
        <div key={stage.label}>
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="text-sm text-[var(--admin-on-surface)]">{stage.label}</span>
            <span className="font-data text-sm text-[var(--admin-on-surface)]">
              {empty ? "-" : formatInsightNumber(stage.count)}
            </span>
          </div>
          <div className="h-8 overflow-hidden rounded-r-full bg-[var(--admin-surface-low)]">
            <div
              className={`h-full rounded-r-full ${
                empty
                  ? "border border-dashed border-[var(--admin-outline)] bg-transparent"
                  : index === 0
                    ? "bg-[var(--admin-outline)]"
                    : index === 1
                      ? "bg-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-surface))]"
                      : "bg-[var(--admin-primary)]"
              }`}
              style={{ width: `${String(stage.width)}%` }}
            />
          </div>
          {index < connectors.length ? (
            <p className="mt-1 font-data text-[11px] text-[var(--admin-on-surface-variant)]">
              {empty
                ? "-"
                : stepConversion(connectors[index]?.from ?? 0, connectors[index]?.to ?? 0)}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function HorizontalBars({
  widget,
  toneFor,
}: {
  widget: InsightWidget;
  toneFor?: (label: string, index: number, maxIndex: number) => string;
}) {
  const rows = widget.data.rows;
  const max = Math.max(...rows.map((row) => numericValue(cell(row, "value"))), 1);
  const maxIndex = rows.reduce((best, row, index) => {
    return numericValue(cell(row, "value")) > numericValue(cell(rows[best], "value"))
      ? index
      : best;
  }, 0);

  return (
    <div className="flex flex-1 flex-col justify-center gap-4">
      {rows.map((row, index) => {
        const label = stringValue(cell(row, "label"), "Unknown");
        const value = numericValue(cell(row, "value"));
        const width = `${String(Math.max((value / max) * 100, value > 0 ? 6 : 0))}%`;
        const barClass =
          toneFor?.(label, index, maxIndex) ??
          (index === maxIndex
            ? "bg-[var(--admin-primary)]"
            : "bg-[color-mix(in_srgb,var(--admin-primary)_60%,var(--admin-surface))]");
        return (
          <div key={`${label}-${String(index)}`}>
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="text-sm text-[var(--admin-on-surface)]">{label}</span>
              <span className="font-data text-sm text-[var(--admin-on-surface)]">
                {formatInsightNumber(value)}
              </span>
            </div>
            <div className="h-7 overflow-hidden rounded-r-full bg-[var(--admin-surface-low)]">
              <div className={`h-full rounded-r-full ${barClass}`} style={{ width }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TopProductsTable({
  widget,
  currency,
}: {
  widget: InsightWidget;
  currency?: string | undefined;
}) {
  const rows = widget.data.rows;
  const maxRevenue = Math.max(...rows.map((row) => numericValue(cell(row, "revenue"))), 1);

  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-[var(--admin-surface-low)]">
            <th className={`${insightTableHeadClassName} px-5 py-3`}>Product</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Learners</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Paid</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Trial</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const revenue = numericValue(cell(row, "revenue"));
            const paid = numericValue(cell(row, "paid"));
            const trial = numericValue(cell(row, "trial"));
            const share = Math.round((revenue / maxRevenue) * 100);
            const lead = index === 0;
            return (
              <tr
                key={`${stringValue(cell(row, "title"))}-${String(index)}`}
                className={`${insightTableRowClassName} ${
                  lead ? "bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]" : ""
                }`}
              >
                <td
                  className={`px-5 py-2 text-sm font-medium ${
                    lead
                      ? "border-l-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
                      : "text-[var(--admin-primary)]"
                  }`}
                >
                  {stringValue(cell(row, "title"), "Untitled product")}
                </td>
                <td className="px-5 py-2 text-right font-data text-sm">
                  {formatInsightNumber(numericValue(cell(row, "students")))}
                </td>
                <td className="px-5 py-2 text-right font-data text-sm">
                  {formatInsightNumber(paid)}
                </td>
                <td
                  className={`px-5 py-2 text-right font-data text-sm ${
                    trial > paid ? "text-[var(--admin-warning)]" : ""
                  }`}
                >
                  {formatInsightNumber(trial)}
                </td>
                <td className="px-5 py-2">
                  <div className="flex items-center justify-end gap-2 font-data text-sm">
                    <span>{formatInsightMoneyWithCode(revenue, currency)}</span>
                    <div className="h-[3px] w-16 overflow-hidden rounded-full bg-[var(--admin-surface-variant)]">
                      <div
                        className="h-full bg-[var(--admin-primary)]"
                        style={{ width: `${String(share)}%` }}
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

function AttributionTable({
  widget,
  currency,
}: {
  widget: InsightWidget;
  currency?: string | undefined;
}) {
  const rows = widget.data.rows;
  const maxRevenue = Math.max(...rows.map((row) => numericValue(cell(row, "revenue"))), 1);

  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-[var(--admin-surface-low)]">
            <th className={`${insightTableHeadClassName} px-5 py-3`}>Source</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Events</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>
              Attributed revenue
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const revenue = numericValue(cell(row, "revenue"));
            const share = Math.round((revenue / maxRevenue) * 100);
            return (
              <tr
                key={`${stringValue(cell(row, "source"))}-${String(index)}`}
                className={insightTableRowClassName}
              >
                <td className="px-5 py-2 font-data text-sm text-[var(--admin-on-surface)]">
                  {stringValue(cell(row, "source"), "unknown")}
                </td>
                <td className="px-5 py-2 text-right font-data text-sm">
                  {formatInsightNumber(numericValue(cell(row, "events")))}
                </td>
                <td className="px-5 py-2">
                  <div className="flex items-center justify-end gap-2 font-data text-sm">
                    <span>{formatInsightMoneyWithCode(revenue, currency)}</span>
                    <div className="h-[3px] w-16 overflow-hidden rounded-full bg-[var(--admin-surface-variant)]">
                      <div
                        className="h-full bg-[var(--admin-primary)]"
                        style={{ width: `${String(share)}%` }}
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

function OpportunityTable({ widget }: { widget: InsightWidget }) {
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-[var(--admin-surface-low)]">
            <th className={`${insightTableHeadClassName} px-5 py-3`}>Segment</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Count</th>
          </tr>
        </thead>
        <tbody>
          {widget.data.rows.map((row, index) => (
            <tr
              key={`${stringValue(cell(row, "segment"))}-${String(index)}`}
              className={insightTableRowClassName}
            >
              <td className="px-5 py-2 text-sm text-[var(--admin-on-surface)]">
                {stringValue(cell(row, "segment"))}
              </td>
              <td className="px-5 py-2 text-right font-data text-sm">
                {formatInsightNumber(numericValue(cell(row, "count")))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FailedPaymentsTable({
  widget,
  currency,
}: {
  widget: InsightWidget;
  currency?: string | undefined;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="-mx-5 min-h-0 flex-1 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-[var(--admin-surface-low)]">
              <th className={`${insightTableHeadClassName} px-5 py-3`}>Learner</th>
              <th className={`${insightTableHeadClassName} px-5 py-3`}>Product</th>
              <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Amount</th>
              <th className={`${insightTableHeadClassName} px-5 py-3`}>Created</th>
            </tr>
          </thead>
          <tbody>
            {widget.data.rows.map((row, index) => (
              <tr
                key={`${stringValue(cell(row, "learner"))}-${String(index)}`}
                className={`${insightTableRowClassName} bg-[color-mix(in_srgb,var(--admin-danger)_5%,var(--admin-surface))]`}
              >
                <td className="border-l-2 border-[var(--admin-danger)] px-5 py-2 text-sm text-[var(--admin-on-surface)]">
                  {stringValue(cell(row, "learner"), "Unknown learner")}
                </td>
                <td className="px-5 py-2 text-sm text-[var(--admin-on-surface-variant)]">
                  {stringValue(cell(row, "product"), "Unknown product")}
                </td>
                <td className="px-5 py-2 text-right font-data text-sm">
                  {formatInsightMoneyWithCode(numericValue(cell(row, "amount")), currency)}
                </td>
                <td className="px-5 py-2 font-data text-sm text-[var(--admin-on-surface-variant)]">
                  {formatPeriodLong(stringValue(cell(row, "created")))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-right">
        <Link
          href={widget.href ?? "/admin/reports/payments"}
          prefetch={false}
          className="text-xs font-medium text-[var(--admin-primary)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
        >
          Open the payments report
        </Link>
      </div>
    </div>
  );
}

function emptyCopy(widget: InsightWidget): { title: string; body: string; icon: ReactNode } {
  if (widget.id === "failed-payments") {
    return {
      title: "No failed payments in this window",
      body: "Everything is running smoothly. Check back later for payment anomalies.",
      icon: <CreditCard className="h-12 w-12" aria-hidden="true" />,
    };
  }
  if (widget.id === "top-sources") {
    return {
      title: "No attribution events recorded",
      body: "Sources come from tracked visits. Open attribution once campaign events start arriving.",
      icon: <Share2 className="h-12 w-12" aria-hidden="true" />,
    };
  }
  if (widget.id === "monthly-revenue") {
    return {
      title: "No paid revenue in the last 12 months",
      body: "Paid orders will plot here once checkout activity starts.",
      icon: <CreditCard className="h-12 w-12" aria-hidden="true" />,
    };
  }
  if (widget.id === "enrollment-channels") {
    return {
      title: "No enrollments by channel yet",
      body: "Channel mix appears after the first enrollment is recorded.",
      icon: <BarChart3 className="h-12 w-12" aria-hidden="true" />,
    };
  }
  if (widget.id === "payment-orders") {
    return {
      title: "No orders yet",
      body: "Order statuses will stack here after the first checkout attempt.",
      icon: <ShoppingBag className="h-12 w-12" aria-hidden="true" />,
    };
  }
  if (widget.id === "top-products") {
    return {
      title: "No products yet",
      body: "Publish a course or bundle to see learner and revenue share here.",
      icon: <Inbox className="h-12 w-12" aria-hidden="true" />,
    };
  }
  if (widget.id === "pipeline" || widget.id === "pipeline-30d") {
    return {
      title: SALES_PIPELINE_EMPTY_CAPTION,
      body: "Pipeline stages come from analytics events once visitors start arriving.",
      icon: <Filter className="h-12 w-12" aria-hidden="true" />,
    };
  }
  return {
    title: "No data in this window",
    body: "This widget populates once academy commerce activity is recorded.",
    icon: <Inbox className="h-12 w-12" aria-hidden="true" />,
  };
}

function measureKey(widget: InsightWidget): string {
  return widget.data.measures?.[0] ?? (widget.defaultViz === "funnel" ? "count" : "value");
}

function widgetHasNoEvents(widget: InsightWidget): boolean {
  if (widget.id === "opportunity-pool") return false;
  if (widget.id === "pipeline" || widget.id === "pipeline-30d") {
    return pipelineCounts(widget).visited <= 0;
  }
  if (widget.data.rows.length === 0) return true;
  const key = measureKey(widget);
  return widget.data.rows.every((row) => numericValue(cell(row, key)) === 0);
}

function renderVizBody(
  widget: InsightWidget,
  vizType: VizType,
  currency: string | undefined,
  slug: string,
): ReactNode {
  const empty = widgetHasNoEvents(widget);
  if (empty && widget.id !== "pipeline" && widget.id !== "pipeline-30d") {
    const copy = emptyCopy(widget);
    const action =
      widget.id === "top-sources" ? (
        <Link
          href={adminInsightAttributionHref(slug)}
          prefetch={false}
          className="mt-4 rounded border border-[var(--admin-outline)] px-3 py-1.5 text-xs font-medium text-[var(--admin-on-surface)] outline-none transition-colors hover:bg-[var(--admin-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
        >
          Open attribution
        </Link>
      ) : undefined;
    return <WidgetEmpty title={copy.title} body={copy.body} icon={copy.icon} action={action} />;
  }

  if ((widget.id === "pipeline" || widget.id === "pipeline-30d") && vizType === "funnel") {
    return <SequentialFunnel widget={widget} />;
  }
  if (widget.id === "monthly-revenue" && (vizType === "line" || vizType === "area")) {
    return <MonthlyRevenueChart widget={widget} currency={currency} />;
  }
  if (widget.id === "enrollment-channels" && vizType === "bar") {
    return <HorizontalBars widget={widget} />;
  }
  if (widget.id === "payment-orders" && vizType === "bar") {
    return (
      <HorizontalBars
        widget={widget}
        toneFor={(label) => {
          const tone = orderStatusTone(label);
          if (tone === "danger") return "bg-[var(--admin-danger)]";
          if (tone === "success") return "bg-[var(--admin-success)]";
          return "bg-[var(--admin-outline)]";
        }}
      />
    );
  }
  if (widget.id === "top-products" && vizType === "table") {
    return <TopProductsTable widget={widget} currency={currency} />;
  }
  if (widget.id === "top-sources" && vizType === "table") {
    return <AttributionTable widget={widget} currency={currency} />;
  }
  if (widget.id === "opportunity-pool" && vizType === "table") {
    return <OpportunityTable widget={widget} />;
  }
  if (widget.id === "failed-payments" && vizType === "table") {
    return <FailedPaymentsTable widget={widget} currency={currency} />;
  }
  if (vizType === "line") return <LineChartView data={widget.data} />;
  if (vizType === "area") return <AreaChartView data={widget.data} />;
  if (vizType === "bar") return <BarChartView data={widget.data} />;
  return <TableView data={widget.data} />;
}

export function SalesInsightChartWidget({
  widget,
  slug,
  currency,
}: {
  widget: InsightWidget;
  slug: string;
  currency?: string | undefined;
}) {
  const compatible = useMemo(() => {
    const types = getCompatibleVizTypes(widget.data);
    const preferred: VizType[] = [widget.defaultViz, "line", "area", "bar", "table", "funnel"];
    const blocked = new Set<VizType>(
      widget.id === "opportunity-pool"
        ? ["pie", "donut", "bar", "funnel", "line", "area"]
        : widget.id === "pipeline" || widget.id === "pipeline-30d"
          ? ["pie", "donut"]
          : [],
    );
    return preferred.filter((type) => types.includes(type) && !blocked.has(type));
  }, [widget.data, widget.defaultViz, widget.id]);

  const [vizType, setVizType] = useState<VizType>(() => {
    const preferred = getPreferredVizType(widgetPreferenceKey(widget.id));
    if (preferred && compatible.includes(preferred)) return preferred;
    return widget.defaultViz;
  });

  return (
    <SalesInsightWidgetFrame
      widget={widget}
      slug={slug}
      compatible={compatible}
      vizType={vizType}
      onVizChange={(next) => {
        setVizType(next);
        setPreferredVizType(widgetPreferenceKey(widget.id), next);
      }}
    >
      {renderVizBody(widget, vizType, currency, slug)}
    </SalesInsightWidgetFrame>
  );
}

export function salesInsightWidgetSpanClass(span: InsightWidget["span"]): string {
  if (span === "full") return "col-span-12";
  if (span === "third") return "col-span-12 md:col-span-6 xl:col-span-4";
  return "col-span-12 md:col-span-6";
}

export function SalesInsightChartGrid({
  widgets,
  slug,
  currency,
}: {
  widgets: InsightWidget[];
  slug: string;
  currency?: string | undefined;
}) {
  const order = new Map<string, number>(
    SALES_INSIGHT_CHART_WIDGET_IDS.map((id, index) => [id, index]),
  );
  const sorted = widgets.slice().sort((left, right) => {
    return (order.get(left.id) ?? 99) - (order.get(right.id) ?? 99);
  });
  const byId = new Map(sorted.map((widget) => [widget.id, widget]));
  const rendered = new Set<string>();
  const nodes: ReactNode[] = [];

  for (const widget of sorted) {
    if (rendered.has(widget.id)) continue;
    if (widget.id === "pipeline" && byId.has("pipeline-30d")) {
      const recent = byId.get("pipeline-30d");
      if (recent) {
        rendered.add("pipeline");
        rendered.add("pipeline-30d");
        const pairCaption = salesPipelinePairCaption(
          pipelineCounts(widget),
          pipelineCounts(recent),
        );
        nodes.push(
          <div key="pipeline-pair" className="col-span-12 grid grid-cols-12 gap-6">
            <div className="col-span-12 md:col-span-6">
              <SalesInsightChartWidget widget={widget} slug={slug} currency={currency} />
            </div>
            <div className="col-span-12 md:col-span-6">
              <SalesInsightChartWidget widget={recent} slug={slug} currency={currency} />
            </div>
            {pairCaption ? (
              <p className="col-span-12 text-center text-xs text-[var(--admin-on-surface-variant)]">
                {pairCaption}{" "}
                <Link
                  href={adminInsightPipelineHref(slug)}
                  prefetch={false}
                  className="font-medium text-[var(--admin-primary)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                >
                  Compare windows
                </Link>
              </p>
            ) : null}
          </div>,
        );
        continue;
      }
    }
    rendered.add(widget.id);
    nodes.push(
      <div key={widget.id} className={salesInsightWidgetSpanClass(widget.span)}>
        <SalesInsightChartWidget widget={widget} slug={slug} currency={currency} />
      </div>,
    );
  }

  return <div className="grid grid-cols-12 gap-6">{nodes}</div>;
}

export function SalesInsightSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading sales insight">
      <div className={`${insightShimmerClassName} h-12 w-full rounded`} />
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-4">
        {["Revenue", "Catalogue and audience", "Conversion"].map((group, groupIndex) => (
          <div
            key={group}
            className={
              groupIndex === 2 ? "flex flex-col gap-6 md:col-span-2" : "flex flex-col gap-6"
            }
          >
            <div className={`${insightShimmerClassName} h-4 w-32 rounded`} />
            <div
              className={
                groupIndex === 2 ? "grid grid-cols-1 gap-6 sm:grid-cols-2" : "flex flex-col gap-6"
              }
            >
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index}>
                  <div className={`${insightShimmerClassName} mb-2 h-3 w-24 rounded`} />
                  <div className={`${insightShimmerClassName} h-8 w-32 rounded`} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-12 gap-6">
        <div className={`${insightPanelClassName} col-span-12 min-h-[320px] p-5`}>
          <div className={`${insightShimmerClassName} mb-6 h-5 w-48 rounded`} />
          <div className={`${insightShimmerClassName} h-56 w-full rounded`} />
        </div>
        <div className={`${insightPanelClassName} col-span-12 min-h-[280px] p-5 md:col-span-6`}>
          <div className={`${insightShimmerClassName} mb-6 h-5 w-40 rounded`} />
          <div className="flex flex-col items-center gap-3 py-6">
            <div className={`${insightShimmerClassName} h-10 w-full rounded`} />
            <div className={`${insightShimmerClassName} h-10 w-5/6 rounded`} />
            <div className={`${insightShimmerClassName} h-10 w-2/3 rounded`} />
          </div>
        </div>
        <div className={`${insightPanelClassName} col-span-12 min-h-[280px] p-5 md:col-span-6`}>
          <div className={`${insightShimmerClassName} mb-6 h-5 w-36 rounded`} />
          <div className="flex flex-col items-center gap-3 py-6">
            <div className={`${insightShimmerClassName} h-10 w-full rounded`} />
            <div className={`${insightShimmerClassName} h-10 w-5/6 rounded`} />
            <div className={`${insightShimmerClassName} h-10 w-2/3 rounded`} />
          </div>
        </div>
        <div className={`${insightPanelClassName} col-span-12 min-h-[240px] p-5 md:col-span-6`}>
          <div className={`${insightShimmerClassName} mb-6 h-5 w-44 rounded`} />
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="mb-3">
              <div className={`${insightShimmerClassName} mb-1 h-3 w-24 rounded`} />
              <div className={`${insightShimmerClassName} h-7 w-full rounded`} />
            </div>
          ))}
        </div>
        <div className={`${insightPanelClassName} col-span-12 min-h-[240px] p-5 md:col-span-6`}>
          <div className={`${insightShimmerClassName} mb-6 h-5 w-40 rounded`} />
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="mb-3">
              <div className={`${insightShimmerClassName} mb-1 h-3 w-20 rounded`} />
              <div className={`${insightShimmerClassName} h-7 w-full rounded`} />
            </div>
          ))}
        </div>
        <div className={`${insightPanelClassName} col-span-12 overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-[var(--admin-border)] p-5">
            <div className={`${insightShimmerClassName} h-5 w-48 rounded`} />
          </div>
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="grid grid-cols-5 gap-4 border-b border-[var(--admin-border)] px-5 py-3 last:border-b-0"
            >
              <div className={`${insightShimmerClassName} h-4 w-3/4 rounded`} />
              <div className={`${insightShimmerClassName} h-4 w-full rounded`} />
              <div className={`${insightShimmerClassName} h-4 w-1/2 rounded`} />
              <div className={`${insightShimmerClassName} h-4 w-1/3 rounded`} />
              <div className={`${insightShimmerClassName} ml-auto h-4 w-2/3 rounded`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
