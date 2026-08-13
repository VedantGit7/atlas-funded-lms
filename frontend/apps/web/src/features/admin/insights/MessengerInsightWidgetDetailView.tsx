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
  MessageCircle,
  RefreshCw,
  Search,
  Share2,
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
  MESSENGER_BAR_WIDGET_IDS,
  MESSENGER_CHANNEL_PAIR_CAPTION,
  MESSENGER_DAILY_VOLUME_CAPTION,
  MESSENGER_DUAL_SERIES_IDS,
  MESSENGER_FAILED_CAPTION,
  MESSENGER_FIXED_WINDOW_CAPTION,
  MESSENGER_INSIGHT_INVERTED_KPI_IDS,
  MESSENGER_INSIGHT_PERCENT_KPI_IDS,
  MESSENGER_TABLE_WIDGET_IDS,
  MESSENGER_WA_EMPTY_CAPTION,
  messengerStatusTone,
  messengerWidgetEmptyCopy,
  type MessengerStatusTone,
} from "./messenger-insight-meta";

const MESSENGER_INBOX_HREF = "/admin/insights/messenger-insight/inbox";

type DetailViz = "area" | "line" | "bar" | "table";

type MessengerInsightWidgetDetailViewProps = {
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
  email: number;
  push: number;
  whatsapp: number;
  inbox: number;
};

type DualSeriesKey = "email" | "push" | "whatsapp" | "inbox";

type DualSeriesVisibility = Record<DualSeriesKey, boolean>;

const OUTBOUND_SERIES: DualSeriesKey[] = ["email", "push", "whatsapp"];

const SERIES_STROKE: Record<DualSeriesKey, string> = {
  email: "var(--admin-primary)",
  push: "color-mix(in srgb, var(--admin-primary) 60%, var(--admin-surface))",
  whatsapp: "color-mix(in srgb, var(--admin-primary) 35%, var(--admin-outline))",
  inbox: "var(--admin-on-surface-variant)",
};

const SERIES_SWATCH: Record<DualSeriesKey, string> = {
  email: "bg-[var(--admin-primary)]",
  push: "bg-[color-mix(in_srgb,var(--admin-primary)_60%,var(--admin-surface))]",
  whatsapp: "bg-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-outline))]",
  inbox: "border-t border-dashed border-[var(--admin-on-surface-variant)]",
};

const SERIES_LABEL: Record<DualSeriesKey, string> = {
  email: "Email",
  push: "Push",
  whatsapp: "WhatsApp",
  inbox: "Inbox",
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
  if (MESSENGER_DUAL_SERIES_IDS.has(widget.id)) return "email";
  return widget.data.measures?.[0] ?? "value";
}

function isDualSeries(widgetId: string): boolean {
  return MESSENGER_DUAL_SERIES_IDS.has(widgetId);
}

function isBarWidget(widgetId: string): boolean {
  return MESSENGER_BAR_WIDGET_IDS.has(widgetId);
}

function isTableWidget(widgetId: string): boolean {
  return MESSENGER_TABLE_WIDGET_IDS.has(widgetId);
}

function isKpiWidget(widget: InsightWidget): boolean {
  return widget.defaultViz === "kpi";
}

function isPercentKpi(widgetId: string): boolean {
  return MESSENGER_INSIGHT_PERCENT_KPI_IDS.has(widgetId);
}

function isInvertedKpi(widgetId: string): boolean {
  return MESSENGER_INSIGHT_INVERTED_KPI_IDS.has(widgetId);
}

function statusColumn(key: string): boolean {
  return key === "status";
}

function outboundOf(point: DualPoint): number {
  return point.email + point.push + point.whatsapp;
}

function widgetHasNoEvents(widget: InsightWidget): boolean {
  if (widget.data.rows.length === 0) return true;
  if (isDualSeries(widget.id)) {
    return widget.data.rows.every(
      (row) =>
        numericValue(cell(row, "email")) <= 0 &&
        numericValue(cell(row, "push")) <= 0 &&
        numericValue(cell(row, "whatsapp")) <= 0 &&
        numericValue(cell(row, "inbox")) <= 0,
    );
  }
  if (isTableWidget(widget.id)) return widget.data.rows.length === 0;
  if (isKpiWidget(widget)) {
    if (
      isPercentKpi(widget.id) &&
      (widget.footnote === MESSENGER_WA_EMPTY_CAPTION ||
        widget.footnote?.toLowerCase().includes("no whatsapp"))
    ) {
      return true;
    }
    return numericValue(cell(widget.data.rows[0], "value")) <= 0;
  }
  const key = measureKey(widget);
  return widget.data.rows.every((row) => numericValue(cell(row, key)) === 0);
}

