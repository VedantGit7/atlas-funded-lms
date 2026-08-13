"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  AreaChart,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BarChart3,
  Check,
  Copy,
  CreditCard,
  Download,
  History,
  Inbox,
  Lightbulb,
  LineChart,
  Megaphone,
  Radio,
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
  LIVE_ATTENDANCE_REPORT_HREF,
  LIVE_DUAL_SERIES_IDS,
  LIVE_FIXED_WINDOW_CAPTION,
  LIVE_PERCENT_KPI_IDS,
  LIVE_SESSIONS_HREF,
  LIVE_STATUS_BAR_IDS,
  LIVE_TABLE_IDS,
  liveAttendanceRateTone,
  liveStatusBarTone,
  liveStatusShortLabel,
} from "./live-dashboard-meta";

type DetailViz = "area" | "line" | "bar" | "table";

type LiveDashboardWidgetDetailViewProps = {
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
  attended: number;
  registered: number;
};

type StatusPairRow = {
  label: string;
  sessions: number;
  attendees: number;
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
  if (LIVE_DUAL_SERIES_IDS.has(widget.id)) return "attended";
  return widget.data.measures?.[0] ?? "value";
}

function isPercent(widgetId: string): boolean {
  return LIVE_PERCENT_KPI_IDS.has(widgetId);
}

function isStatusBar(widgetId: string): boolean {
  return LIVE_STATUS_BAR_IDS.has(widgetId);
}

function isTableWidget(widgetId: string): boolean {
  return LIVE_TABLE_IDS.has(widgetId);
}

function isDualSeries(widgetId: string): boolean {
  return LIVE_DUAL_SERIES_IDS.has(widgetId);
}

function isKpiWidget(widget: InsightWidget): boolean {
  return widget.defaultViz === "kpi";
}

function widgetHasNoEvents(widget: InsightWidget): boolean {
  if (widget.data.rows.length === 0) return true;
  if (isDualSeries(widget.id)) {
    return widget.data.rows.every(
      (row) =>
        numericValue(cell(row, "attended")) <= 0 && numericValue(cell(row, "registered")) <= 0,
    );
  }
  if (isTableWidget(widget.id)) return widget.data.rows.length === 0;
  if (isStatusBar(widget.id)) {
    return widget.data.rows.every((row) => numericValue(cell(row, "value")) <= 0);
  }
  const key = measureKey(widget);
  return widget.data.rows.every((row) => numericValue(cell(row, key)) === 0);
}

