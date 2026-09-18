"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AreaChart,
  BarChart3,
  BookOpen,
  Calendar,
  ChevronRight,
  Filter,
  Inbox,
  Info,
  LayoutGrid,
  LineChart,
  Maximize2,
  Minus,
  PieChart,
  Table2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  AreaChartView,
  BarChartView,
  ComboChartView,
  LineChartView,
  PieChartView,
  TableView,
} from "../../analytics/viz/charts";
import { getCompatibleVizTypes } from "../../analytics/viz/compatibility";
import { getPreferredVizType, setPreferredVizType } from "../../analytics/viz/preference";
import {
  chartFill,
  chartGridStroke,
  chartLineStroke,
} from "../../analytics/analytics-admin-shared";
import type { VizType } from "../../analytics/viz";
import {
  adminInsightContentHealthHref,
  adminInsightFunnelHref,
  adminInsightWidgetHref,
} from "./admin-insights-catalog";
import type { InsightDashboardRange, InsightWidget } from "./admin-insights-api";
import { formatInsightNumber, formatPeriodLabel } from "./admin-insights-format";
import {
  insightGroupPanelClassName,
  insightGroupTitleClassName,
  insightKpiValueClassName,
  insightPanelClassName,
  insightShimmerClassName,
  insightTableHeadClassName,
  insightTableRowClassName,
} from "./admin-insights-shared";
import {
  SCHOOL_VITALS_ACTIVITY_KPI_IDS,
  SCHOOL_VITALS_INVERTED_KPI_IDS,
  SCHOOL_VITALS_PERCENT_KPI_IDS,
  SCHOOL_VITALS_POPULATION_KPI_IDS,
  schoolVitalsActivityGroupTitle,
} from "./school-vitals-meta";

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
  return `insight:school-vitals:${widgetId}`;
}

type DeltaTone = "up" | "down" | "flat";

function deltaTone(widget: InsightWidget): DeltaTone {
  const deltaPct = widget.deltaPct ?? 0;
  const deltaAbs = widget.deltaAbs ?? 0;
  if (deltaPct > 0 || deltaAbs > 0) return "up";
  if (deltaPct < 0 || deltaAbs < 0) return "down";
  return "flat";
}

function isInverted(widgetId: string): boolean {
  return SCHOOL_VITALS_INVERTED_KPI_IDS.has(widgetId);
}

function kpiAccentClass(widget: InsightWidget, tone: DeltaTone): string {
  if (isInverted(widget.id)) {
    if (tone === "up") return "text-[var(--admin-warning)]";
    if (tone === "down") return "text-[var(--admin-success)]";
    return "text-[var(--admin-warning)]";
  }
  if (widget.id === "assessment-pass-rate" && tone === "down") {
    return "text-[var(--admin-warning)]";
  }
  return "text-[var(--admin-on-surface)]";
}

function deltaClass(widget: InsightWidget, tone: DeltaTone): string {
  if (isInverted(widget.id)) {
    if (tone === "up") return "text-[var(--admin-warning)]";
    if (tone === "down") return "text-[var(--admin-success)]";
    return "text-[var(--admin-on-surface-variant)]";
  }
  if (tone === "down") return "text-[var(--admin-warning)]";
  if (tone === "up") return "text-[var(--admin-success)]";
  return "text-[var(--admin-on-surface-variant)]";
}

function SparklineBars({ values, lastAccent }: { values: number[]; lastAccent: boolean }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  return (
    <div className="mt-2 flex h-8 items-end gap-px opacity-50 transition-opacity group-hover:opacity-100">
      {values.map((value, index) => {
        const height = `${String(Math.max((value / max) * 100, 8))}%`;
        const isLast = index === values.length - 1;
        return (
          <div
            key={`${String(index)}-${String(value)}`}
            className={`min-w-[3px] flex-1 rounded-t-sm ${
              isLast && lastAccent ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-outline)]"
            }`}
            style={{ height }}
          />
        );
      })}
    </div>
  );
}

