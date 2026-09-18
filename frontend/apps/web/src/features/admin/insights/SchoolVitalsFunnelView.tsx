"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronRight,
  Copy,
  Download,
  Filter,
  Info,
  Minus,
  RefreshCw,
} from "lucide-react";
import {
  ADMIN_INSIGHTS_HREF,
  adminInsightFunnelHref,
  adminInsightHref,
  adminInsightWidgetHref,
} from "./admin-insights-catalog";
import type {
  InsightDashboardRange,
  InsightEngagementFunnelBoard,
  InsightEngagementFunnelRatio,
  InsightEngagementFunnelStage,
} from "./admin-insights-api";
import { formatInsightNumber, formatRelativeTime, widgetToCsv } from "./admin-insights-format";
import {
  INSIGHT_RANGE_OPTIONS,
  insightBreadcrumbClassName,
  insightGhostButtonClassName,
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

type FunnelMetric = "volume" | "share";

type SchoolVitalsFunnelViewProps = {
  slug: string;
  sectionTitle: string;
  board: InsightEngagementFunnelBoard | null;
  loading: boolean;
  error: string | null;
  range: InsightDashboardRange;
  onRangeChange: (range: InsightDashboardRange) => void;
  onRefresh: () => void;
};

const FUNNEL_FILL = [100, 85, 70, 55, 40, 25] as const;

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

function formatDelta(value: number | null): string {
  if (value == null) return "n/a";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatInsightNumber(value, 1)}%`;
}

function formatCompact(value: number): string {
  if (Math.abs(value) >= 10000) {
    return `${formatInsightNumber(value / 1000, 1)}k`;
  }
  return formatInsightNumber(value);
}

function deltaTone(value: number | null): "up" | "down" | "flat" {
  if (value == null || value === 0) return "flat";
  return value > 0 ? "up" : "down";
}

function deltaClass(tone: "up" | "down" | "flat"): string {
  if (tone === "up") return "text-[var(--admin-success)]";
  if (tone === "down") return "text-[var(--admin-warning)]";
  return "text-[var(--admin-on-surface-variant)]";
}

function displayCount(stage: InsightEngagementFunnelStage, compare: boolean): number {
  if (compare && stage.currentHalf != null) return stage.currentHalf;
  return stage.count;
}

function scaleMax(stages: InsightEngagementFunnelStage[], compare: boolean): number {
  return Math.max(
    ...stages.map((stage) => {
      const current = displayCount(stage, compare);
      const previous = compare ? (stage.previousCount ?? 0) : 0;
      return Math.max(current, previous);
    }),
    1,
  );
}

function barWidthPct(value: number, max: number): number {
  if (value <= 0) return 0;
  return Math.max((value / max) * 100, 4);
}

function funnelCsv(board: InsightEngagementFunnelBoard): string {
  return widgetToCsv(
    [
      { key: "stage", label: "Stage" },
      { key: "events", label: "Events" },
      { key: "share", label: "Share %" },
      { key: "change", label: "Change %" },
      { key: "currentHalf", label: "Current half" },
      { key: "previousHalf", label: "Previous half" },
    ],
    board.stages.map((stage) => ({
      stage: stage.label,
      events: stage.count,
      share: stage.sharePct,
      change: stage.deltaPct,
      currentHalf: stage.currentHalf,
      previousHalf: stage.previousCount,
    })),
  );
}

function Shimmer({ className }: { className: string }) {
  return <div className={`${insightShimmerClassName} ${className}`} />;
}

function RangeControl({
  range,
  onRangeChange,
}: {
  range: InsightDashboardRange;
  onRangeChange: (range: InsightDashboardRange) => void;
}) {
  return (
    <div className={insightSegmentTrackClassName} role="radiogroup" aria-label="Date range">
      {INSIGHT_RANGE_OPTIONS.map((option) => {
        const active = option.value === range;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={active ? insightSegmentButtonActiveClassName : insightSegmentButtonClassName}
            onClick={() => {
              onRangeChange(option.value);
            }}
          >
            {option.label}
          </button>
        );
      })}
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
          Unable to load funnel telemetry
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

function StageSparkline({ values, tone }: { values: number[]; tone: "up" | "down" | "flat" }) {
  if (values.length < 2) {
    return <div className="h-12 w-24 rounded bg-[var(--admin-surface-high)]" />;
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const coords = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = 4 + (1 - (value - min) / span) * 32;
    return { x, y };
  });
  const line = coords
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");
  const area = `${line} L100,40 L0,40 Z`;
  const stroke =
    tone === "up"
      ? "var(--admin-success)"
      : tone === "down"
        ? "var(--admin-warning)"
        : "var(--admin-primary)";
  const fill =
    tone === "up"
      ? "color-mix(in srgb, var(--admin-success) 14%, transparent)"
      : tone === "down"
        ? "color-mix(in srgb, var(--admin-warning) 14%, transparent)"
        : "color-mix(in srgb, var(--admin-primary) 12%, transparent)";
  return (
    <svg className="h-12 w-24" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <path d={area} fill={fill} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.5" />
    </svg>
  );
}

function ShimmerBar({ className, styleWidth }: { className: string; styleWidth?: number }) {
  return (
    <div
      className={`${insightShimmerClassName} ${className}`}
      style={styleWidth != null ? { width: `${String(styleWidth)}%` } : undefined}
    />
  );
}

function FunnelSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading engagement funnel">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <Shimmer className="mb-3 h-3 w-64" />
          <Shimmer className="mb-2 h-8 w-80" />
          <Shimmer className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Shimmer className="h-10 w-72" />
          <Shimmer className="h-10 w-28" />
          <Shimmer className="h-10 w-36" />
        </div>
      </div>
      <Shimmer className="h-12 w-full" />
      <section className={`${insightPanelClassName} p-6`}>
        <Shimmer className="mb-6 h-5 w-56" />
        <div className="space-y-4">
          {[100, 80, 65, 45, 28, 16].map((width) => (
            <div key={width} className="flex items-center gap-4">
              <Shimmer className="h-4 w-44 shrink-0" />
              <ShimmerBar className="h-10 rounded-r" styleWidth={width} />
              <Shimmer className="h-8 w-24 shrink-0" />
            </div>
          ))}
        </div>
      </section>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[58%_42%]">
        <section className={`${insightPanelClassName} p-6`}>
          <Shimmer className="mb-6 h-5 w-40" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="rounded border border-[var(--admin-border)] p-4">
                <Shimmer className="mb-3 h-3 w-24" />
                <Shimmer className="h-12 w-full" />
              </div>
            ))}
          </div>
        </section>
        <div className="flex flex-col gap-6">
          <section className={insightPanelClassName}>
            <div className="border-b border-[var(--admin-border)] p-4">
              <Shimmer className="h-5 w-32" />
            </div>
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="flex h-11 items-center gap-3 border-b border-[var(--admin-border)] px-4 last:border-b-0"
              >
                <Shimmer className="h-4 w-28" />
                <Shimmer className="ml-auto h-4 w-16" />
              </div>
            ))}
          </section>
          <section className={`${insightPanelClassName} p-4`}>
            <Shimmer className="mb-4 h-5 w-44" />
            <Shimmer className="mb-3 h-3 w-full" />
            <Shimmer className="h-3 w-full" />
          </section>
        </div>
      </div>
    </div>
  );
}

function EmptyFunnel({
  stages,
  progressHref,
}: {
  stages: InsightEngagementFunnelStage[];
  progressHref: string;
}) {
  return (
    <div className="relative flex min-h-[320px] flex-col justify-around gap-4">
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
        <div className="pointer-events-auto flex flex-col items-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-5 text-center shadow-sm">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]">
            <Filter className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-[var(--admin-on-surface)]">
            No learning events recorded in this window
          </p>
          <Link
            href={progressHref}
            prefetch={false}
            className="mt-2 text-sm text-[var(--admin-primary)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
          >
            Open Progress and Score
          </Link>
        </div>
      </div>
      {stages.map((stage) => (
        <div key={stage.key} className="flex items-center gap-4 opacity-40">
          <div className="w-44 shrink-0 text-sm text-[var(--admin-on-surface-variant)]">
            {stage.label}
          </div>
          <div className="h-8 flex-1 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)]" />
          <div className="w-20 text-right font-data text-sm text-[var(--admin-on-surface-variant)]">
            0
          </div>
        </div>
      ))}
    </div>
  );
}

function FunnelBars({
  slug,
  range,
  stages,
  compare,
  metric,
  previousLabel,
}: {
  slug: string;
  range: InsightDashboardRange;
  stages: InsightEngagementFunnelStage[];
  compare: boolean;
  metric: FunnelMetric;
  previousLabel: string;
}) {
  const max = scaleMax(stages, compare);
  return (
    <div className="space-y-4">
      {stages.map((stage, index) => {
        const count = displayCount(stage, compare);
        const fill = FUNNEL_FILL[index] ?? 25;
        const width = barWidthPct(count, max);
        const previousWidth =
          compare && stage.previousCount != null ? barWidthPct(stage.previousCount, max) : null;
        const shareOfMax = roundShare((count / max) * 100);
        const tone = deltaTone(stage.deltaPct);
        const href = `${adminInsightWidgetHref(slug, stage.widgetId)}?range=${range}`;
        const primary =
          metric === "share"
            ? `${formatInsightNumber(shareOfMax, shareOfMax % 1 === 0 ? 0 : 1)}%`
            : formatInsightNumber(count);
        const secondary = compare
          ? formatDelta(stage.deltaPct)
          : stage.maxSharePct === 100
            ? "100% (base)"
            : `${formatInsightNumber(stage.maxSharePct, stage.maxSharePct % 1 === 0 ? 0 : 1)}% of max`;
        return (
          <div key={stage.key} className="flex items-center gap-4">
            <Link
              href={href}
              prefetch={false}
              className="w-44 shrink-0 text-sm font-medium text-[var(--admin-on-surface)] outline-none hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
            >
              {stage.label}
            </Link>
            <div className="relative min-w-0 flex-1">
              <div className="h-10 overflow-hidden rounded-r bg-[var(--admin-surface-low)]">
                <div
                  className="h-full rounded-r transition-[width] duration-300"
                  style={{
                    width: `${String(width)}%`,
                    backgroundColor: `color-mix(in srgb, var(--admin-primary) ${String(fill)}%, transparent)`,
                  }}
                  aria-hidden="true"
                />
              </div>
              {previousWidth != null ? (
                <div
                  className="pointer-events-none absolute top-0 h-10 border-r-2 border-[var(--admin-outline)]"
                  style={{ left: `${String(Math.min(previousWidth, 100))}%` }}
                  title={previousLabel}
                />
              ) : null}
            </div>
            <div className="w-32 shrink-0 text-right">
              <div className="font-data text-sm text-[var(--admin-on-surface)]">{primary}</div>
              <div
                className={`inline-flex items-center justify-end gap-0.5 text-xs ${
                  compare ? deltaClass(tone) : "text-[var(--admin-on-surface-variant)]"
                }`}
              >
                {compare && tone === "up" ? (
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                ) : null}
                {compare && tone === "down" ? (
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                ) : null}
                {compare && tone === "flat" ? (
                  <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                ) : null}
                {secondary}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function roundShare(value: number): number {
  return Math.round(value * 10) / 10;
}

function RatioBlock({ ratio }: { ratio: InsightEngagementFunnelRatio }) {
  const success = ratio.id === "pass-rate";
  return (
    <div>
      <div className="mb-1 flex items-end justify-between gap-3">
        <span className="text-sm font-medium text-[var(--admin-on-surface)]">{ratio.label}</span>
        <span className="font-data text-sm text-[var(--admin-on-surface)]">
          {formatInsightNumber(ratio.valuePct, 1)}%
        </span>
      </div>
      {ratio.detail ? (
        <p className="mb-2 text-xs text-[var(--admin-on-surface-variant)]">{ratio.detail}</p>
      ) : null}
      <div className="h-[3px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
        <div
          className={`h-full rounded-full ${success ? "bg-[var(--admin-success)]" : "bg-[var(--admin-primary)]"}`}
          style={{ width: `${String(Math.min(Math.max(ratio.valuePct, 0), 100))}%` }}
        />
      </div>
    </div>
  );
}

export function SchoolVitalsFunnelView({
  slug,
  sectionTitle,
  board,
  loading,
  error,
  range,
  onRangeChange,
  onRefresh,
}: SchoolVitalsFunnelViewProps) {
  const [metric, setMetric] = useState<FunnelMetric>("volume");
  const [compare, setCompare] = useState(false);
  const [copied, setCopied] = useState(false);

  const compareActive = Boolean(compare && board?.comparable);
  const csv = useMemo(() => (board ? funnelCsv(board) : ""), [board]);
  const csvName = `engagement-funnel-${range}.csv`;

  const onCopy = () => {
    if (!csv) return;
    void copyText(csv).then((ok) => {
      if (!ok) return;
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1600);
    });
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
        <span className="font-medium text-[var(--admin-on-surface)]">Engagement funnel</span>
      </nav>

      <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <Link
              href={adminInsightHref(slug)}
              prefetch={false}
              className="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
              aria-label="Back to School Vitals"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className={insightPageTitleClassName}>
              {board?.title ?? "Learning engagement funnel"}
            </h1>
          </div>
          <p className={insightPageDescClassName}>
            Six independent learning event types over the selected window. Later stages are not
            subsets of earlier ones.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <RangeControl range={range} onRangeChange={onRangeChange} />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={insightGhostButtonClassName}
              disabled={!board}
              onClick={onCopy}
            >
              {copied ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy as CSV"}
            </button>
            <button
              type="button"
              className={insightGhostButtonClassName}
              disabled={!board}
              onClick={() => {
                if (!csv) return;
                downloadCsv(csvName, csv);
              }}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export
            </button>
            <Link
              href={board?.progressHref ?? "/admin/reports/progress-score"}
              prefetch={false}
              className={insightPrimaryButtonClassName}
            >
              Open Progress and Score
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      {error ? <ErrorStrip message={error} onRetry={onRefresh} /> : null}
      {loading && !board ? <FunnelSkeleton /> : null}

      {board ? (
        <>
          <div className="flex items-start gap-3 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
            <Info
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            <p className="text-sm leading-snug text-[var(--admin-on-surface-variant)]">
              {board.caveat}
            </p>
          </div>

          <section className={`${insightPanelClassName} p-6`} aria-label="Aggregate events">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                Aggregate events ({board.rangeLabel})
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {board.comparable ? (
                  <button
                    type="button"
                    className={`${insightGhostButtonClassName} ${
                      compareActive
                        ? "border-[var(--admin-primary)] text-[var(--admin-primary)]"
                        : ""
                    }`}
                    aria-pressed={compareActive}
                    onClick={() => {
                      setCompare((current) => !current);
                    }}
                  >
                    Compare halves
                  </button>
                ) : null}
                <div
                  className={insightSegmentTrackClassName}
                  role="radiogroup"
                  aria-label="Funnel metric"
                >
                  {(
                    [
                      { id: "volume", label: "Volume" },
                      { id: "share", label: "% of max" },
                    ] as const
                  ).map((option) => {
                    const active = metric === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={
                          active
                            ? insightSegmentButtonActiveClassName
                            : insightSegmentButtonClassName
                        }
                        onClick={() => {
                          setMetric(option.id);
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            {compareActive ? (
              <div className="mb-5 flex flex-wrap items-center gap-4 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2">
                <span className="inline-flex items-center gap-2 font-data text-sm text-[var(--admin-on-surface)]">
                  <span
                    className="h-3 w-3 rounded-full bg-[var(--admin-primary)]"
                    aria-hidden="true"
                  />
                  {board.currentLabel}
                </span>
                <span className="text-[var(--admin-on-surface-variant)]">vs</span>
                <span className="inline-flex items-center gap-2 font-data text-sm text-[var(--admin-on-surface-variant)]">
                  <span
                    className="h-3 w-3 rounded-full border border-[var(--admin-outline)]"
                    aria-hidden="true"
                  />
                  {board.previousLabel}
                </span>
              </div>
            ) : null}
            {board.empty ? (
              <EmptyFunnel stages={board.stages} progressHref={board.progressHref} />
            ) : (
              <FunnelBars
                slug={slug}
                range={range}
                stages={board.stages}
                compare={compareActive}
                metric={metric}
                previousLabel={board.previousLabel}
              />
            )}
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[58%_42%]">
            <section className={`${insightPanelClassName} p-6`} aria-label="Stage trends">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                  Stage trends
                </h2>
                {board.topMover ? (
                  <p className="text-xs text-[var(--admin-on-surface-variant)]">
                    Top mover:{" "}
                    <span
                      className={`font-medium ${deltaClass(deltaTone(board.topMover.deltaPct))}`}
                    >
                      {board.topMover.label} ({formatDelta(board.topMover.deltaPct)})
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-[var(--admin-on-surface-variant)]">
                    Half-window change appears once the series has enough days.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {board.stages.map((stage) => {
                  const tone = deltaTone(stage.deltaPct);
                  const count = displayCount(stage, compareActive);
                  const highlight = board.topMover?.label === stage.label;
                  return (
                    <Link
                      key={stage.key}
                      href={`${adminInsightWidgetHref(slug, stage.widgetId)}?range=${range}`}
                      prefetch={false}
                      className={`rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 outline-none transition-colors hover:border-[var(--admin-outline)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 ${
                        highlight
                          ? "ring-1 ring-[color-mix(in_srgb,var(--admin-success)_35%,transparent)]"
                          : ""
                      }`}
                    >
                      <div className="mb-2 text-xs font-medium text-[var(--admin-on-surface-variant)]">
                        {stage.label}
                      </div>
                      <div className="flex items-end justify-between gap-3">
                        <StageSparkline values={stage.sparkline} tone={highlight ? tone : "flat"} />
                        <div
                          className={`font-data text-base font-medium ${
                            highlight ? deltaClass(tone) : "text-[var(--admin-on-surface)]"
                          }`}
                        >
                          {formatCompact(count)}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>

            <div className="flex flex-col gap-6">
              <section
                className={`${insightPanelClassName} overflow-hidden`}
                aria-label="Stage detail"
              >
                <div className="border-b border-[var(--admin-border)] p-4">
                  <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                    Stage detail
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className={insightTableHeadClassName}>
                        <th className="p-3">Stage</th>
                        <th className="p-3 text-right">{compareActive ? "Current" : "Events"}</th>
                        {compareActive ? <th className="p-3 text-right">Previous</th> : null}
                        <th className="p-3">Share of max</th>
                        <th className="p-3 text-right">Change</th>
                        <th className="w-8 p-3">
                          <span className="sr-only">Open stage</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {board.stages.map((stage) => {
                        const count = displayCount(stage, compareActive);
                        const max = scaleMax(board.stages, compareActive);
                        const share = roundShare((count / max) * 100);
                        const tone = deltaTone(stage.deltaPct);
                        const href = `${adminInsightWidgetHref(slug, stage.widgetId)}?range=${range}`;
                        return (
                          <tr key={stage.key} className={insightTableRowClassName}>
                            <td className="p-3 text-sm font-medium text-[var(--admin-on-surface)]">
                              {stage.label}
                            </td>
                            <td className="p-3 text-right font-data text-sm text-[var(--admin-on-surface)]">
                              {formatInsightNumber(count)}
                            </td>
                            {compareActive ? (
                              <td className="p-3 text-right font-data text-sm text-[var(--admin-on-surface-variant)]">
                                {stage.previousCount == null
                                  ? "n/a"
                                  : formatInsightNumber(stage.previousCount)}
                              </td>
                            ) : null}
                            <td className="p-3">
                              <div className="h-[3px] w-16 rounded-full bg-[var(--admin-surface-high)]">
                                <div
                                  className="h-full rounded-full bg-[var(--admin-primary)]"
                                  style={{ width: `${String(Math.min(share, 100))}%` }}
                                />
                              </div>
                            </td>
                            <td className={`p-3 text-right font-data text-sm ${deltaClass(tone)}`}>
                              {formatDelta(stage.deltaPct)}
                            </td>
                            <td className="p-3 text-[var(--admin-on-surface-variant)]">
                              <Link
                                href={href}
                                prefetch={false}
                                className="block outline-none hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                                aria-label={`Open ${stage.label}`}
                              >
                                <ChevronRight className="h-4 w-4" aria-hidden="true" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section
                className={`${insightPanelClassName} p-4`}
                aria-label="Ratios worth watching"
              >
                <h2 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">
                  Ratios worth watching
                </h2>
                {board.ratios.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                    <p className="text-sm text-[var(--admin-on-surface-variant)]">
                      No data available
                    </p>
                    <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                      Ratios only appear for arithmetically valid relationships.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {board.ratios.map((ratio) => (
                      <RatioBlock key={ratio.id} ratio={ratio} />
                    ))}
                  </div>
                )}
                <p className="mt-4 border-t border-[var(--admin-border)] pt-3 text-xs text-[var(--admin-on-surface-variant)]">
                  Ratios only shown for arithmetically valid relationships.
                </p>
              </section>
            </div>
          </div>

          {board.generatedAt ? (
            <p className="text-xs text-[var(--admin-on-surface-variant)]">
              Updated {formatRelativeTime(board.generatedAt)}. Window {board.from} to {board.to}.
              <Link
                href={`${adminInsightFunnelHref(slug)}?range=${range}`}
                prefetch={false}
                className="ml-2 text-[var(--admin-primary)] hover:underline"
              >
                Permalink
              </Link>
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
