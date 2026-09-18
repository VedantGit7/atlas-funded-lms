"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Download,
  ExternalLink,
  Info,
  LineChart,
  RefreshCw,
} from "lucide-react";
import {
  ADMIN_INSIGHTS_HREF,
  adminInsightAttendanceHref,
  adminInsightHref,
  adminInsightSessionsHref,
} from "./admin-insights-catalog";
import type { InsightLiveAttendanceBoard, InsightLiveAttendanceQuery } from "./admin-insights-api";
import { formatInsightNumber, formatRelativeTime, widgetToCsv } from "./admin-insights-format";
import {
  insightBreadcrumbClassName,
  insightGhostButtonClassName,
  insightPageClassName,
  insightPageDescClassName,
  insightPageTitleClassName,
  insightPanelClassName,
  insightPrimaryButtonClassName,
  insightShimmerClassName,
  insightTableHeadClassName,
  insightTableRowClassName,
} from "./admin-insights-shared";
import { LIVE_ATTENDANCE_REPORT_HREF, liveAttendanceRateTone } from "./live-dashboard-meta";

type LiveDashboardAttendanceViewProps = {
  slug: string;
  sectionTitle: string;
  board: InsightLiveAttendanceBoard | null;
  loading: boolean;
  error: string | null;
  query: Required<InsightLiveAttendanceQuery>;
  onQueryChange: (patch: Partial<InsightLiveAttendanceQuery>) => void;
  onRefresh: () => void;
};

function Shimmer({ className }: { className: string }) {
  return <div className={`${insightShimmerClassName} ${className}`} />;
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

function attendanceCsv(board: InsightLiveAttendanceBoard): string {
  return widgetToCsv(
    [
      { key: "date", label: "Date" },
      { key: "registered", label: "Registered" },
      { key: "attended", label: "Attended" },
      { key: "gap", label: "Gap" },
      { key: "rate", label: "Rate %" },
      { key: "sessions", label: "Sessions" },
    ],
    board.daily.map((day) => ({
      date: day.period,
      registered: day.registered,
      attended: day.attended,
      gap: day.gap,
      rate: day.rate ?? "",
      sessions: day.sessionCount,
    })),
  );
}

function rateBarClass(tone: ReturnType<typeof liveAttendanceRateTone>): string {
  if (tone === "success") return "bg-[var(--admin-success)]";
  if (tone === "warning") return "bg-[var(--admin-warning)]";
  if (tone === "danger") return "bg-[var(--admin-danger)]";
  return "bg-[var(--admin-primary)]";
}

function rateTextClass(tone: ReturnType<typeof liveAttendanceRateTone>): string {
  if (tone === "success") return "text-[var(--admin-success)]";
  if (tone === "warning") return "text-[var(--admin-warning)]";
  if (tone === "danger") return "text-[var(--admin-danger)]";
  return "text-[var(--admin-on-surface)]";
}

function buildPolyline(values: number[], maxValue: number, invertY = true): string {
  if (values.length === 0) return "";
  return values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 100;
      const ratio = Math.max(0, Math.min(1, value / Math.max(1, maxValue)));
      const y = invertY ? (1 - ratio) * 100 : ratio * 100;
      return `${x},${y}`;
    })
    .join(" ");
}

function AttendanceSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading attendance">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className={`${insightPanelClassName} h-[120px] p-5`}>
            <Shimmer className="h-3 w-28" />
            <Shimmer className="mt-4 h-8 w-20" />
            <Shimmer className="mt-3 h-3 w-36" />
          </div>
        ))}
      </div>
      <div className={`${insightPanelClassName} p-6`}>
        <Shimmer className="mb-4 h-5 w-56" />
        <Shimmer className="h-64 w-full" />
      </div>
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className={`${insightPanelClassName} flex-[58] p-6`}>
          <Shimmer className="mb-6 h-5 w-40" />
          {Array.from({ length: 7 }).map((_, index) => (
            <Shimmer key={index} className="mb-3 h-3 w-full" />
          ))}
        </div>
        <div className="flex flex-[42] flex-col gap-6">
          <div className={`${insightPanelClassName} p-5`}>
            <Shimmer className="mb-4 h-5 w-48" />
            {Array.from({ length: 4 }).map((_, index) => (
              <Shimmer key={index} className="mb-3 h-4 w-full" />
            ))}
          </div>
          <div className={`${insightPanelClassName} h-48 p-5`}>
            <Shimmer className="mb-4 h-5 w-40" />
            <Shimmer className="h-32 w-full" />
          </div>
        </div>
      </div>
      <div className={insightPanelClassName}>
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] px-4 last:border-b-0"
          >
            <Shimmer className="h-4 w-20" />
            <Shimmer className="ml-auto h-4 w-10" />
            <Shimmer className="h-4 w-10" />
            <Shimmer className="h-4 w-10" />
            <Shimmer className="h-4 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