function KpiDelta({ widget, tone }: { widget: InsightWidget; tone: DeltaTone }) {
  const className = `mb-1 inline-flex items-center gap-0.5 font-data text-sm ${deltaClass(widget, tone)}`;
  if (widget.deltaPct != null && widget.deltaPct !== 0) {
    const digits = Math.abs(widget.deltaPct) % 1 === 0 ? 0 : 1;
    return (
      <span className={className}>
        {tone === "down" ? (
          <TrendingDown className="h-4 w-4" aria-hidden="true" />
        ) : tone === "up" ? (
          <TrendingUp className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Minus className="h-4 w-4" aria-hidden="true" />
        )}
        {tone === "down" ? "-" : "+"}
        {formatInsightNumber(Math.abs(widget.deltaPct), digits)}%
      </span>
    );
  }
  if (widget.deltaAbs != null && widget.deltaAbs !== 0) {
    return (
      <span className={className}>
        {tone === "down" ? (
          <TrendingDown className="h-4 w-4" aria-hidden="true" />
        ) : (
          <TrendingUp className="h-4 w-4" aria-hidden="true" />
        )}
        {tone === "down" ? "-" : "+"}
        {formatInsightNumber(Math.abs(widget.deltaAbs))}
      </span>
    );
  }
  return null;
}

