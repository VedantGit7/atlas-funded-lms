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
  CreditCard,
  Download,
  History,
  Inbox,
  Lightbulb,
  LineChart,
  Megaphone,
  RefreshCw,
  Search,
  Share2,
  Table2,
  TrendingUp,
  Users,
  Workflow,
  X,
} from "lucide-react";
import { inlineExpandClassName } from "../../studio/courses/admin-form-dropdown-shared";
import {
  ADMIN_INSIGHTS_HREF,
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
  MARKETING_ATTRIBUTION_PAIR_CAPTION,
  MARKETING_BAR_WIDGET_IDS,
  MARKETING_CTA_EMPTY_CAPTION,
  MARKETING_DAILY_LEADS_CAPTION,
  MARKETING_DUAL_SERIES_IDS,
  MARKETING_FIXED_WINDOW_CAPTION,
  MARKETING_INSIGHT_MONEY_KPI_IDS,
  MARKETING_INSIGHT_PERCENT_KPI_IDS,
  MARKETING_TABLE_WIDGET_IDS,
  marketingStatusTone,
  marketingWidgetEmptyCopy,
  type MarketingStatusTone,
} from "./marketing-insight-meta";

type DetailViz = "area" | "line" | "bar" | "table";

type MarketingInsightWidgetDetailViewProps = {
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

type DualPoint = {
  label: string;
  longLabel: string;
  submissions: number;
  contacts: number;
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
  if (MARKETING_DUAL_SERIES_IDS.has(widget.id)) return "submissions";
  if (widget.id === "top-sources" || widget.id === "top-campaigns-utm") return "events";
  if (widget.id === "top-forms") return "submissions";
  if (widget.id === "top-coupons") return "redemptions";
  return widget.data.measures?.[0] ?? "value";
}

function isDualSeries(widgetId: string): boolean {
  return MARKETING_DUAL_SERIES_IDS.has(widgetId);
}

function isBarWidget(widgetId: string): boolean {
  return MARKETING_BAR_WIDGET_IDS.has(widgetId);
}

function isTableWidget(widgetId: string): boolean {
  return MARKETING_TABLE_WIDGET_IDS.has(widgetId);
}

function isKpiWidget(widget: InsightWidget): boolean {
  return widget.defaultViz === "kpi";
}

function isPercentKpi(widgetId: string): boolean {
  return MARKETING_INSIGHT_PERCENT_KPI_IDS.has(widgetId);
}

function isMoneyKpi(widgetId: string): boolean {
  return MARKETING_INSIGHT_MONEY_KPI_IDS.has(widgetId);
}

function moneyColumn(key: string): boolean {
  return key === "revenue" || key === "discount" || key === "amount";
}

function tableHasMoney(widgetId: string): boolean {
  return (
    widgetId === "top-sources" || widgetId === "top-campaigns-utm" || widgetId === "top-coupons"
  );
}

function statusColumn(key: string): boolean {
  return key === "status";
}

function widgetHasNoEvents(widget: InsightWidget): boolean {
  if (widget.data.rows.length === 0) return true;
  if (isDualSeries(widget.id)) {
    return widget.data.rows.every(
      (row) =>
        numericValue(cell(row, "submissions")) <= 0 && numericValue(cell(row, "contacts")) <= 0,
    );
  }
  if (isTableWidget(widget.id)) return widget.data.rows.length === 0;
  if (isKpiWidget(widget)) {
    if (
      isPercentKpi(widget.id) &&
      (widget.footnote === MARKETING_CTA_EMPTY_CAPTION ||
        widget.footnote?.toLowerCase().includes("no cta views"))
    ) {
      return true;
    }
    return numericValue(cell(widget.data.rows[0], "value")) <= 0;
  }
  const key = measureKey(widget);
  return widget.data.rows.every((row) => numericValue(cell(row, key)) === 0);
}

function formatMetric(value: number, widgetId: string, currency?: string): string {
  if (isPercentKpi(widgetId)) return `${formatInsightNumber(value)}%`;
  if (isMoneyKpi(widgetId)) return formatInsightMoneyWithCode(value, currency);
  const digits = value % 1 === 0 ? 0 : 1;
  return formatInsightNumber(value, digits);
}

function formatCompact(value: number, money = false): string {
  if (money) {
    if (value >= 1_000_000) return `${formatInsightNumber(value / 1_000_000, 1)}M`;
    if (value >= 1000) return `${formatInsightNumber(value / 1000, 0)}k`;
    return formatInsightNumber(value, value >= 100 ? 0 : 1);
  }
  if (value >= 1_000_000) return `${formatInsightNumber(value / 1_000_000, 1)}M`;
  if (value >= 1000) return `${formatInsightNumber(value / 1000, 0)}k`;
  return formatInsightNumber(value, value >= 100 ? 0 : 1);
}

function compatibleViz(widget: InsightWidget): DetailViz[] {
  if (isTableWidget(widget.id) || isKpiWidget(widget)) return ["table"];
  if (isBarWidget(widget.id)) return ["bar", "table"];
  if (isDualSeries(widget.id)) return ["line", "area", "bar", "table"];
  return ["line", "area", "bar", "table"];
}

function defaultViz(widget: InsightWidget): DetailViz {
  const options = compatibleViz(widget);
  if (widget.defaultViz === "area" && options.includes("area")) return "area";
  if (widget.defaultViz === "bar" && options.includes("bar")) return "bar";
  if (widget.defaultViz === "table" && options.includes("table")) return "table";
  if (widget.defaultViz === "line" && options.includes("line")) return "line";
  return options[0] ?? "table";
}

function collapseSplits(rows: InsightWidgetSplitRow[], limit = 4): InsightWidgetSplitRow[] {
  if (rows.length <= limit) return rows;
  const head = rows.slice(0, limit - 1);
  const rest = rows.slice(limit - 1);
  const value = rest.reduce((sum, row) => sum + row.value, 0);
  const share = rest.reduce((sum, row) => sum + row.share, 0);
  return [...head, { label: `Other (${String(rest.length)})`, value, share }];
}

function buildDualPoints(widget: InsightWidget, range: InsightDashboardRange): DualPoint[] {
  return widget.data.rows.map((row) => {
    const raw = stringValue(cell(row, "period"));
    return {
      label: formatPeriodLabel(raw, range),
      longLabel: range === "30d" ? formatPeriodLabel(raw, range) : formatPeriodLong(raw),
      submissions: numericValue(cell(row, "submissions")),
      contacts: numericValue(cell(row, "contacts")),
    };
  });
}

function pairedWidgetHref(slug: string, pairedId: string, overlay: boolean): string {
  const base = adminInsightWidgetHref(slug, pairedId);
  return overlay ? `${base}?overlay=1` : base;
}

function pairedSwapLabel(widgetId: string): string | null {
  if (widgetId === "attribution-by-source") return "Show medium";
  if (widgetId === "attribution-by-medium") return "Show source";
  return null;
}

function searchPlaceholder(widgetId: string): string {
  switch (widgetId) {
    case "top-forms":
      return "Search forms...";
    case "top-ctas":
      return "Search CTAs...";
    case "top-coupons":
      return "Search coupons...";
    case "recent-workflow-runs":
      return "Search workflow runs...";
    case "marketing-inventory":
      return "Search assets...";
    case "top-sources":
      return "Search sources...";
    case "top-campaigns-utm":
      return "Search campaigns...";
    default:
      return "Search records...";
  }
}

function Shimmer({ className }: { className: string }) {
  return <div className={`${insightShimmerClassName} ${className}`} />;
}

function statusPillClass(tone: MarketingStatusTone): string {
  if (tone === "success") {
    return "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]";
  }
  if (tone === "danger") {
    return "border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]";
  }
  if (tone === "warning") {
    return "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]";
  }
  return "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]";
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

function EmptyCanvas({
  title,
  body,
  href,
  hrefLabel,
  icon,
}: {
  title: string;
  body: string;
  href?: string | null | undefined;
  hrefLabel?: string | undefined;
  icon?: ReactNode | undefined;
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-b-xl bg-[color-mix(in_srgb,var(--admin-page)_50%,transparent)] px-8 py-12 text-center">
      <div className="mb-4 text-[var(--admin-on-surface-variant)]">
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

function WidgetDetailSkeleton({ dualHeadline }: { dualHeadline?: boolean | undefined }) {
  const headlineCount = dualHeadline ? 5 : 4;
  return (
    <div className="grid grid-cols-12 gap-6" aria-busy="true" aria-label="Loading widget detail">
      {!dualHeadline ? (
        <div className="col-span-12">
          <Shimmer className="mb-2 h-4 w-64" />
        </div>
      ) : null}
      <div className="col-span-12 flex flex-wrap gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 lg:col-span-8">
        {Array.from({ length: headlineCount }, (_, index) => (
          <div key={index} className="min-w-[140px] flex-1">
            <Shimmer className="mb-3 h-3 w-1/2" />
            <Shimmer className="h-8 w-2/3" />
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

function DualSeriesChart({
  points,
  viz,
  average,
  widgetTitle,
}: {
  points: DualPoint[];
  viz: "area" | "line" | "bar";
  average: number | null;
  widgetTitle: string;
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
  const max = Math.max(
    ...visible.flatMap((point) => [point.submissions, point.contacts]),
    average ?? 0,
    1,
  );
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const avgY = average != null ? padT + innerH - (average / max) * innerH : null;
  const xFor = (index: number, count: number) =>
    padL + (count <= 1 ? innerW / 2 : (index / Math.max(count - 1, 1)) * innerW);

  const pathFor = (key: "submissions" | "contacts") =>
    visible
      .map((point, index) => {
        const x = xFor(index, visible.length);
        const y = padT + innerH - (point[key] / max) * innerH;
        return `${index === 0 ? "M" : "L"} ${String(x)} ${String(y)}`;
      })
      .join(" ");

  const submissionsPath = pathFor("submissions");
  const contactsPath = pathFor("contacts");
  const areaPath =
    visible.length === 0
      ? ""
      : `${submissionsPath} L ${String(xFor(visible.length - 1, visible.length))} ${String(padT + innerH)} L ${String(xFor(0, visible.length))} ${String(padT + innerH)} Z`;

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
          <linearGradient id="mi-detail-area" x1="0" x2="0" y1="0" y2="1">
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
                {formatCompact(max * ratio)}
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
              {`Average ${formatCompact(average ?? 0)}`}
            </text>
          </g>
        ) : null}
        {viz === "bar"
          ? visible.map((point, index) => {
              const groupWidth = innerW / Math.max(visible.length, 1);
              const barW = Math.min(14, groupWidth / 2 - 4);
              const gap = 4;
              const baseX = padL + index * groupWidth + groupWidth / 2 - barW - gap / 2;
              const contactH = (point.contacts / max) * innerH;
              const submissionH = (point.submissions / max) * innerH;
              const active = hover === index;
              return (
                <g key={point.longLabel}>
                  <rect
                    x={baseX}
                    y={padT + innerH - contactH}
                    width={barW}
                    height={contactH}
                    rx={2}
                    fill="var(--admin-primary-container)"
                    opacity={active || hover == null ? 1 : 0.45}
                  />
                  <rect
                    x={baseX + barW + gap}
                    y={padT + innerH - submissionH}
                    width={barW}
                    height={submissionH}
                    rx={2}
                    fill="var(--admin-primary)"
                    opacity={active || hover == null ? 1 : 0.45}
                  />
                </g>
              );
            })
          : null}
        {viz === "area" ? <path d={areaPath} fill="url(#mi-detail-area)" /> : null}
        {viz !== "bar" ? (
          <>
            <path
              d={contactsPath}
              fill="none"
              stroke="var(--admin-primary-container)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={submissionsPath}
              fill="none"
              stroke="var(--admin-primary)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : null}
        {visible.map((point, index) => {
          const x = xFor(index, visible.length);
          const y = padT + innerH - (point.submissions / max) * innerH;
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
                <>
                  <circle
                    cx={x}
                    cy={padT + innerH - (point.contacts / max) * innerH}
                    r={active ? 4 : 3}
                    fill="var(--admin-surface)"
                    stroke="var(--admin-primary-container)"
                    strokeWidth={2}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={active ? 5 : 4}
                    fill={active ? "var(--admin-primary)" : "var(--admin-surface)"}
                    stroke="var(--admin-primary)"
                    strokeWidth={2}
                  />
                </>
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
              x={Math.min(Math.max(xFor(hover, visible.length) - 84, padL), width - padR - 168)}
              y={Math.max(
                padT + 4,
                padT + innerH - (visible[hover].submissions / max) * innerH - 78,
              )}
              width={168}
              height={72}
              rx={4}
              fill="var(--admin-on-surface)"
            />
            <text
              x={Math.min(Math.max(xFor(hover, visible.length), padL + 84), width - padR - 84)}
              y={Math.max(
                padT + 20,
                padT + innerH - (visible[hover].submissions / max) * innerH - 62,
              )}
              textAnchor="middle"
              fill="var(--admin-surface)"
              fontSize={10}
              className="font-data"
            >
              {visible[hover].longLabel}
            </text>
            <text
              x={Math.min(Math.max(xFor(hover, visible.length), padL + 84), width - padR - 84)}
              y={Math.max(
                padT + 36,
                padT + innerH - (visible[hover].submissions / max) * innerH - 46,
              )}
              textAnchor="middle"
              fill="var(--admin-surface)"
              fontSize={11}
              className="font-data"
            >
              {`Contacts ${formatInsightNumber(visible[hover].contacts)}`}
            </text>
            <text
              x={Math.min(Math.max(xFor(hover, visible.length), padL + 84), width - padR - 84)}
              y={Math.max(
                padT + 50,
                padT + innerH - (visible[hover].submissions / max) * innerH - 32,
              )}
              textAnchor="middle"
              fill="var(--admin-surface)"
              fontSize={11}
              fontWeight={600}
              className="font-data"
            >
              {`Submissions ${formatInsightNumber(visible[hover].submissions)}`}
            </text>
            <text
              x={Math.min(Math.max(xFor(hover, visible.length), padL + 84), width - padR - 84)}
              y={Math.max(
                padT + 64,
                padT + innerH - (visible[hover].submissions / max) * innerH - 18,
              )}
              textAnchor="middle"
              fill="var(--admin-surface)"
              fontSize={10}
              className="font-data"
            >
              {`Gap ${formatInsightNumber(Math.max(visible[hover].submissions - visible[hover].contacts, 0))}`}
            </text>
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

function AttributionBarChart({ widget }: { widget: InsightWidget }) {
  const rows = widget.data.rows;
  const maxValue = Math.max(...rows.map((row) => numericValue(cell(row, "value"))), 1);

  return (
    <div className="flex flex-col gap-5 p-6">
      {rows.map((row, index) => {
        const label = stringValue(cell(row, "label"), "Unknown");
        const value = numericValue(cell(row, "value"));
        const widthPct = Math.max((value / maxValue) * 100, value > 0 ? 4 : 0);
        const opacity = Math.max(0.25, 1 - index * 0.15);
        return (
          <div
            key={`${label}-${String(index)}`}
            className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-4"
          >
            <div className="flex justify-end">
              <span className="inline-flex max-w-full truncate rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 font-data text-xs text-[var(--admin-on-surface-variant)]">
                {label}
              </span>
            </div>
            <div className="group relative h-8 overflow-hidden rounded bg-[var(--admin-surface-low)]">
              <div
                className="absolute inset-y-0 left-0 rounded bg-[var(--admin-primary)] motion-safe:transition-[width,opacity] motion-safe:duration-300 group-hover:opacity-100"
                style={{ width: `${String(widthPct)}%`, opacity }}
              />
            </div>
            <span className="w-24 text-right font-data text-sm tabular-nums text-[var(--admin-on-surface)]">
              {formatInsightNumber(value)}
            </span>
          </div>
        );
      })}
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

function ShareBar({ share }: { share: number }) {
  return (
    <div className="mt-1 h-[3px] w-full max-w-[7rem] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--admin-outline)_30%,transparent)] ml-auto">
      <div
        className="h-full bg-[var(--admin-primary)]"
        style={{ width: `${String(Math.min(Math.max(share, 0), 100))}%` }}
      />
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
            <th className={`${insightTableHeadClassName} px-6 py-3 text-right`}>Value</th>
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
                    ? formatInsightMoneyWithCode(row.value, currency)
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

function DualUnderlyingTable({ points }: { points: DualPoint[] }) {
  return (
    <div className="overflow-x-auto rounded border border-[var(--admin-border)]">
      <table className="w-full min-w-[480px] border-collapse text-left">
        <thead>
          <tr>
            <th className={`${insightTableHeadClassName} px-4 py-2.5`}>Date</th>
            <th className={`${insightTableHeadClassName} px-4 py-2.5 text-right`}>Submissions</th>
            <th className={`${insightTableHeadClassName} px-4 py-2.5 text-right`}>Contacts</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.longLabel} className={insightTableRowClassName}>
              <td className="px-4 py-2 text-sm text-[var(--admin-on-surface)]">
                {point.longLabel}
              </td>
              <td className="px-4 py-2 text-right font-data text-sm">
                {formatInsightNumber(point.submissions)}
              </td>
              <td className="px-4 py-2 text-right font-data text-sm">
                {formatInsightNumber(point.contacts)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-[var(--admin-border)] px-4 py-2 text-xs text-[var(--admin-on-surface-variant)]">
        {`${String(points.length)} ${points.length === 1 ? "row" : "rows"}`}
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
  const moneyTable = tableHasMoney(widget.id);
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
                  {column.label}
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
                let display = stringValue(raw, "");
                if (measure && moneyColumn(column.key) && moneyTable) {
                  display = formatInsightMoneyWithCode(numericValue(raw), currency);
                } else if (measure) {
                  display = formatInsightNumber(
                    numericValue(raw),
                    numericValue(raw) % 1 === 0 ? 0 : 1,
                  );
                } else if (column.key === "period") {
                  display = formatPeriodLabel(stringValue(raw), range);
                } else if (statusColumn(column.key)) {
                  return (
                    <td key={column.key} className="px-4 py-2">
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 font-data text-[11px] uppercase tracking-wide ${statusPillClass(marketingStatusTone(display))}`}
                      >
                        {display || "-"}
                      </span>
                    </td>
                  );
                }
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

function DataTable({ widget, currency }: { widget: InsightWidget; currency?: string | undefined }) {
  const columns = exportColumns(widget);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string>(measureKey(widget));
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const pageSize = 8;
  const totalMeasure = measureKey(widget);
  const grandTotal =
    widget.data.rows.reduce((sum, row) => sum + numericValue(cell(row, totalMeasure)), 0) || 1;
  const moneyTable = tableHasMoney(widget.id);
  const showShare = Boolean(totalMeasure) && widget.data.rows.length > 0;
  const failedRun = widget.id === "recent-workflow-runs";

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
            placeholder={searchPlaceholder(widget.id)}
            className="h-full w-full rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] pl-9 pr-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
          />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead className="sticky top-0 z-[1] bg-[var(--admin-surface-low)]">
            <tr>
              {failedRun ? (
                <th className={`${insightTableHeadClassName} w-2 px-0 py-3`} aria-hidden="true" />
              ) : null}
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
              const statusRaw = stringValue(cell(row, "status"), "");
              const rowFailed = failedRun && marketingStatusTone(statusRaw) === "danger";
              return (
                <tr
                  key={`${stringValue(cell(row, columns[0]?.key ?? "id"), "row")}-${String(index)}`}
                  className={`${insightTableRowClassName} group ${
                    rowFailed
                      ? "bg-[color-mix(in_srgb,var(--admin-danger)_5%,var(--admin-surface))]"
                      : ""
                  }`}
                >
                  {failedRun ? (
                    <td className="relative w-2 p-0">
                      {rowFailed ? (
                        <div
                          className="absolute bottom-0 left-0 top-0 w-0.5 bg-[var(--admin-danger)]"
                          aria-hidden="true"
                        />
                      ) : null}
                    </td>
                  ) : null}
                  {columns.map((column, columnIndex) => {
                    const raw = cell(row, column.key);
                    const measure = column.kind === "measure" || column.kind === "number";
                    const money = moneyColumn(column.key) && moneyTable;
                    let display = stringValue(raw, "");
                    if (measure && money) {
                      display = formatInsightMoneyWithCode(numericValue(raw), currency);
                    } else if (measure) {
                      display = formatInsightNumber(numericValue(raw));
                    } else if (column.key === "created" || column.kind === "date") {
                      display = formatPeriodLong(stringValue(raw));
                    }
                    const lead = columnIndex === 0;
                    if (statusColumn(column.key)) {
                      return (
                        <td key={column.key} className="px-4 py-2">
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 font-data text-[11px] uppercase tracking-wide ${statusPillClass(marketingStatusTone(display))}`}
                          >
                            {display || "-"}
                          </span>
                        </td>
                      );
                    }
                    if (column.key === "type") {
                      return (
                        <td key={column.key} className="px-4 py-2">
                          <span className="inline-flex rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 font-data text-[11px] text-[var(--admin-on-surface-variant)]">
                            {display || "-"}
                          </span>
                        </td>
                      );
                    }
                    return (
                      <td
                        key={column.key}
                        className={`px-4 py-2 text-sm ${
                          measure ? "text-right font-data" : "text-[var(--admin-on-surface)]"
                        } ${lead && (widget.id === "top-forms" || widget.id === "top-ctas" || widget.id === "recent-workflow-runs") ? "font-medium text-[var(--admin-primary)]" : ""}`}
                      >
                        {lead && href ? (
                          <Link
                            href={href}
                            prefetch={false}
                            className="outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                          >
                            {display || "Untitled"}
                          </Link>
                        ) : measure && showShare ? (
                          <>
                            <span>{display}</span>
                            <ShareBar share={Math.round((numericValue(raw) / grandTotal) * 100)} />
                          </>
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
        {filtered.length > pageSize ? (
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
        ) : null}
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
      return <Megaphone className={className} aria-hidden="true" />;
    case "inbox":
      return <Inbox className={className} aria-hidden="true" />;
    case "live":
      return <Activity className={className} aria-hidden="true" />;
  }
}

function RelatedRail({
  related,
  loadingFallback,
  generatedAt,
  widgetId,
  currency,
}: {
  related: InsightWidgetDetail["related"];
  loadingFallback?: boolean | undefined;
  generatedAt?: string | undefined;
  widgetId?: string | undefined;
  currency?: string | undefined;
}) {
  return (
    <aside className="flex flex-col gap-4 lg:col-span-4">
      <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--admin-on-surface)]">
        Related insights
      </h2>
      {loadingFallback ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }, (_, index) => (
            <div
              key={index}
              className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
            >
              <Shimmer className="mb-2 h-3 w-full" />
              <Shimmer className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : related.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-10 text-center">
          <Inbox className="mb-2 h-6 w-6 text-[var(--admin-outline)]" aria-hidden="true" />
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            No related insights found.
          </p>
          <Link
            href="/admin/marketing/forms/contacts"
            prefetch={false}
            className={`${insightGhostButtonClassName} mt-4`}
          >
            Marketing forms
          </Link>
        </div>
      ) : (
        related.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className="group flex items-start justify-between gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 outline-none transition-[background-color,border-color,transform] duration-200 hover:-translate-y-px hover:border-[var(--admin-outline)] hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 motion-safe:active:translate-y-px"
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
      {widgetId || generatedAt ? (
        <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            Widget metadata
          </h3>
          <dl className="flex flex-col gap-2 font-data text-[11px] text-[var(--admin-on-surface-variant)]">
            {widgetId ? (
              <div className="flex justify-between border-b border-[var(--admin-border)] pb-1">
                <dt>ID</dt>
                <dd className="text-[var(--admin-on-surface)]">{widgetId}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-b border-[var(--admin-border)] pb-1">
              <dt>Window</dt>
              <dd className="text-right text-[var(--admin-on-surface)]">
                {MARKETING_FIXED_WINDOW_CAPTION}
              </dd>
            </div>
            {currency ? (
              <div className="flex justify-between border-b border-[var(--admin-border)] pb-1">
                <dt>Currency</dt>
                <dd className="text-[var(--admin-on-surface)]">{currency}</dd>
              </div>
            ) : null}
            {generatedAt ? (
              <div className="flex justify-between pb-1">
                <dt>Last refreshed</dt>
                <dd className="text-[var(--admin-on-surface)]">
                  {formatRelativeTime(generatedAt)}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}
    </aside>
  );
}

export function MarketingInsightWidgetDetailView({
  slug,
  sectionTitle,
  detail,
  loading,
  error,
  range,
  overlay,
  onRefresh,
}: MarketingInsightWidgetDetailViewProps) {
  const router = useRouter();
  const widget = detail?.widget ?? null;
  const currency = detail?.currency;
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
    setDataOpen(false);
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
  const csvCols = widget ? exportColumns(widget) : [];
  const csvRows = widget ? widget.data.rows : [];
  const dualPoints = widget && isDualSeries(widget.id) ? buildDualPoints(widget, range) : [];
  const submissionsTotal = dualPoints.reduce((sum, point) => sum + point.submissions, 0);
  const contactsTotal =
    detail?.secondaryTotal ?? dualPoints.reduce((sum, point) => sum + point.contacts, 0);
  const contactsAverage =
    detail?.secondaryAverage ?? (dualPoints.length > 0 ? contactsTotal / dualPoints.length : null);
  const kpiValue =
    widget == null
      ? 0
      : isKpiWidget(widget)
        ? numericValue(cell(widget.data.rows[0], "value"))
        : numericValue(cell(widget.data.rows[0], measureKey(widget)));
  const emptyCopy = widget ? marketingWidgetEmptyCopy(widget.id) : null;
  const showVizSwitcher = widget != null && !isKpiWidget(widget) && vizOptions.length > 1;
  const swapLabel = widget ? pairedSwapLabel(widget.id) : null;
  const pairedHref =
    detail?.pairedWidget && widget ? pairedWidgetHref(slug, detail.pairedWidget.id, overlay) : null;

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
                className="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 motion-safe:active:translate-y-px"
                aria-label={`Back to ${sectionTitle}`}
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className={insightPageTitleClassName}>
                {widget?.title ?? (loading ? "Loading widget" : "Widget")}
              </h1>
              {widget ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-0.5 font-data text-[10px] uppercase tracking-wider text-[var(--admin-on-surface-variant)] outline-none hover:border-[var(--admin-outline)] hover:bg-[var(--admin-surface-low)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 motion-safe:active:translate-y-px"
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
          {showVizSwitcher ? (
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
                    {option === "area" ? (
                      <AreaChart className="h-4 w-4" aria-hidden="true" />
                    ) : null}
                    {option === "line" ? (
                      <LineChart className="h-4 w-4" aria-hidden="true" />
                    ) : null}
                    {option === "bar" ? <BarChart3 className="h-4 w-4" aria-hidden="true" /> : null}
                    {option === "table" ? <Table2 className="h-4 w-4" aria-hidden="true" /> : null}
                    {option === "area"
                      ? "Area"
                      : option === "line"
                        ? "Line"
                        : option === "bar"
                          ? "Bar"
                          : "Table"}
                  </button>
                );
              })}
            </div>
          ) : null}
          {pairedHref && swapLabel ? (
            <Link href={pairedHref} prefetch={false} className={insightGhostButtonClassName}>
              <Share2 className="h-4 w-4" aria-hidden="true" />
              {swapLabel}
            </Link>
          ) : null}
          <button
            type="button"
            className={`${insightGhostButtonClassName} motion-safe:active:translate-y-px`}
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
            className={`${insightGhostButtonClassName} motion-safe:active:translate-y-px`}
            disabled={!widget}
            onClick={() => {
              if (!widget) return;
              downloadCsv(`${widget.id}.csv`, widgetToCsv(csvCols, csvRows));
            }}
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <Link
            href="/admin/marketing/forms/contacts"
            prefetch={false}
            className={`${insightPrimaryButtonClassName} motion-safe:active:translate-y-px`}
          >
            Marketing forms
            <ArrowUpRight className="h-4 w-4" />
          </Link>
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
                className={`${insightGhostButtonClassName} mt-4 motion-safe:active:translate-y-px`}
                onClick={onRefresh}
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            </div>
          </div>
        ) : null}

        {loading && !detail ? (
          <WidgetDetailSkeleton dualHeadline={widget?.id === "daily-leads" || !widget} />
        ) : null}

        {detail && widget && !error ? (
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            <div className="flex flex-col gap-6 lg:col-span-8">
              {isDualSeries(widget.id) ? (
                <section className="flex flex-wrap items-end gap-8 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
                  <HeadlineCell label="Submissions">
                    <div className={insightKpiValueClassName}>
                      {empty ? "â€”" : formatInsightNumber(submissionsTotal)}
                    </div>
                  </HeadlineCell>
                  <div
                    className="hidden h-10 w-px bg-[var(--admin-border)] md:block"
                    aria-hidden="true"
                  />
                  <HeadlineCell label="Contacts">
                    <div className={insightKpiValueClassName}>
                      {empty ? "â€”" : formatInsightNumber(contactsTotal)}
                    </div>
                  </HeadlineCell>
                  {detail.comparison ? (
                    <>
                      <div
                        className="hidden h-10 w-px bg-[var(--admin-border)] lg:block"
                        aria-hidden="true"
                      />
                      <HeadlineCell label="Abs delta">
                        <div
                          className={`flex items-center gap-2 font-data text-sm ${
                            detail.comparison.deltaAbs === 0
                              ? "text-[var(--admin-on-surface-variant)]"
                              : detail.comparison.deltaAbs > 0
                                ? "text-[var(--admin-success)]"
                                : "text-[var(--admin-warning)]"
                          }`}
                        >
                          {detail.comparison.deltaAbs >= 0 ? (
                            <ArrowUp className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <ArrowDown className="h-4 w-4" aria-hidden="true" />
                          )}
                          <span>
                            {`${detail.comparison.deltaAbs >= 0 ? "+" : ""}${formatInsightNumber(detail.comparison.deltaAbs)}`}
                          </span>
                        </div>
                      </HeadlineCell>
                      <div
                        className="hidden h-10 w-px bg-[var(--admin-border)] lg:block"
                        aria-hidden="true"
                      />
                      <div
                        className={`relative min-w-[140px] flex-1 overflow-hidden rounded-lg p-1 ${
                          detail.comparison.deltaPct != null && detail.comparison.deltaPct > 0
                            ? "bg-[color-mix(in_srgb,var(--admin-success)_6%,transparent)]"
                            : detail.comparison.deltaPct != null && detail.comparison.deltaPct < 0
                              ? "bg-[color-mix(in_srgb,var(--admin-warning)_6%,transparent)]"
                              : ""
                        }`}
                      >
                        <HeadlineCell label="Pct delta">
                          {detail.comparison.deltaPct != null ? (
                            <div
                              className={`flex items-center gap-2 font-data text-sm ${
                                detail.comparison.deltaPct === 0
                                  ? "text-[var(--admin-on-surface-variant)]"
                                  : detail.comparison.deltaPct > 0
                                    ? "text-[var(--admin-success)]"
                                    : "text-[var(--admin-warning)]"
                              }`}
                            >
                              {detail.comparison.deltaPct > 0 ? (
                                <TrendingUp className="h-4 w-4" aria-hidden="true" />
                              ) : detail.comparison.deltaPct < 0 ? (
                                <ArrowDown className="h-4 w-4" aria-hidden="true" />
                              ) : null}
                              <span className={insightKpiValueClassName}>
                                {`${detail.comparison.deltaPct >= 0 ? "+" : ""}${formatInsightNumber(detail.comparison.deltaPct, 1)}%`}
                              </span>
                            </div>
                          ) : (
                            <span className="font-data text-sm text-[var(--admin-on-surface-variant)]">
                              -
                            </span>
                          )}
                        </HeadlineCell>
                      </div>
                    </>
                  ) : null}
                  <div
                    className="hidden h-10 w-px bg-[var(--admin-border)] lg:block"
                    aria-hidden="true"
                  />
                  <HeadlineCell label="30d average">
                    <span className="font-data text-sm text-[var(--admin-on-surface)]">
                      {empty || detail.average == null
                        ? "â€”"
                        : formatInsightNumber(detail.average, detail.average % 1 === 0 ? 0 : 1)}
                    </span>
                    {contactsAverage != null && !empty ? (
                      <p className="mt-1 text-[10px] text-[var(--admin-on-surface-variant)]">
                        {`Contacts avg ${formatInsightNumber(contactsAverage, contactsAverage % 1 === 0 ? 0 : 1)}`}
                      </p>
                    ) : null}
                  </HeadlineCell>
                </section>
              ) : null}

              {isKpiWidget(widget) ? (
                <section className="flex flex-wrap items-end gap-8 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
                  <HeadlineCell label={widget.title}>
                    <div className={insightKpiValueClassName}>
                      {empty ? "â€”" : formatMetric(kpiValue, widget.id, currency)}
                    </div>
                  </HeadlineCell>
                  {detail.comparison ? (
                    <>
                      <div
                        className="hidden h-10 w-px bg-[var(--admin-border)] md:block"
                        aria-hidden="true"
                      />
                      <HeadlineCell label="Vs previous">
                        <div
                          className={`flex items-center gap-2 font-data text-sm ${
                            detail.comparison.deltaAbs === 0
                              ? "text-[var(--admin-on-surface-variant)]"
                              : detail.comparison.deltaAbs > 0
                                ? "text-[var(--admin-success)]"
                                : "text-[var(--admin-warning)]"
                          }`}
                        >
                          {detail.comparison.deltaAbs >= 0 ? (
                            <ArrowUp className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <ArrowDown className="h-4 w-4" aria-hidden="true" />
                          )}
                          <span>
                            {`${detail.comparison.deltaAbs >= 0 ? "+" : ""}${formatMetric(detail.comparison.deltaAbs, widget.id, currency)}`}
                          </span>
                        </div>
                      </HeadlineCell>
                    </>
                  ) : null}
                </section>
              ) : null}

              {isBarWidget(widget.id) && !isTableWidget(widget.id) ? (
                <section className={insightPanelClassName}>
                  <header className="flex items-center justify-between border-b border-[var(--admin-border)] px-5 py-3">
                    <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                      {viz === "table" ? "Records" : widget.title}
                    </h2>
                  </header>
                  {empty ? (
                    <EmptyCanvas
                      title={emptyCopy?.title ?? "No data available"}
                      body={emptyCopy?.body ?? "Activity will appear here once events are tracked."}
                      icon={<Share2 className="h-12 w-12" aria-hidden="true" />}
                    />
                  ) : viz === "table" ? (
                    <div className="p-5">
                      <UnderlyingTable widget={widget} range={range} currency={currency} />
                    </div>
                  ) : (
                    <AttributionBarChart widget={widget} />
                  )}
                  {!empty ? (
                    <p className="border-t border-[var(--admin-border)] px-5 py-3 text-xs text-[var(--admin-on-surface-variant)]">
                      {MARKETING_ATTRIBUTION_PAIR_CAPTION}
                    </p>
                  ) : null}
                </section>
              ) : null}

              {isDualSeries(widget.id) ? (
                <section className={insightPanelClassName}>
                  <header className="flex items-center justify-between border-b border-[var(--admin-border)] px-5 py-3">
                    <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                      {viz === "table" ? "Records" : "Daily leads"}
                    </h2>
                    {viz !== "table" ? (
                      <div className="flex items-center gap-3 text-xs text-[var(--admin-on-surface-variant)]">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-3 w-3 rounded-full bg-[var(--admin-primary-container)]" />
                          Contacts
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-3 w-3 rounded-full bg-[var(--admin-primary)]" />
                          Submissions
                        </span>
                        {detail.average != null ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block w-3 border-t border-dashed border-[var(--admin-outline)]" />
                            Average
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </header>
                  <div className={viz === "table" ? "p-0" : "p-5"}>
                    {empty ? (
                      <EmptyCanvas
                        title={emptyCopy?.title ?? "No lead activity"}
                        body={emptyCopy?.body ?? MARKETING_DAILY_LEADS_CAPTION}
                        icon={<Activity className="h-12 w-12" aria-hidden="true" />}
                      />
                    ) : viz === "table" ? (
                      <div className="p-5">
                        <DualUnderlyingTable points={dualPoints} />
                      </div>
                    ) : (
                      <DualSeriesChart
                        points={dualPoints}
                        viz={viz === "bar" ? "bar" : viz === "area" ? "area" : "line"}
                        average={detail.average}
                        widgetTitle={widget.title}
                      />
                    )}
                  </div>
                  {!empty ? (
                    <p className="border-t border-[var(--admin-border)] px-5 py-3 text-xs text-[var(--admin-on-surface-variant)]">
                      {MARKETING_DAILY_LEADS_CAPTION}
                    </p>
                  ) : null}
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
              ) : null}

              {isTableWidget(widget.id) ? (
                <section className={insightPanelClassName}>
                  <header className="flex items-center justify-between border-b border-[var(--admin-border)] px-5 py-3">
                    <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                      {widget.title}
                    </h2>
                  </header>
                  {empty ? (
                    <EmptyCanvas
                      title={emptyCopy?.title ?? "Nothing to show yet"}
                      body={emptyCopy?.body ?? "Records appear here as marketing activity lands."}
                      icon={
                        widget.id === "recent-workflow-runs" ? (
                          <Workflow className="h-12 w-12" aria-hidden="true" />
                        ) : (
                          <Table2 className="h-12 w-12" aria-hidden="true" />
                        )
                      }
                    />
                  ) : (
                    <DataTable widget={widget} currency={currency} />
                  )}
                </section>
              ) : null}

              {isKpiWidget(widget) ? (
                <section className={insightPanelClassName}>
                  <header className="border-b border-[var(--admin-border)] px-5 py-3">
                    <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                      Value
                    </h2>
                  </header>
                  {empty ? (
                    <EmptyCanvas
                      title={emptyCopy?.title ?? "No data available"}
                      body={
                        emptyCopy?.body ?? "This KPI fills in as marketing activity is recorded."
                      }
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr>
                            <th className={`${insightTableHeadClassName} px-5 py-3`}>Metric</th>
                            <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>
                              Value
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className={insightTableRowClassName}>
                            <td className="px-5 py-3 text-sm text-[var(--admin-on-surface)]">
                              {widget.title}
                            </td>
                            <td className="px-5 py-3 text-right font-data text-sm">
                              {formatMetric(kpiValue, widget.id, currency)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ) : null}

              {detail.splitOptions.length > 0 && !empty ? (
                <section className={insightPanelClassName}>
                  <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-low)_50%,transparent)] px-5 py-3">
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
                    money={tableHasMoney(widget.id) || isMoneyKpi(widget.id)}
                    currency={currency}
                  />
                </section>
              ) : null}

              {(isDualSeries(widget.id) || isBarWidget(widget.id)) && !empty && viz !== "table" ? (
                <div>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-4 text-left outline-none hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 motion-safe:active:translate-y-px"
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
                      {isDualSeries(widget.id) ? (
                        <DualUnderlyingTable points={dualPoints} />
                      ) : (
                        <UnderlyingTable widget={widget} range={range} currency={currency} />
                      )}
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

            <RelatedRail
              related={detail.related}
              generatedAt={detail.generatedAt}
              widgetId={widget.id}
              currency={currency}
            />
          </div>
        ) : null}

        {!loading && !detail && !error ? (
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            <div className="flex flex-col gap-6 lg:col-span-8">
              <section className="flex flex-wrap items-end gap-8 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
                {["Submissions", "Contacts", "Abs delta", "Pct delta", "30d average"].map(
                  (label) => (
                    <HeadlineCell key={label} label={label}>
                      <div className={insightKpiValueClassName}>â€”</div>
                    </HeadlineCell>
                  ),
                )}
              </section>
              <section className={insightPanelClassName}>
                <EmptyCanvas
                  title="No data available for this window"
                  body="This widget has no rows for the current marketing window."
                />
              </section>
            </div>
            <RelatedRail related={[]} loadingFallback />
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
        aria-labelledby="mi-widget-overlay-title"
        className="flex h-[calc(100dvh-64px)] w-full max-w-[1440px] flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_8px_32px_color-mix(in_srgb,var(--admin-on-surface)_12%,transparent)]"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--admin-border)] px-6">
          <h2
            id="mi-widget-overlay-title"
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
              className="flex h-8 w-8 items-center justify-center rounded text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 motion-safe:active:translate-y-px"
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
