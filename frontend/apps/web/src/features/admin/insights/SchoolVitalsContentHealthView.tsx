"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Info,
  Minus,
  RefreshCw,
} from "lucide-react";
import {
  ADMIN_INSIGHTS_HREF,
  adminInsightContentHealthHref,
  adminInsightHref,
} from "./admin-insights-catalog";
import type {
  InsightContentHealthBoard,
  InsightContentHealthChip,
  InsightContentHealthSession,
  InsightContentHealthSignal,
  InsightDashboardRange,
} from "./admin-insights-api";
import {
  formatInsightNumber,
  formatPeriodLabel,
  formatRelativeTime,
  widgetToCsv,
} from "./admin-insights-format";
import {
  INSIGHT_RANGE_OPTIONS,
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

type SchoolVitalsContentHealthViewProps = {
  slug: string;
  sectionTitle: string;
  board: InsightContentHealthBoard | null;
  loading: boolean;
  error: string | null;
  range: InsightDashboardRange;
  onRangeChange: (range: InsightDashboardRange) => void;
  onRefresh: () => void;
};

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

function healthCsv(board: InsightContentHealthBoard): string {
  return widgetToCsv(
    [
      { key: "signal", label: "Signal" },
      { key: "count", label: "Count" },
      { key: "tone", label: "Tone" },
      { key: "consequence", label: "Consequence" },
    ],
    board.signals.map((signal) => ({
      signal: signal.label,
      count: signal.count,
      tone: signal.tone,
      consequence: signal.consequence,
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
          Unable to load content health
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

function countClass(tone: InsightContentHealthSignal["tone"]): string {
  if (tone === "warning") return "text-[var(--admin-warning)]";
  if (tone === "success") return "text-[var(--admin-success)]";
  return "text-[var(--admin-on-surface)]";
}

function chipClass(tone: InsightContentHealthChip["tone"]): string {
  if (tone === "warning") {
    return "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] text-[var(--admin-warning)]";
  }
  if (tone === "danger") {
    return "border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] text-[var(--admin-danger)]";
  }
  if (tone === "success") {
    return "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] text-[var(--admin-success)]";
  }
  return "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]";
}

function sessionStatusLabel(status: string): string {
  if (status === "live") return "Live";
  if (status === "scheduled") return "Scheduled";
  return status;
}

function formatSessionWhen(iso: string | null): string {
  if (!iso) return "n/a";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "n/a";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SignalCard({ signal }: { signal: InsightContentHealthSignal }) {
  return (
    <article
      id={signal.id}
      className={`${insightPanelClassName} scroll-mt-16 p-6 lg:flex-row lg:gap-6`}
      aria-label={signal.label}
    >
      <div className="flex w-full shrink-0 flex-col justify-between lg:w-48">
        <div>
          <div className={insightKpiLabelClassName}>{signal.label}</div>
          <div className={`${insightKpiValueClassName} ${countClass(signal.tone)}`}>
            {formatInsightNumber(signal.count)}
          </div>
          {signal.informational ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-[var(--admin-on-surface-variant)]">
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
              Informational
            </p>
          ) : signal.tone === "success" ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-[var(--admin-success)]">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </p>
          ) : (
            <p className="mt-1 flex items-center gap-1 text-xs text-[var(--admin-warning)]">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Needs attention
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-center border-t border-[var(--admin-border)] pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        <p className="mb-4 text-sm text-[var(--admin-on-surface)]">{signal.consequence}</p>
        {signal.chips.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {signal.chips.map((item) => (
              <span
                key={item.label}
                className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 font-data text-[11px] font-medium uppercase tracking-wide ${chipClass(item.tone)}`}
              >
                {item.tone === "success" ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--admin-success)] motion-safe:animate-pulse" />
                ) : null}
                {item.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex w-full shrink-0 flex-col justify-center gap-3 border-t border-[var(--admin-border)] pt-4 lg:w-64 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        <Link
          href={signal.href}
          prefetch={false}
          className={`${insightPrimaryButtonClassName} w-full`}
        >
          {signal.primaryLabel}
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        {signal.secondaryHref && signal.secondaryLabel ? (
          <Link
            href={signal.secondaryHref}
            prefetch={false}
            className={`${insightGhostButtonClassName} w-full`}
          >
            {signal.secondaryLabel}
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function CompactSignals({ signals }: { signals: InsightContentHealthSignal[] }) {
  return (
    <section className={insightPanelClassName} aria-label="Active triggers">
      <header className="border-b border-[var(--admin-border)] px-4 py-3">
        <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">Signals</h2>
      </header>
      <ul>
        {signals.map((signal) => (
          <li key={signal.id}>
            <Link
              href={signal.href}
              prefetch={false}
              className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] px-4 outline-none last:border-b-0 hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
            >
              {signal.tone === "success" ? (
                <CheckCircle2
                  className="h-4 w-4 shrink-0 text-[var(--admin-success)]"
                  aria-hidden="true"
                />
              ) : signal.tone === "warning" ? (
                <AlertCircle
                  className="h-4 w-4 shrink-0 text-[var(--admin-warning)]"
                  aria-hidden="true"
                />
              ) : (
                <Minus
                  className="h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
              )}
              <span className="w-10 text-right font-data text-sm text-[var(--admin-on-surface)]">
                {formatInsightNumber(signal.count)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-[var(--admin-on-surface)]">
                {signal.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SessionTable({ sessions }: { sessions: InsightContentHealthSession[] }) {
  if (sessions.length === 0) {
    return (
      <p className="px-6 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]">
        No upcoming live sessions in this window.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className={insightTableHeadClassName}>
            <th className="px-6 py-3">Session</th>
            <th className="px-6 py-3 text-right">Scheduled</th>
            <th className="px-6 py-3 text-right">Registrants</th>
            <th className="px-6 py-3 text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session.id} className={insightTableRowClassName}>
              <td className="px-6 py-2">
                <Link
                  href={session.href}
                  prefetch={false}
                  className="text-sm font-medium text-[var(--admin-on-surface)] outline-none hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                >
                  {session.title}
                </Link>
              </td>
              <td className="px-6 py-2 text-right font-data text-sm text-[var(--admin-on-surface-variant)]">
                {formatSessionWhen(session.scheduledAt)}
              </td>
              <td className="px-6 py-2 text-right font-data text-sm text-[var(--admin-on-surface)]">
                {formatInsightNumber(session.registeredCount)}
              </td>
              <td className="px-6 py-2 text-right">
                <span
                  className={`inline-flex rounded border px-2 py-0.5 font-data text-[11px] font-medium uppercase tracking-wide ${
                    session.status === "live"
                      ? chipClass("success")
                      : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]"
                  }`}
                >
                  {sessionStatusLabel(session.status)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OpenedTrend({
  series,
  range,
}: {
  series: Array<{ period: string; value: number }>;
  range: InsightDashboardRange;
}) {
  const width = 720;
  const height = 220;
  const pad = { left: 36, right: 12, top: 12, bottom: 28 };
  const values = series.map((point) => point.value);
  const max = Math.max(...values, 1);
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const points = values.map((value, index) => {
    const x =
      pad.left + (values.length <= 1 ? innerWidth / 2 : (index / (values.length - 1)) * innerWidth);
    const y = pad.top + innerHeight - (value / max) * innerHeight;
    return { x, y };
  });
  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
  const ticks = [0, 1, 2, 3, 4].map((step) => Math.round((max / 4) * step));
  const labelEvery = Math.max(1, Math.ceil(series.length / 8));

  if (series.length < 2 || values.every((value) => value === 0)) {
    return (
      <p className="flex h-56 items-center justify-center text-sm text-[var(--admin-on-surface-variant)]">
        No cases opened in this window.
      </p>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      className="h-56 w-full"
      role="img"
      aria-label="Cases opened"
    >
      {ticks.map((tick, index) => {
        const y = pad.top + innerHeight - (tick / max) * innerHeight;
        return (
          <g key={`${index}-${tick}`}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y}
              y2={y}
              stroke="var(--admin-border)"
              strokeWidth="1"
            />
            <text
              x={4}
              y={y + 4}
              fill="var(--admin-on-surface-variant)"
              fontSize="10"
              className="font-data"
            >
              {formatInsightNumber(tick)}
            </text>
          </g>
        );
      })}
      <path d={line} fill="none" stroke="var(--admin-warning)" strokeWidth="2" />
      {series.map((point, index) =>
        index % labelEvery === 0 || index === series.length - 1 ? (
          <text
            key={point.period}
            x={points[index]?.x ?? 0}
            y={height - 8}
            textAnchor="middle"
            fill="var(--admin-on-surface-variant)"
            fontSize="10"
            className="font-data"
          >
            {formatPeriodLabel(point.period, range)}
          </text>
        ) : null,
      )}
    </svg>
  );
}

function HealthSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading content health">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <Shimmer className="mb-3 h-3 w-64" />
          <Shimmer className="mb-2 h-8 w-72" />
          <Shimmer className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Shimmer className="h-10 w-72" />
          <Shimmer className="h-10 w-28" />
          <Shimmer className="h-10 w-28" />
        </div>
      </div>
      <Shimmer className="h-12 w-full" />
      {Array.from({ length: 4 }, (_, index) => (
        <section key={index} className={`${insightPanelClassName} p-6`}>
          <div className="flex flex-col gap-6 lg:flex-row">
            <Shimmer className="h-20 w-40" />
            <div className="min-w-0 flex-1 space-y-3">
              <Shimmer className="h-4 w-3/4" />
              <Shimmer className="h-4 w-1/2" />
            </div>
            <Shimmer className="h-11 w-48" />
          </div>
        </section>
      ))}
      <section className={`${insightPanelClassName} p-6`}>
        <Shimmer className="mb-6 h-5 w-48" />
        <Shimmer className="h-56 w-full" />
      </section>
    </div>
  );
}

export function SchoolVitalsContentHealthView({
  slug,
  sectionTitle,
  board,
  loading,
  error,
  range,
  onRangeChange,
  onRefresh,
}: SchoolVitalsContentHealthViewProps) {
  const [copied, setCopied] = useState(false);
  const csv = useMemo(() => (board ? healthCsv(board) : ""), [board]);
  const inverted = board?.signals.filter((signal) => signal.inverted) ?? [];
  const live = board?.signals.find((signal) => signal.id === "upcoming-live") ?? null;

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
        <span className="font-medium text-[var(--admin-on-surface)]">Content health</span>
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
            <h1 className={insightPageTitleClassName}>{board?.title ?? "Content health"}</h1>
          </div>
          <p className={insightPageDescClassName}>
            Four signals that quietly degrade an academy, and where to fix each.
          </p>
          {board?.allClear ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]">
              <span className="h-2 w-2 rounded-full bg-[var(--admin-success)]" aria-hidden="true" />
              All inverted signals are clear. Upcoming live sessions stay informational.
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <RangeControl range={range} onRangeChange={onRangeChange} />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={insightGhostButtonClassName}
              disabled={!board}
              onClick={() => {
                if (!csv) return;
                void copyText(csv).then((ok) => {
                  if (!ok) return;
                  setCopied(true);
                  window.setTimeout(() => {
                    setCopied(false);
                  }, 1600);
                });
              }}
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
                downloadCsv(`content-health-${range}.csv`, csv);
              }}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export
            </button>
            <button type="button" className={insightPrimaryButtonClassName} onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {error ? <ErrorStrip message={error} onRetry={onRefresh} /> : null}
      {loading && !board ? <HealthSkeleton /> : null}

      {board ? (
        <>
          <p className="border-l-2 border-[var(--admin-outline)] pl-3 text-sm italic text-[var(--admin-on-surface-variant)]">
            {board.caveat}
          </p>
          <p className="text-xs text-[var(--admin-on-surface-variant)]">{board.windowNote}</p>

          {board.allClear ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <CompactSignals signals={inverted} />
              </div>
              <div className="lg:col-span-8">
                <section
                  id="upcoming-live"
                  className={`${insightPanelClassName} scroll-mt-16`}
                  aria-label="Upcoming live sessions"
                >
                  <header className="flex items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4">
                    <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--admin-on-surface)]">
                      <Calendar
                        className="h-5 w-5 text-[var(--admin-primary)]"
                        aria-hidden="true"
                      />
                      Upcoming live sessions
                    </h2>
                    <div className="flex flex-wrap items-center gap-2">
                      {live?.secondaryHref && live.secondaryLabel ? (
                        <Link
                          href={live.secondaryHref}
                          prefetch={false}
                          className={insightGhostButtonClassName}
                        >
                          {live.secondaryLabel}
                        </Link>
                      ) : null}
                      {live ? (
                        <Link
                          href={live.href}
                          prefetch={false}
                          className={insightGhostButtonClassName}
                        >
                          {live.primaryLabel}
                        </Link>
                      ) : null}
                    </div>
                  </header>
                  <SessionTable sessions={board.sessions} />
                </section>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {board.signals.map((signal) => (
                <SignalCard key={signal.id} signal={signal} />
              ))}
            </div>
          )}

          <section className={`${insightPanelClassName} p-6`} aria-label="Cases opened">
            <div className="mb-6">
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                Cases opened ({board.rangeLabel})
              </h2>
              <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                This series is cases opened per day, not the size of the open queue. Open-queue
                counts above are a snapshot.
              </p>
            </div>
            <OpenedTrend series={board.openedSeries} range={range} />
          </section>

          {board.generatedAt ? (
            <p className="text-xs text-[var(--admin-on-surface-variant)]">
              Updated {formatRelativeTime(board.generatedAt)}. Window {board.from} to {board.to}.
              <Link
                href={`${adminInsightContentHealthHref(slug)}?range=${range}`}
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