function formatMetric(value: number, widgetId: string): string {
  if (isPercentKpi(widgetId)) return `${formatInsightNumber(value)}%`;
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
      email: numericValue(cell(row, "email")),
      push: numericValue(cell(row, "push")),
      whatsapp: numericValue(cell(row, "whatsapp")),
      inbox: numericValue(cell(row, "inbox")),
    };
  });
}

function pairedWidgetHref(slug: string, pairedId: string, overlay: boolean): string {
  const base = adminInsightWidgetHref(slug, pairedId);
  return overlay ? `${base}?overlay=1` : base;
}

function pairedSwapLabel(widgetId: string): string | null {
  if (widgetId === "channel-mix-sends") return "Show reach";
  if (widgetId === "channel-mix-reach") return "Show sends";
  return null;
}

function searchPlaceholder(widgetId: string): string {
  switch (widgetId) {
    case "recent-email":
      return "Search emails...";
    case "recent-push":
      return "Search push...";
    case "recent-whatsapp":
      return "Search WhatsApp...";
    case "recent-announcements":
      return "Search announcements...";
    default:
      return "Search records...";
  }
}

function deltaToneClass(widgetId: string, delta: number): string {
  if (delta === 0) return "text-[var(--admin-on-surface-variant)]";
  const inverted = isInvertedKpi(widgetId);
  if (delta > 0) return inverted ? "text-[var(--admin-danger)]" : "text-[var(--admin-success)]";
  return inverted ? "text-[var(--admin-success)]" : "text-[var(--admin-warning)]";
}

function deltaBgClass(widgetId: string, delta: number | null): string {
  if (delta == null || delta === 0) return "";
  const inverted = isInvertedKpi(widgetId);
  if (delta > 0) {
    return inverted
      ? "bg-[color-mix(in_srgb,var(--admin-danger)_6%,transparent)]"
      : "bg-[color-mix(in_srgb,var(--admin-success)_6%,transparent)]";
  }
  return inverted
    ? "bg-[color-mix(in_srgb,var(--admin-success)_6%,transparent)]"
    : "bg-[color-mix(in_srgb,var(--admin-warning)_6%,transparent)]";
}

function Shimmer({ className }: { className: string }) {
  return <div className={`${insightShimmerClassName} ${className}`} />;
}