function GapTrendChart({ board }: { board: InsightLiveAttendanceBoard }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const points = board.trend.points;
  const maxValue = board.trend.maxValue;
  const registeredLine = buildPolyline(
    points.map((point) => point.registered),
    maxValue,
  );
  const attendedLine = buildPolyline(
    points.map((point) => point.attended),
    maxValue,
  );
  const meanY = maxValue > 0 ? (1 - Math.min(1, board.trend.meanAttended / maxValue)) * 100 : 50;

  const gapPolygon = useMemo(() => {
    if (points.length === 0) return "";
    const top = points.map((point, index) => {
      const x = points.length === 1 ? 0 : (index / (points.length - 1)) * 100;
      const y = (1 - point.registered / maxValue) * 100;
      return `${x},${y}`;
    });
    const bottom = [...points].reverse().map((point, revIndex) => {
      const index = points.length - 1 - revIndex;
      const x = points.length === 1 ? 0 : (index / (points.length - 1)) * 100;
      const y = (1 - point.attended / maxValue) * 100;
      return `${x},${y}`;
    });
    return [...top, ...bottom].join(" ");
  }, [points, maxValue]);

  const hover = hoverIndex != null ? points[hoverIndex] : null;
  const tickIndexes = [
    0,
    Math.floor((points.length - 1) / 4),
    Math.floor((points.length - 1) / 2),
    Math.floor(((points.length - 1) * 3) / 4),
    points.length - 1,
  ].filter((value, index, arr) => value >= 0 && arr.indexOf(value) === index);

  return (
    <section className={`${insightPanelClassName} p-6`}>
      <div className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
          <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
            Attendance vs roster trend
          </h3>
          <div className="flex flex-wrap gap-4 text-xs text-[var(--admin-on-surface-variant)]">
            <span className="inline-flex items-center gap-1">
              <span className="h-0.5 w-3 bg-[var(--admin-outline)]" aria-hidden="true" />
              Registered
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-0.5 w-3 bg-[var(--admin-primary)]" aria-hidden="true" />
              Attended
            </span>
            <span className="inline-flex items-center gap-1">
              <span
                className="h-3 w-3 bg-[var(--admin-primary-container)] opacity-50"
                aria-hidden="true"
              />
              No-show gap
            </span>
            <span className="inline-flex items-center gap-1">
              <span
                className="w-3 border-t border-dashed border-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              {board.days}d mean
            </span>
          </div>
        </div>
        <p className="text-xs text-[var(--admin-on-surface-variant)]">{board.trend.caption}</p>
      </div>

      <div className="relative mt-2 h-64 w-full border-b border-l border-[var(--admin-border)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(to right, color-mix(in srgb, var(--admin-border) 80%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--admin-border) 80%, transparent) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {points.map((point, index) =>
          point.isWeekend ? (
            <div
              key={`weekend-${point.period}`}
              className="pointer-events-none absolute inset-y-0 bg-[var(--admin-surface-low)] opacity-50"
              style={{
                left: `${points.length === 1 ? 0 : (index / (points.length - 1)) * 100}%`,
                width: `${points.length === 1 ? 100 : 100 / (points.length - 1)}%`,
              }}
            />
          ) : null,
        )}

        <div className="absolute -left-8 top-0 bottom-0 flex flex-col justify-between py-2 font-data text-[10px] text-[var(--admin-on-surface-variant)]">
          <span>{formatInsightNumber(maxValue)}</span>
          <span>{formatInsightNumber(Math.round(maxValue * 0.5))}</span>
          <span>0</span>
        </div>

        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label="Attendance versus registered trend"
          onMouseLeave={() => {
            setHoverIndex(null);
          }}
        >
          <polygon points={gapPolygon} fill="var(--admin-primary-container)" opacity="0.45" />
          <line
            x1="0"
            x2="100"
            y1={meanY}
            y2={meanY}
            stroke="var(--admin-on-surface-variant)"
            strokeWidth="0.4"
            strokeDasharray="2 2"
          />
          <polyline
            points={registeredLine}
            fill="none"
            stroke="var(--admin-outline)"
            strokeWidth="0.8"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={attendedLine}
            fill="none"
            stroke="var(--admin-primary)"
            strokeWidth="1.1"
            vectorEffect="non-scaling-stroke"
          />
          {points.map((point, index) => {
            const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
            return (
              <rect
                key={point.period}
                x={x - 1.2}
                y={0}
                width={2.4}
                height={100}
                fill="transparent"
                onMouseEnter={() => {
                  setHoverIndex(index);
                }}
              />
            );
          })}
        </svg>

        {hover && hoverIndex != null ? (
          <div
            className="pointer-events-none absolute z-10 min-w-[140px] rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 shadow-lg"
            style={{
              left: `${points.length === 1 ? 50 : (hoverIndex / (points.length - 1)) * 100}%`,
              top: "12%",
              transform: "translate(-50%, -100%)",
            }}
          >
            <p className="mb-2 font-data text-xs text-[var(--admin-on-surface-variant)]">
              {hover.label}
            </p>
            <div className="flex justify-between gap-4 font-data text-xs">
              <span className="text-[var(--admin-on-surface-variant)]">Registered</span>
              <span>{formatInsightNumber(hover.registered)}</span>
            </div>
            <div className="flex justify-between gap-4 font-data text-xs">
              <span className="text-[var(--admin-on-surface-variant)]">Attended</span>
              <span>{formatInsightNumber(hover.attended)}</span>
            </div>
            <div className="my-1 h-px bg-[var(--admin-border)]" />
            <div className="flex justify-between gap-4 font-data text-xs text-[var(--admin-warning)]">
              <span>Gap</span>
              <span>{formatInsightNumber(hover.gap)}</span>
            </div>
          </div>
        ) : null}

        <div className="absolute -bottom-6 left-0 right-0 flex justify-between px-2 font-data text-[10px] text-[var(--admin-on-surface-variant)]">
          {tickIndexes.map((index) => (
            <span key={points[index]?.period ?? index}>{points[index]?.label ?? ""}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LiveDashboardAttendanceView({
  slug,
  sectionTitle,
  board,
  loading,
  error,
  onQueryChange,
  onRefresh,
}: LiveDashboardAttendanceViewProps) {
  const [copyFlash, setCopyFlash] = useState(false);
  const showSkeleton = loading && !board;
  const maxWeekdayGap = Math.max(
    1,
    ...(board?.weekdayGaps.map((item) => item.gapRate ?? 0) ?? [1]),
  );

  return (
    <div className={insightPageClassName}>
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <nav className={insightBreadcrumbClassName} aria-label="Breadcrumb">
            <Link
              href={ADMIN_INSIGHTS_HREF}
              prefetch={false}
              className="hover:text-[var(--admin-on-surface)]"
            >
              Admin
            </Link>
            <span className="text-[var(--admin-on-surface-variant)]">/</span>
            <Link
              href={adminInsightHref(slug)}
              prefetch={false}
              className="hover:text-[var(--admin-on-surface)]"
            >
              {sectionTitle}
            </Link>
            <span className="text-[var(--admin-on-surface-variant)]">/</span>
            <Link
              href={adminInsightAttendanceHref(slug)}
              prefetch={false}
              className="font-medium text-[var(--admin-on-surface)]"
            >
              Attendance
            </Link>
          </nav>
          <h1 className={insightPageTitleClassName}>Attendance</h1>
          <p className={insightPageDescClassName}>
            Who was rostered against who turned up, day by day.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={insightGhostButtonClassName}
            disabled={!board || board.daily.length === 0}
            onClick={() => {
              if (!board) return;
              void copyText(attendanceCsv(board)).then((ok) => {
                if (!ok) return;
                setCopyFlash(true);
                window.setTimeout(() => {
                  setCopyFlash(false);
                }, 1600);
              });
            }}
          >
            <ClipboardCopy className="h-[18px] w-[18px]" aria-hidden="true" />
            {copyFlash ? "Copied" : "Copy as CSV"}
          </button>
          <button
            type="button"
            className={insightGhostButtonClassName}
            disabled={!board || board.daily.length === 0}
            onClick={() => {
              if (!board) return;
              downloadCsv(`live-attendance-${slug}.csv`, attendanceCsv(board));
            }}
          >
            <Download className="h-[18px] w-[18px]" aria-hidden="true" />
            Export
          </button>
          <Link
            href={board?.attendanceHref ?? LIVE_ATTENDANCE_REPORT_HREF}
            prefetch={false}
            className={insightPrimaryButtonClassName}
          >
            Open Live Class Attendance
            <ExternalLink className="h-[18px] w-[18px]" aria-hidden="true" />
          </Link>
          <button
            type="button"
            className={insightGhostButtonClassName}
            disabled={loading}
            onClick={onRefresh}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      {showSkeleton ? <AttendanceSkeleton /> : null}

      {error && !board ? (
        <section className="flex flex-col items-start justify-between gap-4 rounded border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-[var(--admin-danger)]" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-[var(--admin-danger)]">
                Could not load attendance overview
              </h3>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">{error}</p>
            </div>
          </div>
          <button type="button" className={insightPrimaryButtonClassName} onClick={onRefresh}>
            Retry
          </button>
        </section>
      ) : null}

      {board ? (
        <>
          {error ? (
            <p className="rounded border border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] px-4 py-2 text-sm text-[var(--admin-warning)]">
              Refresh failed: {error}. Showing last successful snapshot.
            </p>
          ) : null}

          <div className="flex items-start gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
            <Info
              className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            <p className="text-[13px] leading-snug text-[var(--admin-on-surface-variant)]">
              {board.caveat}
            </p>
          </div>

          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            {board.windowLabel} · Generated {formatRelativeTime(board.generatedAt)}
            {" · "}
            <Link
              href={adminInsightSessionsHref(slug)}
              prefetch={false}
              className="text-[var(--admin-primary)] hover:underline"
            >
              Sessions ledger
            </Link>
          </p>

          {board.empty ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Attendance rate (30d)", "0%"],
                  ["No-show gap", "0"],
                  ["Average daily gap", "0"],
                  ["Best / worst day", "-"],
                ].map(([label, value]) => (
                  <div key={label} className={`${insightPanelClassName} justify-between p-5`}>
                    <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                      {label}
                    </h3>
                    <p className="mt-2 font-data text-[28px] font-semibold leading-9 text-[var(--admin-on-surface)]">
                      {value}
                    </p>
                    <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                      No active sessions
                    </p>
                  </div>
                ))}
              </div>
              <div
                className={`${insightPanelClassName} items-center justify-center px-8 py-16 text-center`}
              >
                <LineChart
                  className="mb-4 h-16 w-16 text-[var(--admin-surface-high)]"
                  aria-hidden="true"
                />
                <h3 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
                  No attendance recorded in this window
                </h3>
                <p className="mb-8 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
                  There is no data to visualize for the selected window. Schedule live sessions and
                  log attendance to populate this board.
                </p>
                <Link
                  href={board.sessionsHref}
                  prefetch={false}
                  className={insightGhostButtonClassName}
                >
                  Open Live Sessions
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className={`${insightPanelClassName} justify-between p-5`}>
                  <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    Attendance rate ({board.days}d)
                  </h3>
                  <div>
                    <p className="font-data text-[28px] font-semibold leading-9 text-[var(--admin-on-surface)]">
                      {board.summary.attendanceRate}%
                    </p>
                    <div className="my-2 h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                      <div
                        className="h-full rounded-full bg-[var(--admin-primary)]"
                        style={{
                          width: `${Math.min(100, Math.max(0, board.summary.attendanceRate))}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-[var(--admin-on-surface-variant)]">
                      {formatInsightNumber(board.summary.attended)} attended of{" "}
                      {formatInsightNumber(board.summary.rostered)} rostered
                    </p>
                  </div>
                </div>

                <div className={`${insightPanelClassName} justify-between p-5`}>
                  <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    No-show gap
                  </h3>
                  <div>
                    <p className="font-data text-[28px] font-semibold leading-9 text-[var(--admin-warning)]">
                      {formatInsightNumber(board.summary.noShowGap)}
                    </p>
                    <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                      {board.summary.noShowPct}% did not attend
                    </p>
                  </div>
                </div>

                <div className={`${insightPanelClassName} justify-between p-5`}>
                  <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    Average daily gap
                  </h3>
                  <div>
                    <p className="font-data text-[28px] font-semibold leading-9 text-[var(--admin-on-surface)]">
                      {formatInsightNumber(board.summary.avgDailyGap)}
                    </p>
                    <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">learners</p>
                  </div>
                </div>

                <div className={`${insightPanelClassName} justify-between p-5`}>
                  <div className="mb-4 flex items-baseline justify-between border-b border-[var(--admin-border)] pb-2">
                    <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                      Best day
                    </h3>
                    <div className="flex items-center gap-2 font-data text-[13px]">
                      <span className="text-[var(--admin-on-surface-variant)]">
                        {board.summary.bestDay?.label ?? "-"}
                      </span>
                      {board.summary.bestDay ? (
                        <span className="font-semibold text-[var(--admin-success)]">
                          · {board.summary.bestDay.rate}%
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-auto flex items-baseline justify-between">
                    <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                      Worst day
                    </h3>
                    <div className="flex items-center gap-2 font-data text-[13px]">
                      <span className="text-[var(--admin-on-surface-variant)]">
                        {board.summary.worstDay?.label ?? "-"}
                      </span>
                      {board.summary.worstDay ? (
                        <span className="font-semibold text-[var(--admin-warning)]">
                          · {board.summary.worstDay.rate}%
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <GapTrendChart board={board} />

              <div className="flex flex-col gap-6 lg:flex-row">
                <section className={`${insightPanelClassName} flex-[58] p-6`}>
                  <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-baseline">
                    <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
                      Gap by day of week
                    </h3>
                    <p className="text-xs text-[var(--admin-on-surface-variant)]">
                      {board.weekdayCaption}
                    </p>
                  </div>
                  <div className="flex flex-col justify-center gap-4">
                    {board.weekdayGaps.map((item) => {
                      const value = item.gapRate ?? 0;
                      const width = item.gapRate == null ? 0 : (value / maxWeekdayGap) * 100;
                      return (
                        <div key={item.weekday} className="flex items-center gap-3">
                          <span
                            className={`w-8 text-right font-data text-[13px] ${
                              item.highlight
                                ? "font-bold text-[var(--admin-warning)]"
                                : "text-[var(--admin-on-surface-variant)]"
                            }`}
                          >
                            {item.label}
                          </span>
                          <div className="h-[3px] flex-1 rounded-full bg-[var(--admin-surface-high)]">
                            <div
                              className={`h-full rounded-full ${
                                item.highlight
                                  ? "bg-[var(--admin-warning)]"
                                  : item.weekday >= 6
                                    ? "bg-[var(--admin-outline)]"
                                    : "bg-[var(--admin-primary)]"
                              }`}
                              style={{ width: `${width}%` }}
                            />
                          </div>
                          <span
                            className={`w-10 font-data text-[13px] ${
                              item.highlight
                                ? "font-bold text-[var(--admin-warning)]"
                                : "text-[var(--admin-on-surface)]"
                            }`}
                          >
                            {item.gapRate != null ? `${item.gapRate}%` : "-"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <div className="flex flex-[42] flex-col gap-6">
                  <section className={`${insightPanelClassName} p-5`}>
                    <h3 className="mb-3 border-b border-[var(--admin-border)] pb-2 text-base font-semibold text-[var(--admin-on-surface)]">
                      Where the gap concentrates
                    </h3>
                    {board.topGapSessions.length === 0 ? (
                      <p className="py-6 text-center text-sm text-[var(--admin-on-surface-variant)]">
                        No ended sessions with roster gaps in this window.
                      </p>
                    ) : (
                      <div className="flex flex-col">
                        <div className="mb-1 grid grid-cols-[1fr_40px_40px_40px_24px] gap-2 border-b border-[var(--admin-border)] pb-2">
                          <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                            Session
                          </span>
                          <span
                            className="text-right text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]"
                            title="Rostered"
                          >
                            R
                          </span>
                          <span
                            className="text-right text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]"
                            title="Attended"
                          >
                            A
                          </span>
                          <span
                            className="text-right text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-warning)]"
                            title="Gap"
                          >
                            G
                          </span>
                          <span />
                        </div>
                        {board.topGapSessions.map((session) => (
                          <Link
                            key={session.id}
                            href={session.href}
                            prefetch={false}
                            className="group grid grid-cols-[1fr_40px_40px_40px_24px] items-center gap-2 border-b border-[var(--admin-border)] py-1.5 last:border-b-0 hover:bg-[var(--admin-surface-high)]"
                          >
                            <span className="truncate text-[13px] text-[var(--admin-on-surface)]">
                              {session.title}
                            </span>
                            <span className="text-right font-data text-[13px] text-[var(--admin-on-surface-variant)]">
                              {formatInsightNumber(session.rostered)}
                            </span>
                            <span className="text-right font-data text-[13px] text-[var(--admin-on-surface)]">
                              {formatInsightNumber(session.attended)}
                            </span>
                            <span className="text-right font-data text-[13px] font-bold text-[var(--admin-warning)]">
                              {formatInsightNumber(session.gap)}
                            </span>
                            <ChevronRight
                              className="h-4 w-4 text-[var(--admin-outline)] opacity-0 transition-opacity group-hover:opacity-100"
                              aria-hidden="true"
                            />
                          </Link>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className={`${insightPanelClassName} p-5`}>
                    <div className="mb-2 flex items-baseline justify-between gap-2">
                      <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">
                        Rate against volume
                      </h3>
                      <p className="text-[11px] text-[var(--admin-on-surface-variant)]">
                        {board.scatter.caption}
                      </p>
                    </div>
                    <div className="relative mt-2 h-40 border-b border-l border-[var(--admin-border)]">
                      <div
                        className="pointer-events-none absolute inset-0 opacity-30"
                        style={{
                          backgroundImage:
                            "linear-gradient(to right, color-mix(in srgb, var(--admin-border) 80%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--admin-border) 80%, transparent) 1px, transparent 1px)",
                          backgroundSize: "24px 24px",
                        }}
                      />
                      <svg
                        className="absolute inset-0 h-full w-full"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        role="img"
                        aria-label="Attendance rate against roster volume"
                      >
                        <line
                          x1="0"
                          x2="100"
                          y1="50"
                          y2="50"
                          stroke="var(--admin-on-surface-variant)"
                          strokeWidth="0.4"
                          strokeDasharray="2 2"
                        />
                        {board.scatter.points.map((point) => (
                          <circle
                            key={point.id}
                            cx={point.x}
                            cy={point.y}
                            r={Math.max(1.6, Math.min(4.5, 1.4 + point.rostered / 25))}
                            fill="var(--admin-primary)"
                            opacity="0.8"
                          >
                            <title>
                              {point.title}: {point.rate}% · roster {point.rostered}
                            </title>
                          </circle>
                        ))}
                      </svg>
                      <span className="absolute left-1 top-[45%] font-data text-[9px] text-[var(--admin-on-surface-variant)]">
                        50%
                      </span>
                      <span className="absolute bottom-1 right-2 font-data text-[9px] text-[var(--admin-on-surface-variant)]">
                        Vol →
                      </span>
                    </div>
                  </section>
                </div>
              </div>

              <section className={`${insightPanelClassName} mb-8 overflow-hidden`}>
                <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-bg)] p-4">
                  <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
                    Daily breakdown ({board.windowLabel.toLowerCase()})
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] px-2 py-1 font-data text-[11px] text-[var(--admin-on-surface-variant)]">
                    <span
                      className="h-2 w-2 rounded-full bg-[var(--admin-warning)]"
                      aria-hidden="true"
                    />
                    Gap alert &gt; 30%
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] border-collapse text-left">
                    <thead className={insightTableHeadClassName}>
                      <tr>
                        <th className="w-[120px] px-4 py-3">Date</th>
                        <th className="w-[100px] px-4 py-3 text-right">Registered</th>
                        <th className="w-[100px] px-4 py-3 text-right">Attended</th>
                        <th className="w-[100px] px-4 py-3 text-right">Gap</th>
                        <th className="w-[200px] px-4 py-3">Rate %</th>
                        <th className="w-[100px] px-4 py-3 text-right">Sessions</th>
                        <th className="w-[40px] px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {board.daily.map((day) => {
                        const emptyDay = day.sessionCount === 0 && day.registered === 0;
                        const tone =
                          day.rate == null ? "neutral" : liveAttendanceRateTone(day.rate);
                        const isBest =
                          board.summary.bestDay?.period === day.period && day.rate != null;
                        const isWorst =
                          board.summary.worstDay?.period === day.period && day.rate != null;
                        return (
                          <tr
                            key={day.period}
                            className={`${insightTableRowClassName} group ${
                              emptyDay
                                ? "bg-[color-mix(in_srgb,var(--admin-surface-low)_50%,transparent)] text-[var(--admin-on-surface-variant)] opacity-70"
                                : day.gapAlert
                                  ? "bg-[color-mix(in_srgb,var(--admin-primary-container)_20%,transparent)]"
                                  : isBest
                                    ? "bg-[color-mix(in_srgb,var(--admin-success)_8%,transparent)]"
                                    : ""
                            } ${day.gapAlert ? "border-l-2 border-l-[var(--admin-primary)]" : ""}`}
                          >
                            <td className="px-4 py-2 font-data text-sm">{day.label}</td>
                            <td className="px-4 py-2 text-right font-data text-sm">
                              {emptyDay ? "-" : formatInsightNumber(day.registered)}
                            </td>
                            <td className="px-4 py-2 text-right font-data text-sm">
                              {emptyDay ? "-" : formatInsightNumber(day.attended)}
                            </td>
                            <td
                              className={`px-4 py-2 text-right font-data text-sm ${
                                day.gapAlert
                                  ? "font-bold text-[var(--admin-warning)]"
                                  : isBest
                                    ? "text-[var(--admin-success)]"
                                    : ""
                              }`}
                            >
                              {emptyDay ? "-" : formatInsightNumber(day.gap)}
                            </td>
                            <td className="px-4 py-2">
                              {emptyDay || day.rate == null ? (
                                <span className="font-data text-sm text-[var(--admin-on-surface-variant)]">
                                  -
                                </span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`w-10 text-right font-data text-sm ${rateTextClass(tone)} ${
                                      isBest || isWorst ? "font-bold" : ""
                                    }`}
                                  >
                                    {day.rate}%
                                  </span>
                                  <div className="h-[3px] flex-1 rounded-full bg-[var(--admin-surface-high)]">
                                    <div
                                      className={`h-full rounded-full ${rateBarClass(tone)}`}
                                      style={{ width: `${Math.min(100, Math.max(0, day.rate))}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right font-data text-sm">
                              {formatInsightNumber(day.sessionCount)}
                            </td>
                            <td className="px-4 py-2 text-center">
                              {!emptyDay ? (
                                <Link
                                  href={board.sessionsBoardHref}
                                  prefetch={false}
                                  className="inline-flex text-[var(--admin-on-surface-variant)] opacity-0 transition-opacity group-hover:opacity-100"
                                  aria-label={`Open sessions for ${day.label}`}
                                >
                                  <ChevronRight className="h-[18px] w-[18px]" aria-hidden="true" />
                                </Link>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-bg)] p-3 text-xs text-[var(--admin-on-surface-variant)]">
                  <span>
                    Showing {(board.page - 1) * board.pageSize + 1}-
                    {Math.min(board.page * board.pageSize, board.totalDaily)} of{" "}
                    {formatInsightNumber(board.totalDaily)} days
                  </span>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-[var(--admin-primary)] disabled:opacity-30"
                      disabled={board.page <= 1}
                      onClick={() => {
                        onQueryChange({ page: board.page - 1 });
                      }}
                    >
                      <ChevronLeft className="h-[18px] w-[18px]" aria-hidden="true" />
                      Prev
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-[var(--admin-primary)] disabled:opacity-30"
                      disabled={board.page >= board.pageCount}
                      onClick={() => {
                        onQueryChange({ page: board.page + 1 });
                      }}
                    >
                      Next
                      <ChevronRight className="h-[18px] w-[18px]" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