function formatMetric(value: number, widgetId: string): string {
  if (isPercent(widgetId)) return `${formatInsightNumber(value)}%`;
  const digits = value % 1 === 0 ? 0 : 1;
  return formatInsightNumber(value, digits);
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${formatInsightNumber(value / 1_000_000, 1)}M`;
  if (value >= 1000) return `${formatInsightNumber(value / 1000, 0)}k`;
  return formatInsightNumber(value, value >= 100 ? 0 : 1);
}

function compatibleViz(widget: InsightWidget): DetailViz[] {
  if (isTableWidget(widget.id) || isKpiWidget(widget)) return ["table"];
  if (isStatusBar(widget.id)) return ["bar", "table"];
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

function Shimmer({ className }: { className: string }) {
  return <div className={`${insightShimmerClassName} ${className}`} />;
}

function statusFillClass(tone: ReturnType<typeof liveStatusBarTone>): string {
  if (tone === "success") return "bg-[var(--admin-success)]";
  if (tone === "warning") return "bg-[var(--admin-warning)]";
  if (tone === "danger") return "bg-[var(--admin-danger)]";
  return "bg-[var(--admin-outline)]";
}

function statusPillClass(tone: ReturnType<typeof liveStatusBarTone>): string {
  if (tone === "success") {
    return "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]";
  }
  if (tone === "warning") {
    return "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]";
  }
  if (tone === "danger") {
    return "border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]";
  }
  return "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]";
}

function rateBarClass(tone: ReturnType<typeof liveAttendanceRateTone>): string {
  if (tone === "danger") return "bg-[var(--admin-danger)]";
  if (tone === "warning") return "bg-[var(--admin-warning)]";
  if (tone === "success") return "bg-[var(--admin-success)]";
  return "bg-[var(--admin-primary)]";
}

function relatedBadge(href: string): "REPORT" | "DASHBOARD" {
  if (href.includes("/reports/") || href === LIVE_ATTENDANCE_REPORT_HREF) return "REPORT";
  return "DASHBOARD";
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
    case "live":
      return <Radio className={className} aria-hidden="true" />;
    case "inbox":
      return <Inbox className={className} aria-hidden="true" />;
  }
}

function buildDualPoints(widget: InsightWidget, range: InsightDashboardRange): DualPoint[] {
  return widget.data.rows.map((row) => {
    const raw = stringValue(cell(row, "period"));
    return {
      label: formatPeriodLabel(raw, range),
      longLabel: range === "30d" ? formatPeriodLabel(raw, range) : formatPeriodLong(raw),
      attended: numericValue(cell(row, "attended")),
      registered: numericValue(cell(row, "registered")),
    };
  });
}

function mergeStatusPairs(
  primary: InsightWidget,
  paired: InsightWidget | null | undefined,
): StatusPairRow[] {
  const sessionsSource = primary.id === "sessions-by-status" ? primary : (paired ?? primary);
  const attendeesSource = primary.id === "attended-by-status" ? primary : (paired ?? null);
  const labels = new Set<string>();
  for (const row of sessionsSource.data.rows) {
    labels.add(stringValue(cell(row, "label"), "Unknown"));
  }
  if (attendeesSource) {
    for (const row of attendeesSource.data.rows) {
      labels.add(stringValue(cell(row, "label"), "Unknown"));
    }
  }
  return [...labels].map((label) => {
    const sessionsRow = sessionsSource.data.rows.find(
      (row) => stringValue(cell(row, "label")) === label,
    );
    const attendeesRow = attendeesSource?.data.rows.find(
      (row) => stringValue(cell(row, "label")) === label,
    );
    return {
      label,
      sessions: numericValue(cell(sessionsRow, "value")),
      attendees: numericValue(cell(attendeesRow, "value")),
    };
  });
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
}: {
  title: string;
  body: string;
  href?: string | null | undefined;
  hrefLabel?: string | undefined;
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-b-xl bg-[color-mix(in_srgb,var(--admin-page)_50%,transparent)] px-8 py-12 text-center">
      <div className="mb-4 text-[var(--admin-outline)]">
        <Activity className="h-12 w-12" aria-hidden="true" />
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
      <div className="col-span-12">
        <Shimmer className="mb-2 h-4 w-64" />
      </div>
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
      </div>
      <div className="col-span-12 flex flex-col gap-6 lg:col-span-4">
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
    ...visible.flatMap((point) => [point.attended, point.registered]),
    average ?? 0,
    1,
  );
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const avgY = average != null ? padT + innerH - (average / max) * innerH : null;
  const xFor = (index: number, count: number) =>
    padL + (count <= 1 ? innerW / 2 : (index / Math.max(count - 1, 1)) * innerW);

  const pathFor = (key: "attended" | "registered") =>
    visible
      .map((point, index) => {
        const x = xFor(index, visible.length);
        const y = padT + innerH - (point[key] / max) * innerH;
        return `${index === 0 ? "M" : "L"} ${String(x)} ${String(y)}`;
      })
      .join(" ");

  const attendedPath = pathFor("attended");
  const registeredPath = pathFor("registered");
  const areaPath =
    visible.length === 0
      ? ""
      : `${attendedPath} L ${String(xFor(visible.length - 1, visible.length))} ${String(padT + innerH)} L ${String(xFor(0, visible.length))} ${String(padT + innerH)} Z`;

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
          <linearGradient id="ld-detail-area" x1="0" x2="0" y1="0" y2="1">
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
              const regH = (point.registered / max) * innerH;
              const attH = (point.attended / max) * innerH;
              const active = hover === index;
              return (
                <g key={point.longLabel}>
                  <rect
                    x={baseX}
                    y={padT + innerH - regH}
                    width={barW}
                    height={regH}
                    rx={2}
                    fill="var(--admin-primary-container)"
                    opacity={active || hover == null ? 1 : 0.45}
                  />
                  <rect
                    x={baseX + barW + gap}
                    y={padT + innerH - attH}
                    width={barW}
                    height={attH}
                    rx={2}
                    fill="var(--admin-primary)"
                    opacity={active || hover == null ? 1 : 0.45}
                  />
                </g>
              );
            })
          : null}
        {viz === "area" ? <path d={areaPath} fill="url(#ld-detail-area)" /> : null}
        {viz !== "bar" ? (
          <>
            <path
              d={registeredPath}
              fill="none"
              stroke="var(--admin-primary-container)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={attendedPath}
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
          const y = padT + innerH - (point.attended / max) * innerH;
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
                    cy={padT + innerH - (point.registered / max) * innerH}
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
              y={Math.max(padT + 4, padT + innerH - (visible[hover].attended / max) * innerH - 78)}
              width={168}
              height={72}
              rx={4}
              fill="var(--admin-on-surface)"
            />
            <text
              x={Math.min(Math.max(xFor(hover, visible.length), padL + 84), width - padR - 84)}
              y={Math.max(padT + 20, padT + innerH - (visible[hover].attended / max) * innerH - 62)}
              textAnchor="middle"
              fill="var(--admin-surface)"
              fontSize={10}
              className="font-data"
            >
              {visible[hover].longLabel}
            </text>
            <text
              x={Math.min(Math.max(xFor(hover, visible.length), padL + 84), width - padR - 84)}
              y={Math.max(padT + 36, padT + innerH - (visible[hover].attended / max) * innerH - 46)}
              textAnchor="middle"
              fill="var(--admin-surface)"
              fontSize={11}
              className="font-data"
            >
              {`Registered ${formatInsightNumber(visible[hover].registered)}`}
            </text>
            <text
              x={Math.min(Math.max(xFor(hover, visible.length), padL + 84), width - padR - 84)}
              y={Math.max(padT + 50, padT + innerH - (visible[hover].attended / max) * innerH - 32)}
              textAnchor="middle"
              fill="var(--admin-surface)"
              fontSize={11}
              fontWeight={600}
              className="font-data"
            >
              {`Attended ${formatInsightNumber(visible[hover].attended)}`}
            </text>
            <text
              x={Math.min(Math.max(xFor(hover, visible.length), padL + 84), width - padR - 84)}
              y={Math.max(padT + 64, padT + innerH - (visible[hover].attended / max) * innerH - 18)}
              textAnchor="middle"
              fill="var(--admin-surface)"
              fontSize={10}
              className="font-data"
            >
              {`Gap (No-show) ${formatInsightNumber(Math.max(visible[hover].registered - visible[hover].attended, 0))}`}
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

function StatusCompareChart({ rows }: { rows: StatusPairRow[] }) {
  const max = Math.max(...rows.flatMap((row) => [row.sessions, row.attendees]), 1);
  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--admin-on-surface-variant)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-[var(--admin-primary)]" aria-hidden="true" />
          Sessions (L)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-sm bg-[var(--admin-primary-container)]"
            aria-hidden="true"
          />
          Attendees (R)
        </span>
      </div>
      <div className="flex flex-col gap-4">
        {rows.map((row) => {
          const tone = liveStatusBarTone(row.label);
          return (
            <div key={row.label} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`inline-flex rounded border px-2 py-0.5 font-data text-[11px] font-semibold uppercase tracking-wide ${statusPillClass(tone)}`}
                >
                  {liveStatusShortLabel(row.label)}
                </span>
                <span className="font-data text-xs text-[var(--admin-on-surface-variant)]">
                  {`${formatInsightNumber(row.sessions)} / ${formatInsightNumber(row.attendees)}`}
                </span>
              </div>
              <div className="flex h-8 items-stretch gap-1.5">
                <div className="flex flex-1 items-center rounded bg-[var(--admin-surface-low)]">
                  <div
                    className={`h-full rounded ${statusFillClass(tone)}`}
                    style={{
                      width: `${String(Math.max((row.sessions / max) * 100, row.sessions > 0 ? 4 : 0))}%`,
                    }}
                  />
                </div>
                <div className="flex flex-1 items-center rounded bg-[var(--admin-surface-low)]">
                  <div
                    className="h-full rounded bg-[var(--admin-primary-container)]"
                    style={{
                      width: `${String(Math.max((row.attendees / max) * 100, row.attendees > 0 ? 4 : 0))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusSoloChart({ widget }: { widget: InsightWidget }) {
  const rows = widget.data.rows;
  const max = Math.max(...rows.map((row) => numericValue(cell(row, "value"))), 1);
  return (
    <div className="flex h-64 items-end gap-4 px-5 pb-5 pt-8">
      {rows.map((row, index) => {
        const label = stringValue(cell(row, "label"), "Unknown");
        const value = numericValue(cell(row, "value"));
        const tone = liveStatusBarTone(label);
        const heightPct = Math.max((value / max) * 100, value > 0 ? 10 : 3);
        return (
          <div
            key={`${label}-${String(index)}`}
            className="flex h-full flex-1 flex-col items-center gap-2"
          >
            <span className="font-data text-sm text-[var(--admin-on-surface)]">
              {value > 0 ? formatInsightNumber(value) : "-"}
            </span>
            <div className="flex w-full flex-1 items-end justify-center rounded-t bg-[var(--admin-surface-low)]">
              <div
                className={`w-8 rounded-t ${statusFillClass(tone)}`}
                style={{ height: `${String(heightPct)}%` }}
              />
            </div>
            <span className="text-[11px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              {liveStatusShortLabel(label)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SplitTable({ rows }: { rows: InsightWidgetSplitRow[] }) {
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
                  {formatInsightNumber(row.value, row.value % 1 === 0 ? 0 : 1)}
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

function UnderlyingTable({
  widget,
  range,
}: {
  widget: InsightWidget;
  range: InsightDashboardRange;
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
                let display = stringValue(raw, "");
                if (measure) {
                  display = formatInsightNumber(
                    numericValue(raw),
                    numericValue(raw) % 1 === 0 ? 0 : 1,
                  );
                } else if (column.key === "period") {
                  display = formatPeriodLabel(stringValue(raw), range);
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

function DualUnderlyingTable({ points }: { points: DualPoint[] }) {
  return (
    <div className="overflow-x-auto rounded border border-[var(--admin-border)]">
      <table className="w-full min-w-[480px] border-collapse text-left">
        <thead>
          <tr>
            <th className={`${insightTableHeadClassName} px-4 py-2.5`}>Date</th>
            <th className={`${insightTableHeadClassName} px-4 py-2.5 text-right`}>Registered</th>
            <th className={`${insightTableHeadClassName} px-4 py-2.5 text-right`}>Attended</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.longLabel} className={insightTableRowClassName}>
              <td className="px-4 py-2 text-sm text-[var(--admin-on-surface)]">
                {point.longLabel}
              </td>
              <td className="px-4 py-2 text-right font-data text-sm">
                {formatInsightNumber(point.registered)}
              </td>
              <td className="px-4 py-2 text-right font-data text-sm">
                {formatInsightNumber(point.attended)}
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

function SessionDetailTable({
  widget,
  selectedIndex,
  onSelect,
  query,
  onQueryChange,
}: {
  widget: InsightWidget;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  query: string;
  onQueryChange: (value: string) => void;
}) {
  const columns = exportColumns(widget);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return widget.data.rows.map((row, index) => ({ row, index }));
    }
    return widget.data.rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) =>
        columns.some((column) => stringValue(cell(row, column.key)).toLowerCase().includes(needle)),
      );
  }, [columns, query, widget.data.rows]);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--admin-border)] px-4 py-3">
        <Search className="h-4 w-4 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value);
          }}
          placeholder="Filter sessions"
          className="h-9 w-full bg-transparent text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)]"
          aria-label="Filter sessions"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead className={insightTableHeadClassName}>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 ${column.kind === "measure" || column.kind === "number" ? "text-right" : ""}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(columns.length, 1)}
                  className="px-4 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]"
                >
                  No sessions match this filter.
                </td>
              </tr>
            ) : (
              filtered.map(({ row, index }) => {
                const selected = selectedIndex === index;
                return (
                  <tr
                    key={`${stringValue(cell(row, "title"), "row")}-${String(index)}`}
                    className={`${insightTableRowClassName} cursor-pointer ${
                      selected
                        ? "bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))]"
                        : ""
                    }`}
                    onClick={() => {
                      onSelect(index);
                    }}
                    aria-selected={selected}
                  >
                    {columns.map((column) => {
                      const raw = cell(row, column.key);
                      if (column.key === "status") {
                        const status = stringValue(raw, "-");
                        const tone = liveStatusBarTone(status);
                        return (
                          <td key={column.key} className="px-4 py-3">
                            <span
                              className={`inline-flex rounded border px-2 py-0.5 font-data text-[11px] font-semibold uppercase tracking-wide ${statusPillClass(tone)}`}
                            >
                              {liveStatusShortLabel(status)}
                            </span>
                          </td>
                        );
                      }
                      if (column.key === "rate") {
                        const rate = numericValue(raw);
                        const tone = liveAttendanceRateTone(rate);
                        return (
                          <td key={column.key} className="px-4 py-3">
                            <div className="ml-auto flex w-28 flex-col items-end gap-1">
                              <span className="font-data text-sm text-[var(--admin-on-surface)]">
                                {`${formatInsightNumber(rate)}%`}
                              </span>
                              <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                                <div
                                  className={`h-full ${rateBarClass(tone)}`}
                                  style={{
                                    width: `${String(Math.min(Math.max(rate, 0), 100))}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                        );
                      }
                      const measure = column.kind === "measure" || column.kind === "number";
                      return (
                        <td
                          key={column.key}
                          className={`px-4 py-3 text-sm text-[var(--admin-on-surface)] ${
                            measure ? "text-right font-data" : ""
                          }`}
                        >
                          {measure ? formatInsightNumber(numericValue(raw)) : stringValue(raw, "-")}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] px-4 py-3">
        <Link
          href={LIVE_ATTENDANCE_REPORT_HREF}
          prefetch={false}
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--admin-primary)] hover:underline"
        >
          Open Live Class Attendance
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        <span className="font-data text-xs text-[var(--admin-on-surface-variant)]">
          {`${String(filtered.length)} of ${String(widget.data.rows.length)} ${widget.data.rows.length === 1 ? "row" : "rows"}`}
        </span>
      </footer>
    </div>
  );
}

function StatusSplitsPanel({ rows }: { rows: StatusPairRow[] }) {
  return (
    <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <header className="border-b border-[var(--admin-border)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">Status splits</h3>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              <th className={`${insightTableHeadClassName} px-4 py-2.5`}>Status</th>
              <th className={`${insightTableHeadClassName} px-4 py-2.5 text-right`}>Sessions</th>
              <th className={`${insightTableHeadClassName} px-4 py-2.5 text-right`}>Attendees</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className={insightTableRowClassName}>
                <td className="px-4 py-2">
                  <span
                    className={`inline-flex rounded border px-2 py-0.5 font-data text-[11px] font-semibold uppercase tracking-wide ${statusPillClass(liveStatusBarTone(row.label))}`}
                  >
                    {liveStatusShortLabel(row.label)}
                  </span>
                </td>
                <td className="px-4 py-2 text-right font-data text-sm">
                  {formatInsightNumber(row.sessions)}
                </td>
                <td className="px-4 py-2 text-right font-data text-sm">
                  {formatInsightNumber(row.attendees)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SelectedSessionRail({ row }: { row: Record<string, string | number | null> | null }) {
  if (!row) {
    return (
      <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-8 text-center">
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          Select a session row to inspect available fields.
        </p>
      </div>
    );
  }

  const fields: Array<{ label: string; value: string }> = [];
  const title = stringValue(cell(row, "title"));
  if (title) fields.push({ label: "Title", value: title });
  const status = stringValue(cell(row, "status"));
  if (status) fields.push({ label: "Status", value: liveStatusShortLabel(status) });
  if (cell(row, "attended") != null) {
    fields.push({
      label: "Attended",
      value: formatInsightNumber(numericValue(cell(row, "attended"))),
    });
  }
  if (cell(row, "registered") != null) {
    fields.push({
      label: "Registered",
      value: formatInsightNumber(numericValue(cell(row, "registered"))),
    });
  }
  if (cell(row, "rate") != null) {
    fields.push({
      label: "Rate",
      value: `${formatInsightNumber(numericValue(cell(row, "rate")))}%`,
    });
  }
  if (cell(row, "avgMin") != null) {
    fields.push({
      label: "Avg min",
      value: formatInsightNumber(numericValue(cell(row, "avgMin"))),
    });
  }
  if (cell(row, "scheduled") != null) {
    fields.push({ label: "Scheduled", value: stringValue(cell(row, "scheduled"), "-") });
  }

  return (
    <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <header className="border-b border-[var(--admin-border)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">Selected session</h3>
      </header>
      <dl className="flex flex-col gap-3 p-4">
        {fields.map((field) => (
          <div key={field.label} className="flex items-start justify-between gap-3">
            <dt className="text-xs uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              {field.label}
            </dt>
            <dd className="text-right text-sm font-medium text-[var(--admin-on-surface)]">
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function RelatedRail({
  related,
  showIntervention,
  loadingFallback,
  generatedAt,
  widgetId,
  embedded = false,
}: {
  related: InsightWidgetDetail["related"];
  showIntervention: boolean;
  loadingFallback?: boolean | undefined;
  generatedAt?: string | undefined;
  widgetId?: string | undefined;
  embedded?: boolean | undefined;
}) {
  const Wrapper = embedded ? "div" : "aside";
  return (
    <Wrapper className={embedded ? "flex flex-col gap-4" : "flex flex-col gap-4 lg:col-span-4"}>
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
          <Link
            href={LIVE_ATTENDANCE_REPORT_HREF}
            prefetch={false}
            className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-sm font-medium text-[var(--admin-primary)] outline-none hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
          >
            Historical Attendance
          </Link>
        </div>
      ) : related.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-10 text-center">
          <Inbox className="mb-2 h-6 w-6 text-[var(--admin-outline)]" aria-hidden="true" />
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            No related insights found.
          </p>
          <Link
            href={LIVE_ATTENDANCE_REPORT_HREF}
            prefetch={false}
            className={`${insightGhostButtonClassName} mt-4`}
          >
            Historical Attendance
          </Link>
        </div>
      ) : (
        related.map((item) => {
          const badge = relatedBadge(item.href);
          return (
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
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-[var(--admin-on-surface)] group-hover:text-[var(--admin-primary)]">
                      {item.title}
                    </p>
                    <span className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-1.5 py-0.5 font-data text-[9px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                      {badge}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-xs text-[var(--admin-on-surface-variant)]">
                    {item.description}
                  </p>
                </div>
              </div>
              <ArrowRight
                className="mt-1 h-[18px] w-[18px] shrink-0 text-[var(--admin-on-surface-variant)] opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden="true"
              />
            </Link>
          );
        })
      )}
      {showIntervention ? (
        <section className="rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_40%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] p-4">
          <div className="mb-2 flex items-center gap-2 text-[var(--admin-warning)]">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <h3 className="text-sm font-semibold">Low attendance risk</h3>
          </div>
          <p className="text-sm text-[var(--admin-on-surface)]">
            These sessions finished below the attendance threshold. Review scheduling, reminders,
            and capacity in live sessions.
          </p>
          <Link
            href={LIVE_SESSIONS_HREF}
            prefetch={false}
            className={`${insightPrimaryButtonClassName} mt-4 w-full`}
          >
            Open live sessions
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      ) : null}
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
                {LIVE_FIXED_WINDOW_CAPTION}
              </dd>
            </div>
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
    </Wrapper>
  );
}

export function LiveDashboardWidgetDetailView({
  slug,
  sectionTitle,
  detail,
  loading,
  error,
  range,
  overlay,
  onRefresh,
}: LiveDashboardWidgetDetailViewProps) {
  const router = useRouter();
  const widget = detail?.widget ?? null;
  const vizOptions = widget ? compatibleViz(widget) : (["line", "area", "table"] as DetailViz[]);
  const [viz, setViz] = useState<DetailViz>(widget ? defaultViz(widget) : "line");
  const [copied, setCopied] = useState<"id" | "csv" | null>(null);
  const [dataOpen, setDataOpen] = useState(false);
  const [activeSplit, setActiveSplit] = useState("");
  const [comparePaired, setComparePaired] = useState(true);
  const [tableQuery, setTableQuery] = useState("");
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!widget) return;
    setViz(defaultViz(widget));
    setActiveSplit(detail?.splitOptions[0]?.id ?? "");
    setComparePaired(Boolean(detail?.pairedWidget));
    setTableQuery("");
    setSelectedRow(widget.data.rows.length > 0 ? 0 : null);
  }, [detail?.pairedWidget, detail?.splitOptions, widget]);

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
  const statusPairs =
    widget && isStatusBar(widget.id) ? mergeStatusPairs(widget, detail?.pairedWidget) : [];
  const attendedTotal =
    widget && isDualSeries(widget.id)
      ? dualPoints.reduce((sum, point) => sum + point.attended, 0)
      : 0;
  const registeredTotal =
    detail?.secondaryTotal ??
    (widget && isDualSeries(widget.id)
      ? dualPoints.reduce((sum, point) => sum + point.registered, 0)
      : 0);
  const kpiValue =
    widget == null
      ? 0
      : isKpiWidget(widget)
        ? numericValue(cell(widget.data.rows[0], "value"))
        : numericValue(cell(widget.data.rows[0], measureKey(widget)));

  function flashCopied(kind: "id" | "csv") {
    setCopied(kind);
    window.setTimeout(() => {
      setCopied(null);
    }, 1600);
  }

  const showVizSwitcher = widget != null && !isKpiWidget(widget) && !isTableWidget(widget.id);
  const selectedSession =
    widget && selectedRow != null ? (widget.data.rows[selectedRow] ?? null) : null;

  const lowAttendanceCount = widget?.id === "low-attendance-sessions" ? widget.data.rows.length : 0;
  const lowAttendanceAvgRate =
    widget?.id === "low-attendance-sessions" && widget.data.rows.length > 0
      ? widget.data.rows.reduce((sum, row) => sum + numericValue(cell(row, "rate")), 0) /
        widget.data.rows.length
      : 0;

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
          {widget && isStatusBar(widget.id) && detail?.pairedWidget ? (
            <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-on-surface)]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--admin-primary)]"
                checked={comparePaired}
                onChange={(event) => {
                  setComparePaired(event.target.checked);
                }}
              />
              Compare with paired widget
            </label>
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
            href={LIVE_ATTENDANCE_REPORT_HREF}
            prefetch={false}
            className={`${insightPrimaryButtonClassName} motion-safe:active:translate-y-px`}
          >
            Open Live Class Attendance
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

        {loading && !detail ? <WidgetDetailSkeleton /> : null}

        {detail && widget && !error ? (
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            <div className="flex flex-col gap-6 lg:col-span-8">
              {widget.id === "low-attendance-sessions" && !empty ? (
                <div className="flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_40%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] px-5 py-4">
                  <AlertTriangle
                    className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-warning)]"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                      {`${formatInsightNumber(lowAttendanceCount)} low attendance ${lowAttendanceCount === 1 ? "session" : "sessions"}`}
                    </p>
                    <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                      {`Average attendance rate ${formatInsightNumber(lowAttendanceAvgRate, 1)}%.`}
                    </p>
                  </div>
                </div>
              ) : null}

              {isDualSeries(widget.id) ? (
                <section className="flex flex-wrap items-end gap-8 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
                  <HeadlineCell label="Total attended">
                    <div className={insightKpiValueClassName}>
                      {empty ? "—" : formatInsightNumber(attendedTotal)}
                    </div>
                  </HeadlineCell>
                  <div
                    className="hidden h-10 w-px bg-[var(--admin-border)] md:block"
                    aria-hidden="true"
                  />
                  <HeadlineCell label="Total registered">
                    <div className={insightKpiValueClassName}>
                      {empty ? "—" : formatInsightNumber(registeredTotal)}
                    </div>
                  </HeadlineCell>
                  {detail.comparison ? (
                    <>
                      <div
                        className="hidden h-10 w-px bg-[var(--admin-border)] lg:block"
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
                            {`${detail.comparison.deltaAbs >= 0 ? "+" : ""}${formatInsightNumber(detail.comparison.deltaAbs)}`}
                          </span>
                          {detail.comparison.deltaPct != null ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-[color-mix(in_srgb,currentColor_20%,transparent)] bg-[color-mix(in_srgb,currentColor_10%,transparent)] px-2 py-0.5 font-data text-[11px]">
                              {`${detail.comparison.deltaPct >= 0 ? "+" : ""}${formatInsightNumber(detail.comparison.deltaPct, 1)}%`}
                            </span>
                          ) : null}
                        </div>
                      </HeadlineCell>
                    </>
                  ) : (
                    <>
                      <div
                        className="hidden h-10 w-px bg-[var(--admin-border)] lg:block"
                        aria-hidden="true"
                      />
                      <HeadlineCell label="Attended total">
                        <span className="font-data text-sm text-[var(--admin-on-surface)]">
                          {empty ? "—" : formatInsightNumber(attendedTotal)}
                        </span>
                      </HeadlineCell>
                    </>
                  )}
                  <div
                    className="hidden h-10 w-px bg-[var(--admin-border)] lg:block"
                    aria-hidden="true"
                  />
                  <HeadlineCell label="Avg daily">
                    <span className="font-data text-sm text-[var(--admin-on-surface)]">
                      {empty || detail.average == null
                        ? "—"
                        : formatInsightNumber(detail.average, detail.average % 1 === 0 ? 0 : 1)}
                    </span>
                  </HeadlineCell>
                </section>
              ) : null}

              {isStatusBar(widget.id) ? (
                <section className="flex flex-wrap items-end gap-8 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
                  <HeadlineCell label="Total sessions">
                    <div className={insightKpiValueClassName}>
                      {empty
                        ? "—"
                        : formatInsightNumber(
                            statusPairs.reduce((sum, row) => sum + row.sessions, 0),
                          )}
                    </div>
                  </HeadlineCell>
                  <div
                    className="hidden h-10 w-px bg-[var(--admin-border)] md:block"
                    aria-hidden="true"
                  />
                  <HeadlineCell label="Total attendees">
                    <div className={insightKpiValueClassName}>
                      {empty
                        ? "—"
                        : formatInsightNumber(
                            detail.secondaryTotal ??
                              statusPairs.reduce((sum, row) => sum + row.attendees, 0),
                          )}
                    </div>
                  </HeadlineCell>
                </section>
              ) : null}

              {isKpiWidget(widget) ? (
                <section className="flex flex-wrap items-end gap-8 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
                  <HeadlineCell label={widget.title}>
                    <div className={insightKpiValueClassName}>
                      {empty ? "—" : formatMetric(kpiValue, widget.id)}
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
                            {`${detail.comparison.deltaAbs >= 0 ? "+" : ""}${formatMetric(detail.comparison.deltaAbs, widget.id)}`}
                          </span>
                        </div>
                      </HeadlineCell>
                    </>
                  ) : null}
                </section>
              ) : null}

              {isDualSeries(widget.id) ? (
                <section className={insightPanelClassName}>
                  <header className="flex items-center justify-between border-b border-[var(--admin-border)] px-5 py-3">
                    <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                      {viz === "table" ? "Records" : "Daily attendance"}
                    </h2>
                    {viz !== "table" ? (
                      <div className="flex items-center gap-3 text-xs text-[var(--admin-on-surface-variant)]">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-3 w-3 rounded-full bg-[var(--admin-primary-container)]" />
                          Registered
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-3 w-3 rounded-full bg-[var(--admin-primary)]" />
                          Attended
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
                        title="No data available for this window"
                        body="Attended and registered counts will plot here once live class activity starts."
                        href={LIVE_ATTENDANCE_REPORT_HREF}
                        hrefLabel="Open Live Class Attendance"
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

              {isStatusBar(widget.id) ? (
                <section className={insightPanelClassName}>
                  <header className="flex items-center justify-between border-b border-[var(--admin-border)] px-5 py-3">
                    <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                      {viz === "table" ? "Records" : "Status breakdown"}
                    </h2>
                  </header>
                  {empty ? (
                    <EmptyCanvas
                      title="No data available for this window"
                      body="Status counts appear after live classes are scheduled or run."
                      href={LIVE_SESSIONS_HREF}
                      hrefLabel="Open live sessions"
                    />
                  ) : viz === "table" ? (
                    <div className="p-5">
                      <UnderlyingTable widget={widget} range={range} />
                    </div>
                  ) : comparePaired && detail.pairedWidget ? (
                    <StatusCompareChart rows={statusPairs} />
                  ) : (
                    <StatusSoloChart widget={widget} />
                  )}
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
                      title="No data available for this window"
                      body={
                        widget.id === "upcoming-sessions"
                          ? "Nothing is scheduled in the near window."
                          : widget.id === "low-attendance-sessions"
                            ? "Sessions that finish below the attendance threshold will be listed here."
                            : "Ended and completed sessions will appear here after the first live class."
                      }
                      href={LIVE_ATTENDANCE_REPORT_HREF}
                      hrefLabel="Open Live Class Attendance"
                    />
                  ) : (
                    <SessionDetailTable
                      widget={widget}
                      selectedIndex={selectedRow}
                      onSelect={setSelectedRow}
                      query={tableQuery}
                      onQueryChange={setTableQuery}
                    />
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
                      title="No data available for this window"
                      body="This KPI will populate once live activity is recorded."
                      href={LIVE_ATTENDANCE_REPORT_HREF}
                      hrefLabel="Open Live Class Attendance"
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
                              {formatMetric(kpiValue, widget.id)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ) : null}

              {isDualSeries(widget.id) && detail.splitOptions.length > 0 ? (
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
                  <SplitTable rows={detail.splits[activeSplit] ?? []} />
                </section>
              ) : null}

              {(isDualSeries(widget.id) || isStatusBar(widget.id)) && !empty && viz !== "table" ? (
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
                        <UnderlyingTable widget={widget} range={range} />
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

            {isTableWidget(widget.id) && !empty ? (
              <div className="flex flex-col gap-4 lg:col-span-4">
                <SelectedSessionRail row={selectedSession} />
                <div className="flex flex-col gap-4">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--admin-on-surface)]">
                    Related insights
                  </h2>
                  {detail.related.map((item) => {
                    const badge = relatedBadge(item.href);
                    return (
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
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-[var(--admin-on-surface)] group-hover:text-[var(--admin-primary)]">
                                {item.title}
                              </p>
                              <span className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-1.5 py-0.5 font-data text-[9px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                                {badge}
                              </span>
                            </div>
                            <p className="line-clamp-2 text-xs text-[var(--admin-on-surface-variant)]">
                              {item.description}
                            </p>
                          </div>
                        </div>
                        <ArrowRight
                          className="mt-1 h-[18px] w-[18px] shrink-0 text-[var(--admin-on-surface-variant)] opacity-0 transition-opacity group-hover:opacity-100"
                          aria-hidden="true"
                        />
                      </Link>
                    );
                  })}
                  {widget.id === "low-attendance-sessions" ? (
                    <section className="rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_40%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] p-4">
                      <div className="mb-2 flex items-center gap-2 text-[var(--admin-warning)]">
                        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                        <h3 className="text-sm font-semibold">Low attendance risk</h3>
                      </div>
                      <p className="text-sm text-[var(--admin-on-surface)]">
                        These sessions finished below the attendance threshold. Review scheduling,
                        reminders, and capacity in live sessions.
                      </p>
                      <Link
                        href={LIVE_SESSIONS_HREF}
                        prefetch={false}
                        className={`${insightPrimaryButtonClassName} mt-4 w-full`}
                      >
                        Open live sessions
                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </section>
                  ) : null}
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
                          {LIVE_FIXED_WINDOW_CAPTION}
                        </dd>
                      </div>
                      <div className="flex justify-between pb-1">
                        <dt>Last refreshed</dt>
                        <dd className="text-[var(--admin-on-surface)]">
                          {formatRelativeTime(detail.generatedAt)}
                        </dd>
                      </div>
                    </dl>
                  </section>
                </div>
              </div>
            ) : isStatusBar(widget.id) && !empty ? (
              <div className="flex flex-col gap-4 lg:col-span-4">
                <StatusSplitsPanel rows={statusPairs} />
                <RelatedRail
                  related={detail.related}
                  showIntervention={false}
                  generatedAt={detail.generatedAt}
                  widgetId={widget.id}
                  embedded
                />
              </div>
            ) : (
              <RelatedRail
                related={detail.related}
                showIntervention={widget.id === "low-attendance-sessions" && !empty}
                generatedAt={detail.generatedAt}
                widgetId={widget.id}
              />
            )}
          </div>
        ) : null}

        {!loading && !detail && !error ? (
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            <div className="flex flex-col gap-6 lg:col-span-8">
              <section className="flex flex-wrap items-end gap-8 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
                {["Total attended", "Total registered", "Vs previous", "Avg daily"].map((label) => (
                  <HeadlineCell key={label} label={label}>
                    <div className={insightKpiValueClassName}>—</div>
                  </HeadlineCell>
                ))}
              </section>
              <section className={insightPanelClassName}>
                <EmptyCanvas
                  title="No data available for this window"
                  body="This widget has no rows for the current live window."
                  href={LIVE_ATTENDANCE_REPORT_HREF}
                  hrefLabel="Open Live Class Attendance"
                />
              </section>
            </div>
            <RelatedRail related={[]} showIntervention={false} loadingFallback />
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
        aria-labelledby="ld-widget-overlay-title"
        className="flex h-[calc(100dvh-64px)] w-full max-w-[1440px] flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_8px_32px_color-mix(in_srgb,var(--admin-on-surface)_12%,transparent)]"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--admin-border)] px-6">
          <h2
            id="ld-widget-overlay-title"
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