function SchoolVitalsKpiCell({ widget, href }: { widget: InsightWidget; href: string }) {
  const value = numericValue(cell(widget.data.rows[0], "value"));
  const tone = deltaTone(widget);
  const inverted = isInverted(widget.id);
  const percent = SCHOOL_VITALS_PERCENT_KPI_IDS.has(widget.id);
  const warningSurface = inverted || (percent && tone === "down");
  const [viz, setViz] = useState<VizType>(
    () => getPreferredVizType(widgetPreferenceKey(widget.id)) ?? "kpi",
  );

  const valueLabel = percent
    ? `${formatInsightNumber(value, value % 1 === 0 ? 0 : 1)}%`
    : formatInsightNumber(value);

  return (
    <div
      className={`group relative flex flex-col gap-1 rounded p-3 transition-colors ${
        warningSurface
          ? "hover:border-[color-mix(in_srgb,var(--admin-warning)_20%,transparent)] hover:bg-[color-mix(in_srgb,var(--admin-warning)_5%,transparent)]"
          : "hover:bg-[var(--admin-surface-low)]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={`text-xs text-[var(--admin-on-surface-variant)] ${
            inverted ? "text-[var(--admin-warning)]" : ""
          }`}
        >
          {widget.title}
        </p>
        {inverted ? (
          <span className="text-[var(--admin-warning)]" title="Higher is worse">
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">Higher is worse</span>
          </span>
        ) : null}
      </div>

      {viz === "table" ? (
        <div className="mt-1 overflow-hidden rounded border border-[var(--admin-border)]">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[var(--admin-surface-low)]">
                <th className={`${insightTableHeadClassName} px-2 py-1`}>Metric</th>
                <th className={`${insightTableHeadClassName} px-2 py-1 text-right`}>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr className={insightTableRowClassName}>
                <td className="px-2 py-1 text-sm">{widget.title}</td>
                <td className="px-2 py-1 text-right font-data text-sm">{valueLabel}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="flex items-end gap-2">
            <Link
              href={widget.href ?? href}
              prefetch={false}
              className={`${insightKpiValueClassName} ${kpiAccentClass(widget, tone)} outline-none hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30`}
            >
              {valueLabel}
            </Link>
            <KpiDelta widget={widget} tone={tone} />
          </div>
          {value === 0 && (!widget.sparkline || widget.sparkline.length < 2) ? (
            <p className="text-[10px] text-[var(--admin-on-surface-variant)]">
              No data in selected window
            </p>
          ) : null}
          {widget.footnote ? (
            <p
              className={`text-[10px] ${inverted ? "text-[var(--admin-warning)]/80" : "text-[var(--admin-on-surface-variant)]"}`}
            >
              {widget.footnote}
            </p>
          ) : null}
          {percent ? (
            <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--admin-outline)_30%,transparent)]">
              <div
                className={`h-full ${tone === "down" || inverted ? "bg-[var(--admin-warning)]" : "bg-[var(--admin-primary)]"}`}
                style={{ width: `${String(Math.min(Math.max(value, 0), 100))}%` }}
              />
            </div>
          ) : widget.sparkline && widget.sparkline.length > 1 ? (
            <SparklineBars values={widget.sparkline} lastAccent={!warningSurface} />
          ) : null}
        </>
      )}

      <div className="absolute right-2 top-2 flex rounded bg-[var(--admin-surface-low)] p-0.5 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        <button
          type="button"
          className={`rounded p-0.5 ${viz === "kpi" ? "bg-[var(--admin-surface)] text-[var(--admin-on-surface)] shadow-sm" : "text-[var(--admin-on-surface-variant)]"}`}
          aria-label="Show as KPI"
          onClick={() => {
            setViz("kpi");
            setPreferredVizType(widgetPreferenceKey(widget.id), "kpi");
          }}
        >
          <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`rounded p-0.5 ${viz === "table" ? "bg-[var(--admin-surface)] text-[var(--admin-on-surface)] shadow-sm" : "text-[var(--admin-on-surface-variant)]"}`}
          aria-label="Show as table"
          onClick={() => {
            setViz("table");
            setPreferredVizType(widgetPreferenceKey(widget.id), "table");
          }}
        >
          <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function SchoolVitalsKpiGroups({
  widgets,
  slug,
  range,
}: {
  widgets: InsightWidget[];
  slug: string;
  range: InsightDashboardRange;
}) {
  const byId = useMemo(() => new Map(widgets.map((widget) => [widget.id, widget])), [widgets]);
  const population = SCHOOL_VITALS_POPULATION_KPI_IDS.map((id) => byId.get(id)).filter(
    (widget): widget is InsightWidget => Boolean(widget),
  );
  const activity = SCHOOL_VITALS_ACTIVITY_KPI_IDS.map((id) => byId.get(id)).filter(
    (widget): widget is InsightWidget => Boolean(widget),
  );

  const renderGroup = (title: string, items: InsightWidget[]) => {
    if (items.length === 0) return null;
    return (
      <section className={insightGroupPanelClassName} aria-label={title}>
        <h2 className={insightGroupTitleClassName}>{title}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((widget) => (
            <SchoolVitalsKpiCell
              key={widget.id}
              widget={widget}
              href={`${adminInsightWidgetHref(slug, widget.id)}?range=${range}`}
            />
          ))}
        </div>
      </section>
    );
  };

  if (population.length === 0 && activity.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {renderGroup("Population", population)}
      {renderGroup(schoolVitalsActivityGroupTitle(range), activity)}
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
  combo: BarChart3,
};

function WidgetEmpty({ title, body, icon }: { title: string; body: string; icon: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-12 text-center">
      <div className="mb-4 text-[var(--admin-on-surface-variant)]">{icon}</div>
      <h4 className="text-base font-semibold text-[var(--admin-on-surface)]">{title}</h4>
      <p className="mt-1 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">{body}</p>
    </div>
  );
}

function SchoolVitalsWidgetFrame({
  widget,
  slug,
  range,
  children,
  compatible,
  vizType,
  onVizChange,
}: {
  widget: InsightWidget;
  slug: string;
  range: InsightDashboardRange;
  children: ReactNode;
  compatible: VizType[];
  vizType: VizType;
  onVizChange: (next: VizType) => void;
}) {
  const detailHref =
    widget.id === "engagement-funnel"
      ? `${adminInsightFunnelHref(slug)}?range=${range}`
      : widget.id === "content-health"
        ? `${adminInsightContentHealthHref(slug)}?range=${range}`
        : `${adminInsightWidgetHref(slug, widget.id)}?range=${range}`;
  const overlayHref =
    widget.id === "content-health"
      ? `${adminInsightContentHealthHref(slug)}?range=${range}`
      : `${adminInsightWidgetHref(slug, widget.id)}?range=${range}&overlay=1`;
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
          {widget.footnote ? (
            <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">{widget.footnote}</p>
          ) : null}
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
    </section>
  );
}

const CHART_WIDTH = 720;
const CHART_HEIGHT = 220;
const CHART_PAD = { left: 36, right: 8, top: 12, bottom: 28 };

function SchoolVitalsSeriesChart({
  widget,
  range,
  mode,
}: {
  widget: InsightWidget;
  range: InsightDashboardRange;
  mode: "line" | "area";
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
    return { x, y, value, weekend: isWeekend(stringValue(cell(rows[index], "period"))) };
  });

  const linePath = buildSmoothPath(points);
  const areaPath =
    points.length === 0
      ? ""
      : `${linePath} L ${String(points[points.length - 1]?.x ?? 0)} ${String(CHART_PAD.top + innerHeight)} L ${String(points[0]?.x ?? 0)} ${String(CHART_PAD.top + innerHeight)} Z`;
  const avgY = CHART_PAD.top + innerHeight - (avg / max) * innerHeight;
  const ticks = pickXTicks(rows.length);

  return (
    <div className="relative h-64">
      <svg
        viewBox={`0 0 ${String(CHART_WIDTH)} ${String(CHART_HEIGHT)}`}
        className="h-full w-full"
        role="img"
        aria-label={`${widget.title} ${mode} chart`}
      >
        {mode === "area"
          ? points.map((point, index) => {
              if (!point.weekend || index === points.length - 1) return null;
              const next = points[index + 1];
              if (!next) return null;
              return (
                <rect
                  key={`wknd-${String(index)}`}
                  x={point.x}
                  y={CHART_PAD.top}
                  width={Math.max(next.x - point.x, 0)}
                  height={innerHeight}
                  fill="color-mix(in srgb, var(--admin-primary) 6%, transparent)"
                />
              );
            })
          : null}
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
          {mode === "area" ? "Mean" : "Avg"}: {formatInsightNumber(avg, avg >= 100 ? 0 : 1)}
        </text>
        <text
          x={CHART_PAD.left - 8}
          y={CHART_PAD.top + 4}
          textAnchor="end"
          fill="var(--admin-on-surface-variant)"
          fontSize={10}
          fontFamily="var(--font-jetbrains), ui-monospace, monospace"
        >
          {formatCompact(max)}
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
        {mode === "area" ? <path d={areaPath} fill={chartFill} /> : null}
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
              {formatPeriodLabel(stringValue(cell(rows[index], "period")), range)}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}

function isWeekend(period: string): boolean {
  const date = new Date(period.includes("T") ? period : `${period}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function pickXTicks(length: number): number[] {
  if (length <= 1) return [0];
  if (length <= 8) return Array.from({ length }, (_, index) => index);
  return [0, Math.floor(length / 2), length - 1];
}

function formatCompact(value: number): string {
  if (value >= 1000) return `${formatInsightNumber(value / 1000, 0)}K`;
  return formatInsightNumber(value);
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

function SchoolVitalsFunnel({ widget }: { widget: InsightWidget }) {
  const rows = widget.data.rows;
  const total = rows.reduce((sum, row) => sum + numericValue(cell(row, "count")), 0);
  const max = Math.max(...rows.map((row) => numericValue(cell(row, "count"))), 1);

  return (
    <div className="flex flex-1 flex-col justify-center gap-3">
      {rows.map((row, index) => {
        const count = numericValue(cell(row, "count"));
        const share = total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
        const width = `${String(Math.max((count / max) * 100, count > 0 ? 8 : 0))}%`;
        return (
          <div key={`${stringValue(cell(row, "stage"))}-${String(index)}`}>
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="text-sm text-[var(--admin-on-surface)]">
                {stringValue(cell(row, "stage"))}
              </span>
              <span className="font-data text-sm text-[var(--admin-on-surface)]">
                {formatInsightNumber(count)}
                <span className="ml-2 text-xs text-[var(--admin-on-surface-variant)]">
                  {formatInsightNumber(share, share % 1 === 0 ? 0 : 1)}% of events
                </span>
              </span>
            </div>
            <div className="h-8 overflow-hidden rounded bg-[var(--admin-surface-low)]">
              <div className="h-full rounded bg-[var(--admin-primary)]" style={{ width }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function contentHealthSignalAnchor(row: InsightWidget["data"]["rows"][number]): string {
  const id = stringValue(cell(row, "id"));
  if (
    id === "dormant-courses" ||
    id === "inactive-learners" ||
    id === "open-moderation" ||
    id === "upcoming-live"
  ) {
    return id;
  }
  const signal = stringValue(cell(row, "signal")).toLowerCase();
  if (signal.includes("dormant")) return "dormant-courses";
  if (signal.includes("inactive")) return "inactive-learners";
  if (signal.includes("moderation")) return "open-moderation";
  if (signal.includes("live")) return "upcoming-live";
  return "";
}

function SchoolVitalsContentHealth({
  widget,
  slug,
  range,
}: {
  widget: InsightWidget;
  slug: string;
  range: InsightDashboardRange;
}) {
  const boardHref = `${adminInsightContentHealthHref(slug)}?range=${range}`;
  return (
    <ul className="divide-y divide-[var(--admin-border)]">
      {widget.data.rows.map((row, index) => {
        const tone = stringValue(cell(row, "tone"), "neutral");
        const count = numericValue(cell(row, "count"));
        const anchor = contentHealthSignalAnchor(row);
        const href = anchor ? `${boardHref}#${anchor}` : boardHref;
        const warning = tone === "warning" && count > 0;
        const inner = (
          <>
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-medium ${
                  warning ? "text-[var(--admin-warning)]" : "text-[var(--admin-on-surface)]"
                }`}
              >
                {stringValue(cell(row, "signal"))}
              </p>
              <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                {stringValue(cell(row, "consequence"))}
              </p>
            </div>
            <span
              className={`font-data text-base ${
                warning ? "text-[var(--admin-warning)]" : "text-[var(--admin-on-surface)]"
              }`}
            >
              {formatInsightNumber(count)}
            </span>
            {href ? (
              <ChevronRight
                className={`h-5 w-5 ${warning ? "text-[var(--admin-warning)]/60" : "text-[var(--admin-on-surface-variant)]"}`}
                aria-hidden="true"
              />
            ) : null}
          </>
        );
        const className = `flex items-center gap-3 py-3 ${
          warning ? "bg-[color-mix(in_srgb,var(--admin-warning)_4%,transparent)]" : ""
        }`;
        return (
          <li key={`${stringValue(cell(row, "signal"))}-${String(index)}`}>
            <Link
              href={href}
              prefetch={false}
              className={`${className} outline-none transition-colors hover:bg-[var(--admin-surface-low)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30`}
            >
              {inner}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SchoolVitalsTopCourses({ widget }: { widget: InsightWidget }) {
  const rows = widget.data.rows;
  const maxCompletions = Math.max(...rows.map((row) => numericValue(cell(row, "completions"))), 1);

  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-[var(--admin-surface-low)]">
            <th className={`${insightTableHeadClassName} px-5 py-3`}>Course</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>
              Lesson completions
            </th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Active learners</th>
            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Avg progress %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const completions = numericValue(cell(row, "completions"));
            const progress = numericValue(cell(row, "avgProgress"));
            const share = Math.round((completions / maxCompletions) * 100);
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
                      : "text-[var(--admin-on-surface)]"
                  }`}
                >
                  {stringValue(cell(row, "title"), "Untitled course")}
                </td>
                <td className="px-5 py-2">
                  <div className="flex items-center justify-end gap-2 font-data text-sm">
                    <span>{formatInsightNumber(completions)}</span>
                    <div className="h-1 w-16 overflow-hidden rounded-full bg-[var(--admin-surface-variant)]">
                      <div
                        className="h-full bg-[var(--admin-primary)]"
                        style={{ width: `${String(share)}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-5 py-2 text-right font-data text-sm">
                  {formatInsightNumber(numericValue(cell(row, "learners")))}
                </td>
                <td className="px-5 py-2">
                  <div className="flex items-center justify-end gap-2 font-data text-sm">
                    <span>{formatInsightNumber(progress)}%</span>
                    <div className="h-1.5 w-12 overflow-hidden rounded-full bg-[var(--admin-surface-variant)]">
                      <div
                        className={`h-full ${
                          progress >= 80 ? "bg-[var(--admin-success)]" : "bg-[var(--admin-primary)]"
                        }`}
                        style={{ width: `${String(Math.min(Math.max(progress, 0), 100))}%` }}
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

function emptyCopy(widget: InsightWidget): { title: string; body: string; icon: ReactNode } {
  if (widget.id === "top-courses") {
    return {
      title: "No learning events recorded in this window",
      body: "Course metrics populate once enrollment and completion data is registered.",
      icon: <BookOpen className="h-12 w-12" aria-hidden="true" />,
    };
  }
  if (widget.id === "engagement-funnel") {
    return {
      title: "No learning events recorded in this window",
      body: "Engagement funnels need session data to render stage counts.",
      icon: <Filter className="h-12 w-12" aria-hidden="true" />,
    };
  }
  if (widget.id === "daily-active-users") {
    return {
      title: "No active learners in this window",
      body: "Daily active users appear here once learners open content.",
      icon: <Activity className="h-12 w-12" aria-hidden="true" />,
    };
  }
  if (widget.id === "content-health") {
    return {
      title: "No content health signals yet",
      body: "Dormant courses, inactivity, and moderation load will list here.",
      icon: <Calendar className="h-12 w-12" aria-hidden="true" />,
    };
  }
  return {
    title: "No learning events recorded in this window",
    body: "Activity timelines appear here once learners interact with modules.",
    icon: <Inbox className="h-12 w-12" aria-hidden="true" />,
  };
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

function renderVizBody(
  widget: InsightWidget,
  vizType: VizType,
  range: InsightDashboardRange,
  slug: string,
): ReactNode {
  if (widgetHasNoEvents(widget)) {
    const copy = emptyCopy(widget);
    return <WidgetEmpty title={copy.title} body={copy.body} icon={copy.icon} />;
  }

  if (widget.id === "content-health" && (vizType === "table" || vizType === "kpi")) {
    return <SchoolVitalsContentHealth widget={widget} slug={slug} range={range} />;
  }
  if (widget.id === "top-courses" && vizType === "table") {
    return <SchoolVitalsTopCourses widget={widget} />;
  }
  if (widget.id === "engagement-funnel" && vizType === "funnel") {
    return <SchoolVitalsFunnel widget={widget} />;
  }
  if (vizType === "line") {
    return <SchoolVitalsSeriesChart widget={widget} range={range} mode="line" />;
  }
  if (vizType === "area") {
    return <SchoolVitalsSeriesChart widget={widget} range={range} mode="area" />;
  }
  if (vizType === "bar") return <BarChartView data={widget.data} />;
  if (vizType === "combo") return <ComboChartView data={widget.data} />;
  if (vizType === "pie") return <PieChartView data={widget.data} />;
  if (vizType === "donut") return <PieChartView data={widget.data} donut />;
  if (vizType === "table") return <TableView data={widget.data} />;
  if (widget.defaultViz === "line") return <LineChartView data={widget.data} />;
  if (widget.defaultViz === "area") return <AreaChartView data={widget.data} />;
  return <TableView data={widget.data} />;
}

export function SchoolVitalsChartWidget({
  widget,
  slug,
  range,
}: {
  widget: InsightWidget;
  slug: string;
  range: InsightDashboardRange;
}) {
  const compatible = useMemo(() => {
    const types = getCompatibleVizTypes(widget.data);
    const preferred: VizType[] = [
      widget.defaultViz,
      "line",
      "area",
      "bar",
      "table",
      "funnel",
      "pie",
    ];
    return preferred.filter((type) => types.includes(type));
  }, [widget.data, widget.defaultViz]);

  const [vizType, setVizType] = useState<VizType>(() => {
    const preferred = getPreferredVizType(widgetPreferenceKey(widget.id));
    if (preferred && compatible.includes(preferred)) return preferred;
    return widget.defaultViz;
  });

  return (
    <SchoolVitalsWidgetFrame
      widget={widget}
      slug={slug}
      range={range}
      compatible={compatible}
      vizType={vizType}
      onVizChange={(next) => {
        setVizType(next);
        setPreferredVizType(widgetPreferenceKey(widget.id), next);
      }}
    >
      {renderVizBody(widget, vizType, range, slug)}
    </SchoolVitalsWidgetFrame>
  );
}

export function schoolVitalsWidgetSpanClass(span: InsightWidget["span"]): string {
  if (span === "full") return "col-span-12";
  if (span === "third") return "col-span-12 md:col-span-6 xl:col-span-4";
  return "col-span-12 md:col-span-6";
}

export function SchoolVitalsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading school vitals">
      <div className={`${insightShimmerClassName} h-12 w-full rounded`} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {["population", "activity"].map((group) => (
          <div key={group} className={insightGroupPanelClassName}>
            <div className={`${insightShimmerClassName} mb-6 h-5 w-1/3 rounded`} />
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: group === "population" ? 6 : 8 }, (_, index) => (
                <div key={index} className={`${insightShimmerClassName} h-20 rounded`} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-12 gap-6">
        <div className={`${insightPanelClassName} col-span-12 h-[320px] p-5`}>
          <div className={`${insightShimmerClassName} mb-6 h-5 w-48 rounded`} />
          <div className={`${insightShimmerClassName} h-56 w-full rounded`} />
        </div>
        <div className={`${insightPanelClassName} col-span-12 h-[280px] p-5 md:col-span-6`}>
          <div className={`${insightShimmerClassName} mb-6 h-5 w-40 rounded`} />
          <div className={`${insightShimmerClassName} h-44 w-full rounded`} />
        </div>
        <div className={`${insightPanelClassName} col-span-12 h-[280px] p-5 md:col-span-6`}>
          <div className={`${insightShimmerClassName} mb-6 h-5 w-44 rounded`} />
          <div className={`${insightShimmerClassName} h-44 w-full rounded`} />
        </div>
        <div className={`${insightPanelClassName} col-span-12 h-[320px] p-5`}>
          <div className={`${insightShimmerClassName} mb-6 h-5 w-52 rounded`} />
          <div className={`${insightShimmerClassName} h-56 w-full rounded`} />
        </div>
        <div className={`${insightPanelClassName} col-span-12 h-[320px] p-5 md:col-span-6`}>
          <div className={`${insightShimmerClassName} mb-6 h-5 w-56 rounded`} />
          <div className="flex flex-1 flex-col items-center gap-3">
            <div className={`${insightShimmerClassName} h-10 w-full rounded`} />
            <div className={`${insightShimmerClassName} h-10 w-5/6 rounded`} />
            <div className={`${insightShimmerClassName} h-10 w-2/3 rounded`} />
            <div className={`${insightShimmerClassName} h-10 w-1/2 rounded`} />
          </div>
        </div>
        <div className={`${insightPanelClassName} col-span-12 h-[320px] p-5 md:col-span-6`}>
          <div className={`${insightShimmerClassName} mb-6 h-5 w-36 rounded`} />
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="mb-3 flex items-center gap-3">
              <div className={`${insightShimmerClassName} h-4 w-2/3 rounded`} />
              <div className={`${insightShimmerClassName} ml-auto h-4 w-10 rounded`} />
            </div>
          ))}
        </div>
        <div className={`${insightPanelClassName} col-span-12 overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-[var(--admin-border)] p-5">
            <div className={`${insightShimmerClassName} h-5 w-56 rounded`} />
            <div className={`${insightShimmerClassName} h-8 w-16 rounded`} />
          </div>
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="grid grid-cols-4 gap-4 border-b border-[var(--admin-border)] px-5 py-3 last:border-b-0"
            >
              <div className={`${insightShimmerClassName} h-4 w-3/4 rounded`} />
              <div className={`${insightShimmerClassName} h-4 w-full rounded`} />
              <div className={`${insightShimmerClassName} h-4 w-1/2 rounded`} />
              <div className={`${insightShimmerClassName} ml-auto h-4 w-1/3 rounded`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