function statusPillClass(tone: MessengerStatusTone): string {
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
      <div className="mb-4 text-[var(--admin-outline)]">
        {icon ?? <MessageCircle className="h-12 w-12" aria-hidden="true" />}
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
  seriesOn,
  outboundOnly,
}: {
  points: DualPoint[];
  viz: "area" | "line" | "bar";
  average: number | null;
  widgetTitle: string;
  seriesOn: DualSeriesVisibility;
  outboundOnly: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [windowRange, setWindowRange] = useState<[number, number]>([
    0,
    Math.max(points.length - 1, 0),
  ]);
  const width = 800;
  const height = 300;
  const padL = 52;
  const showRight = !outboundOnly && seriesOn.inbox;
  const padR = showRight ? 52 : 16;
  const padT = 16;
  const padB = 32;
  const visible = points.slice(windowRange[0], windowRange[1] + 1);
  const activeOutbound = OUTBOUND_SERIES.filter((key) => seriesOn[key]);
  const leftMax = Math.max(
    ...visible.flatMap((point) => activeOutbound.map((key) => point[key])),
    average ?? 0,
    1,
  );
  const rightMax = Math.max(...visible.map((point) => point.inbox), 1);
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const avgY = average != null ? padT + innerH - (average / leftMax) * innerH : null;
  const xFor = (index: number, count: number) =>
    padL + (count <= 1 ? innerW / 2 : (index / Math.max(count - 1, 1)) * innerW);

  const pathFor = (key: DualSeriesKey, axis: "left" | "right") =>
    visible
      .map((point, index) => {
        const x = xFor(index, visible.length);
        const max = axis === "left" ? leftMax : rightMax;
        const y = padT + innerH - (point[key] / max) * innerH;
        return `${index === 0 ? "M" : "L"} ${String(x)} ${String(y)}`;
      })
      .join(" ");

  const emailPath = pathFor("email", "left");
  const areaPath =
    visible.length === 0 || !seriesOn.email
      ? ""
      : `${emailPath} L ${String(xFor(visible.length - 1, visible.length))} ${String(padT + innerH)} L ${String(xFor(0, visible.length))} ${String(padT + innerH)} Z`;

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
          <linearGradient id="msg-detail-area" x1="0" x2="0" y1="0" y2="1">
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
                {formatCompact(leftMax * ratio)}
              </text>
              {showRight ? (
                <text
                  x={width - padR + 8}
                  y={y + 3}
                  textAnchor="start"
                  fill="var(--admin-on-surface-variant)"
                  fontSize={10}
                  className="font-data"
                >
                  {formatCompact(rightMax * ratio)}
                </text>
              ) : null}
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
              {`Avg outbound ${formatCompact(average ?? 0)}`}
            </text>
          </g>
        ) : null}
        {viz === "bar"
          ? visible.map((point, index) => {
              const groupWidth = innerW / Math.max(visible.length, 1);
              const keys = activeOutbound;
              const barCount = Math.max(keys.length + (showRight ? 1 : 0), 1);
              const barW = Math.min(12, groupWidth / (barCount + 1));
              const gap = 3;
              const totalBarsW = barCount * barW + (barCount - 1) * gap;
              const baseX = padL + index * groupWidth + groupWidth / 2 - totalBarsW / 2;
              const active = hover === index;
              return (
                <g key={point.longLabel}>
                  {keys.map((key, keyIndex) => {
                    const h = (point[key] / leftMax) * innerH;
                    return (
                      <rect
                        key={key}
                        x={baseX + keyIndex * (barW + gap)}
                        y={padT + innerH - h}
                        width={barW}
                        height={h}
                        rx={2}
                        fill={SERIES_STROKE[key]}
                        opacity={active || hover == null ? 1 : 0.45}
                      />
                    );
                  })}
                  {showRight ? (
                    <rect
                      x={baseX + keys.length * (barW + gap)}
                      y={padT + innerH - (point.inbox / rightMax) * innerH}
                      width={barW}
                      height={(point.inbox / rightMax) * innerH}
                      rx={2}
                      fill="var(--admin-on-surface-variant)"
                      opacity={active || hover == null ? 0.55 : 0.3}
                    />
                  ) : null}
                </g>
              );
            })
          : null}
        {viz === "area" && seriesOn.email ? (
          <path d={areaPath} fill="url(#msg-detail-area)" />
        ) : null}
        {viz !== "bar"
          ? OUTBOUND_SERIES.map((key) =>
              seriesOn[key] ? (
                <path
                  key={key}
                  d={pathFor(key, "left")}
                  fill="none"
                  stroke={SERIES_STROKE[key]}
                  strokeWidth={key === "email" ? 2.5 : key === "push" ? 1.75 : 1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={key === "email" ? 1 : 0.9}
                />
              ) : null,
            )
          : null}
        {viz !== "bar" && showRight ? (
          <path
            d={pathFor("inbox", "right")}
            fill="none"
            stroke={SERIES_STROKE.inbox}
            strokeWidth={1.75}
            strokeDasharray="5 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {visible.map((point, index) => {
          const x = xFor(index, visible.length);
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
              {viz !== "bar"
                ? OUTBOUND_SERIES.map((key) =>
                    seriesOn[key] ? (
                      <circle
                        key={key}
                        cx={x}
                        cy={padT + innerH - (point[key] / leftMax) * innerH}
                        r={active && key === "email" ? 5 : 3}
                        fill={
                          active && key === "email"
                            ? "var(--admin-primary)"
                            : "var(--admin-surface)"
                        }
                        stroke={SERIES_STROKE[key]}
                        strokeWidth={2}
                      />
                    ) : null,
                  )
                : null}
              {viz !== "bar" && showRight ? (
                <circle
                  cx={x}
                  cy={padT + innerH - (point.inbox / rightMax) * innerH}
                  r={active ? 4 : 3}
                  fill="var(--admin-surface)"
                  stroke={SERIES_STROKE.inbox}
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
        {hover != null && visible[hover]
          ? (() => {
              const hovered = visible[hover];
              const tipX = Math.min(
                Math.max(xFor(hover, visible.length), padL + 90),
                width - padR - 90,
              );
              const tipBaseY = Math.max(
                padT + 20,
                padT + innerH - (outboundOf(hovered) / Math.max(leftMax * 3, 1)) * innerH - 80,
              );
              const lines = [
                hovered.longLabel,
                `Email ${formatInsightNumber(hovered.email)}`,
                `Push ${formatInsightNumber(hovered.push)}`,
                `WhatsApp ${formatInsightNumber(hovered.whatsapp)}`,
                ...(showRight ? [`Inbox ${formatInsightNumber(hovered.inbox)}`] : []),
              ];
              return (
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
                    x={Math.min(
                      Math.max(xFor(hover, visible.length) - 90, padL),
                      width - padR - 180,
                    )}
                    y={Math.max(
                      padT + 4,
                      padT +
                        innerH -
                        (outboundOf(hovered) / Math.max(leftMax * 3, 1)) * innerH -
                        96,
                    )}
                    width={180}
                    height={showRight ? 96 : 82}
                    rx={4}
                    fill="var(--admin-on-surface)"
                  />
                  {lines.map((line, lineIndex) => (
                    <text
                      key={line}
                      x={tipX}
                      y={tipBaseY + lineIndex * 14}
                      textAnchor="middle"
                      fill="var(--admin-surface)"
                      fontSize={lineIndex === 0 ? 10 : 11}
                      fontWeight={lineIndex === 0 ? 400 : 600}
                      className="font-data"
                    >
                      {line}
                    </text>
                  ))}
                </g>
              );
            })()
          : null}
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

function ChannelBarChart({
  widget,
  paired,
  compare,
}: {
  widget: InsightWidget;
  paired?: InsightWidget | null | undefined;
  compare: boolean;
}) {
  const rows = widget.data.rows;
  const pairedByLabel = new Map(
    (paired?.data.rows ?? []).map((row) => [
      stringValue(cell(row, "label")).toLowerCase(),
      numericValue(cell(row, "value")),
    ]),
  );
  const maxPrimary = Math.max(...rows.map((row) => numericValue(cell(row, "value"))), 1);
  const maxPaired =
    compare && paired ? Math.max(...[...pairedByLabel.values(), ...rows.map(() => 0)], 1) : 1;

  return (
    <div className="flex flex-col gap-5 p-6">
      {compare && paired ? (
        <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--admin-on-surface-variant)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-[var(--admin-primary)]" aria-hidden="true" />
            {widget.id === "channel-mix-reach" ? "Reach" : "Sends"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-sm bg-[color-mix(in_srgb,var(--admin-primary)_32%,var(--admin-surface))]"
              aria-hidden="true"
            />
            {widget.id === "channel-mix-reach" ? "Sends" : "Reach"}
          </span>
        </div>
      ) : null}
      {rows.map((row, index) => {
        const label = stringValue(cell(row, "label"), "Unknown");
        const value = numericValue(cell(row, "value"));
        const pairedValue = pairedByLabel.get(label.toLowerCase()) ?? 0;
        const widthPct = Math.max((value / maxPrimary) * 100, value > 0 ? 4 : 0);
        const pairedPct =
          compare && paired
            ? Math.max((pairedValue / maxPaired) * 100, pairedValue > 0 ? 4 : 0)
            : 0;
        const opacity = Math.max(0.25, 1 - index * 0.15);
        return (
          <div key={`${label}-${String(index)}`} className="flex flex-col gap-1.5">
            <div className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-4">
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
            {compare && paired ? (
              <div className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-4">
                <div aria-hidden="true" />
                <div className="relative h-5 overflow-hidden rounded bg-[var(--admin-surface-low)]">
                  <div
                    className="absolute inset-y-0 left-0 rounded bg-[color-mix(in_srgb,var(--admin-primary)_32%,var(--admin-surface))]"
                    style={{ width: `${String(pairedPct)}%` }}
                  />
                </div>
                <span className="w-24 text-right font-data text-xs tabular-nums text-[var(--admin-on-surface-variant)]">
                  {formatInsightNumber(pairedValue)}
                </span>
              </div>
            ) : null}
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
    <div className="mt-1 ml-auto h-[3px] w-full max-w-[7rem] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--admin-outline)_30%,transparent)]">
      <div
        className="h-full bg-[var(--admin-primary)]"
        style={{ width: `${String(Math.min(Math.max(share, 0), 100))}%` }}
      />
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

function DualUnderlyingTable({ points }: { points: DualPoint[] }) {
  return (
    <div className="overflow-x-auto rounded border border-[var(--admin-border)]">
      <table className="w-full min-w-[560px] border-collapse text-left">
        <thead>
          <tr>
            <th className={`${insightTableHeadClassName} px-4 py-2.5`}>Date</th>
            <th className={`${insightTableHeadClassName} px-4 py-2.5 text-right`}>Email</th>
            <th className={`${insightTableHeadClassName} px-4 py-2.5 text-right`}>Push</th>
            <th className={`${insightTableHeadClassName} px-4 py-2.5 text-right`}>WhatsApp</th>
            <th className={`${insightTableHeadClassName} px-4 py-2.5 text-right`}>Inbox</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.longLabel} className={insightTableRowClassName}>
              <td className="px-4 py-2 text-sm text-[var(--admin-on-surface)]">
                {point.longLabel}
              </td>
              <td className="px-4 py-2 text-right font-data text-sm">
                {formatInsightNumber(point.email)}
              </td>
              <td className="px-4 py-2 text-right font-data text-sm">
                {formatInsightNumber(point.push)}
              </td>
              <td className="px-4 py-2 text-right font-data text-sm">
                {formatInsightNumber(point.whatsapp)}
              </td>
              <td className="px-4 py-2 text-right font-data text-sm">
                {formatInsightNumber(point.inbox)}
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
                if (measure) {
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
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 font-data text-[11px] uppercase tracking-wide ${statusPillClass(messengerStatusTone(display))}`}
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

function DataTable({ widget }: { widget: InsightWidget }) {
  const columns = exportColumns(widget);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string>(measureKey(widget));
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const pageSize = 8;
  const totalMeasure = measureKey(widget);
  const grandTotal =
    widget.data.rows.reduce((sum, row) => sum + numericValue(cell(row, totalMeasure)), 0) || 1;
  const showShare = Boolean(totalMeasure) && widget.data.rows.length > 0;

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
                  className={`${insightTableRowClassName} group`}
                >
                  {columns.map((column, columnIndex) => {
                    const raw = cell(row, column.key);
                    const measure = column.kind === "measure" || column.kind === "number";
                    let display = stringValue(raw, "");
                    if (measure) {
                      display = formatInsightNumber(numericValue(raw));
                    } else if (column.key === "created" || column.kind === "date") {
                      display = formatPeriodLong(stringValue(raw));
                    }
                    const lead = columnIndex === 0;
                    if (statusColumn(column.key)) {
                      return (
                        <td key={column.key} className="px-4 py-2">
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 font-data text-[11px] uppercase tracking-wide ${statusPillClass(messengerStatusTone(display))}`}
                          >
                            {display || "-"}
                          </span>
                        </td>
                      );
                    }
                    if (column.key === "type" || column.key === "channel") {
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
                        } ${lead ? "font-medium text-[var(--admin-primary)]" : ""}`}
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
                        <span className="font-data text-sm">
                          {`${formatInsightNumber(share, share % 1 === 0 ? 0 : 1)}%`}
                        </span>
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
}: {
  related: InsightWidgetDetail["related"];
  loadingFallback?: boolean | undefined;
  generatedAt?: string | undefined;
  widgetId?: string | undefined;
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
            href={MESSENGER_INBOX_HREF}
            prefetch={false}
            className={`${insightGhostButtonClassName} mt-4`}
          >
            Messenger inbox
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
                {MESSENGER_FIXED_WINDOW_CAPTION}
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
    </aside>
  );
}

export function MessengerInsightWidgetDetailView({
  slug,
  sectionTitle,
  detail,
  loading,
  error,
  range,
  overlay,
  onRefresh,
}: MessengerInsightWidgetDetailViewProps) {
  const router = useRouter();
  const widget = detail?.widget ?? null;
  const vizOptions = widget ? compatibleViz(widget) : (["line", "area", "table"] as DetailViz[]);
  const [viz, setViz] = useState<DetailViz>(widget ? defaultViz(widget) : "line");
  const [copied, setCopied] = useState<"id" | "csv" | null>(null);
  const [dataOpen, setDataOpen] = useState(false);
  const [activeSplit, setActiveSplit] = useState("");
  const [comparePaired, setComparePaired] = useState(false);
  const [outboundOnly, setOutboundOnly] = useState(false);
  const [seriesOn, setSeriesOn] = useState<DualSeriesVisibility>({
    email: true,
    push: true,
    whatsapp: true,
    inbox: true,
  });
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!widget) return;
    setViz(defaultViz(widget));
    setActiveSplit(detail?.splitOptions[0]?.id ?? "");
    setDataOpen(false);
    setComparePaired(false);
    setOutboundOnly(false);
    setSeriesOn({ email: true, push: true, whatsapp: true, inbox: true });
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
  const outboundTotal = dualPoints.reduce((sum, point) => sum + outboundOf(point), 0);
  const outboundAverage = dualPoints.length > 0 ? outboundTotal / dualPoints.length : null;
  const inboxTotal =
    detail?.secondaryTotal ?? dualPoints.reduce((sum, point) => sum + point.inbox, 0);
  const inboxAverage =
    detail?.secondaryAverage ?? (dualPoints.length > 0 ? inboxTotal / dualPoints.length : null);
  const kpiValue =
    widget == null
      ? 0
      : isKpiWidget(widget)
        ? numericValue(cell(widget.data.rows[0], "value"))
        : numericValue(cell(widget.data.rows[0], measureKey(widget)));
  const emptyCopy = widget ? messengerWidgetEmptyCopy(widget.id) : null;
  const showVizSwitcher = widget != null && !isKpiWidget(widget) && vizOptions.length > 1;
  const swapLabel = widget ? pairedSwapLabel(widget.id) : null;
  const pairedHref =
    detail?.pairedWidget && widget ? pairedWidgetHref(slug, detail.pairedWidget.id, overlay) : null;
  const primaryRelated = detail?.related[0];
  const primaryHref = primaryRelated?.href ?? MESSENGER_INBOX_HREF;
  const primaryLabel = primaryRelated?.title ?? "Messenger inbox";
  const inverted = widget ? isInvertedKpi(widget.id) : false;

  function flashCopied(kind: "id" | "csv") {
    setCopied(kind);
    window.setTimeout(() => {
      setCopied(null);
    }, 1600);
  }

  function toggleSeries(key: DualSeriesKey) {
    setSeriesOn((current) => ({ ...current, [key]: !current[key] }));
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
            <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
              {MESSENGER_FIXED_WINDOW_CAPTION}
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
          {widget && isBarWidget(widget.id) && detail?.pairedWidget ? (
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
            href={primaryHref}
            prefetch={false}
            className={`${insightPrimaryButtonClassName} motion-safe:active:translate-y-px`}
          >
            {primaryLabel}
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
          <WidgetDetailSkeleton dualHeadline={widget?.id === "daily-volume" || !widget} />
        ) : null}

        {detail && widget && !error ? (
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            <div className="flex flex-col gap-6 lg:col-span-8">
              {isDualSeries(widget.id) ? (
                <section className="flex flex-wrap items-end gap-8 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
                  <HeadlineCell label={detail.comparison?.currentLabel ?? "Current outbound"}>
                    <div className={insightKpiValueClassName}>
                      {empty ? "-" : formatInsightNumber(outboundTotal)}
                    </div>
                    {!empty ? (
                      <p className="mt-1 text-[10px] text-[var(--admin-on-surface-variant)]">
                        {`Inbox total ${formatInsightNumber(inboxTotal)}`}
                      </p>
                    ) : null}
                  </HeadlineCell>
                  {detail.comparison ? (
                    <>
                      <div
                        className="hidden h-10 w-px bg-[var(--admin-border)] md:block"
                        aria-hidden="true"
                      />
                      <HeadlineCell label={detail.comparison.previousLabel}>
                        <div className={insightKpiValueClassName}>
                          {empty ? "-" : formatInsightNumber(detail.comparison.previous)}
                        </div>
                      </HeadlineCell>
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
                  ) : (
                    <>
                      <div
                        className="hidden h-10 w-px bg-[var(--admin-border)] md:block"
                        aria-hidden="true"
                      />
                      <HeadlineCell label="Previous period">
                        <p className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-1 text-sm text-[var(--admin-on-surface-variant)]">
                          No comparable previous period
                        </p>
                      </HeadlineCell>
                    </>
                  )}
                  <div
                    className="hidden h-10 w-px bg-[var(--admin-border)] lg:block"
                    aria-hidden="true"
                  />
                  <HeadlineCell label="Average outbound / day">
                    <span className="font-data text-sm text-[var(--admin-on-surface)]">
                      {empty || outboundAverage == null
                        ? "-"
                        : formatInsightNumber(outboundAverage, outboundAverage % 1 === 0 ? 0 : 1)}
                    </span>
                    {inboxAverage != null && !empty ? (
                      <p className="mt-1 text-[10px] text-[var(--admin-on-surface-variant)]">
                        {`Inbox avg ${formatInsightNumber(inboxAverage, inboxAverage % 1 === 0 ? 0 : 1)}`}
                      </p>
                    ) : null}
                  </HeadlineCell>
                </section>
              ) : null}

              {isKpiWidget(widget) ? (
                <section className="flex flex-wrap items-end gap-8 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
                  <HeadlineCell label={widget.title}>
                    <div
                      className={`${insightKpiValueClassName} ${inverted ? "text-[var(--admin-danger)]" : ""}`}
                    >
                      {empty ? "-" : formatMetric(kpiValue, widget.id)}
                    </div>
                    {inverted ? (
                      <p className="mt-1 text-[10px] text-[var(--admin-danger)]">
                        {MESSENGER_FAILED_CAPTION}
                      </p>
                    ) : null}
                    {empty && isPercentKpi(widget.id) ? (
                      <p className="mt-1 text-[10px] text-[var(--admin-on-surface-variant)]">
                        {widget.footnote ?? MESSENGER_WA_EMPTY_CAPTION}
                      </p>
                    ) : null}
                  </HeadlineCell>
                  {detail.comparison ? (
                    <>
                      <div
                        className="hidden h-10 w-px bg-[var(--admin-border)] md:block"
                        aria-hidden="true"
                      />
                      <HeadlineCell label={detail.comparison.previousLabel}>
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
                        </div>
                      </HeadlineCell>
                      {detail.comparison.deltaPct != null ? (
                        <>
                          <div
                            className="hidden h-10 w-px bg-[var(--admin-border)] lg:block"
                            aria-hidden="true"
                          />
                          <div
                            className={`relative min-w-[140px] flex-1 overflow-hidden rounded-lg p-1 ${deltaBgClass(widget.id, detail.comparison.deltaPct)}`}
                          >
                            <HeadlineCell label="Pct delta">
                              <div
                                className={`flex items-center gap-2 font-data text-sm ${deltaToneClass(widget.id, detail.comparison.deltaPct)}`}
                              >
                                <span className={insightKpiValueClassName}>
                                  {`${detail.comparison.deltaPct >= 0 ? "+" : ""}${formatInsightNumber(detail.comparison.deltaPct, 1)}%`}
                                </span>
                              </div>
                            </HeadlineCell>
                          </div>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <div
                        className="hidden h-10 w-px bg-[var(--admin-border)] md:block"
                        aria-hidden="true"
                      />
                      <HeadlineCell label="Previous period">
                        <p className="text-sm text-[var(--admin-on-surface-variant)]">
                          No comparable previous period
                        </p>
                      </HeadlineCell>
                    </>
                  )}
                  {detail.average != null && !empty ? (
                    <>
                      <div
                        className="hidden h-10 w-px bg-[var(--admin-border)] lg:block"
                        aria-hidden="true"
                      />
                      <HeadlineCell label="Average">
                        <span className="font-data text-sm text-[var(--admin-on-surface)]">
                          {formatMetric(detail.average, widget.id)}
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
                        <span className="font-data text-sm text-[var(--admin-on-surface)]">
                          {`${formatInsightNumber(detail.failureRate.currentPct, 1)}%`}
                        </span>
                        {detail.failureRate.note ? (
                          <p className="mt-1 text-[10px] text-[var(--admin-on-surface-variant)]">
                            {detail.failureRate.note}
                          </p>
                        ) : null}
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
                      body={emptyCopy?.body ?? "Activity will appear here once messaging starts."}
                      href={MESSENGER_INBOX_HREF}
                      hrefLabel="Messenger inbox"
                      icon={<Share2 className="h-12 w-12" aria-hidden="true" />}
                    />
                  ) : viz === "table" ? (
                    <div className="p-5">
                      <UnderlyingTable widget={widget} range={range} />
                    </div>
                  ) : (
                    <ChannelBarChart
                      widget={widget}
                      paired={detail.pairedWidget}
                      compare={comparePaired && Boolean(detail.pairedWidget)}
                    />
                  )}
                  {!empty ? (
                    <p className="border-t border-[var(--admin-border)] px-5 py-3 text-xs text-[var(--admin-on-surface-variant)]">
                      {MESSENGER_CHANNEL_PAIR_CAPTION}
                    </p>
                  ) : null}
                </section>
              ) : null}

              {isDualSeries(widget.id) ? (
                <section className={insightPanelClassName}>
                  <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-3">
                    <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                      {viz === "table" ? "Records" : "Daily messaging volume"}
                    </h2>
                    {viz !== "table" ? (
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--admin-on-surface-variant)]">
                        <span className="font-semibold text-[var(--admin-on-surface)]">
                          Outbound reach
                        </span>
                        {OUTBOUND_SERIES.map((key) => (
                          <label
                            key={key}
                            className="inline-flex cursor-pointer items-center gap-1.5"
                          >
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 accent-[var(--admin-primary)]"
                              checked={seriesOn[key]}
                              onChange={() => {
                                toggleSeries(key);
                              }}
                            />
                            <span
                              className={`h-0.5 w-3 ${SERIES_SWATCH[key]}`}
                              aria-hidden="true"
                            />
                            {SERIES_LABEL[key]}
                          </label>
                        ))}
                        <span
                          className="mx-1 hidden h-3 w-px bg-[var(--admin-border)] sm:inline-block"
                          aria-hidden="true"
                        />
                        <label className="inline-flex cursor-pointer items-center gap-1.5">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-[var(--admin-primary)]"
                            checked={seriesOn.inbox && !outboundOnly}
                            disabled={outboundOnly}
                            onChange={() => {
                              toggleSeries("inbox");
                            }}
                          />
                          <span
                            className={`inline-block w-3 ${SERIES_SWATCH.inbox}`}
                            aria-hidden="true"
                          />
                          Inbox
                        </label>
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-[var(--admin-primary)]"
                            checked={outboundOnly}
                            onChange={(event) => {
                              setOutboundOnly(event.target.checked);
                            }}
                          />
                          Show outbound only
                        </label>
                        {outboundAverage != null ? (
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
                        title={emptyCopy?.title ?? "Awaiting messaging activity"}
                        body={emptyCopy?.body ?? MESSENGER_DAILY_VOLUME_CAPTION}
                        href={MESSENGER_INBOX_HREF}
                        hrefLabel="Messenger inbox"
                        icon={<MessageCircle className="h-12 w-12" aria-hidden="true" />}
                      />
                    ) : viz === "table" ? (
                      <div className="p-5">
                        <DualUnderlyingTable points={dualPoints} />
                      </div>
                    ) : (
                      <DualSeriesChart
                        points={dualPoints}
                        viz={viz === "bar" ? "bar" : viz === "area" ? "area" : "line"}
                        average={outboundAverage}
                        widgetTitle={widget.title}
                        seriesOn={seriesOn}
                        outboundOnly={outboundOnly}
                      />
                    )}
                  </div>
                  {!empty ? (
                    <p className="border-t border-[var(--admin-border)] px-5 py-3 text-xs text-[var(--admin-on-surface-variant)]">
                      {MESSENGER_DAILY_VOLUME_CAPTION}
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
                      body={emptyCopy?.body ?? "Records appear here as messaging activity lands."}
                      href={MESSENGER_INBOX_HREF}
                      hrefLabel="Messenger inbox"
                      icon={<Table2 className="h-12 w-12" aria-hidden="true" />}
                    />
                  ) : (
                    <DataTable widget={widget} />
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
                        emptyCopy?.body ??
                        (isPercentKpi(widget.id)
                          ? MESSENGER_WA_EMPTY_CAPTION
                          : "This KPI fills in as messaging activity is recorded.")
                      }
                      href={MESSENGER_INBOX_HREF}
                      hrefLabel="Messenger inbox"
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
                            <td
                              className={`px-5 py-3 text-right font-data text-sm ${inverted ? "text-[var(--admin-danger)]" : ""}`}
                            >
                              {formatMetric(kpiValue, widget.id)}
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
                  <SplitTable rows={detail.splits[activeSplit] ?? []} />
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

            <RelatedRail
              related={detail.related}
              generatedAt={detail.generatedAt}
              widgetId={widget.id}
            />
          </div>
        ) : null}

        {!loading && !detail && !error ? (
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            <div className="flex flex-col gap-6 lg:col-span-8">
              <section className="flex flex-wrap items-end gap-8 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
                {[
                  "Current outbound",
                  "Previous",
                  "Abs delta",
                  "Pct delta",
                  "Average outbound / day",
                ].map((label) => (
                  <HeadlineCell key={label} label={label}>
                    <div className={insightKpiValueClassName}>-</div>
                  </HeadlineCell>
                ))}
              </section>
              <section className={insightPanelClassName}>
                <EmptyCanvas
                  title="No data available for this window"
                  body="This widget has no rows for the current messenger window."
                  href={MESSENGER_INBOX_HREF}
                  hrefLabel="Messenger inbox"
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
        aria-labelledby="msg-widget-overlay-title"
        className="flex h-[calc(100dvh-64px)] w-full max-w-[1440px] flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_8px_32px_color-mix(in_srgb,var(--admin-on-surface)_12%,transparent)]"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--admin-border)] px-6">
          <h2
            id="msg-widget-overlay-title"
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
