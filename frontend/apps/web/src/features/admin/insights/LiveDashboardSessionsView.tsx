"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  ArrowDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Download,
  ExternalLink,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Search,
  CalendarX2,
} from "lucide-react";
import {
  DropdownField,
  dropdownItemClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import {
  ADMIN_INSIGHTS_HREF,
  adminInsightHref,
  adminInsightNowHref,
  adminInsightSessionsHref,
} from "./admin-insights-catalog";
import type {
  InsightLiveSessionsBoard,
  InsightLiveSessionsQuery,
  InsightLiveSessionsRow,
  InsightLiveSessionsSort,
  InsightLiveSessionsStatusFilter,
  InsightLiveSessionsTurnoutFilter,
  InsightLiveSessionsView,
  InsightLiveSessionsWatchFilter,
} from "./admin-insights-api";
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
import { liveAttendanceRateTone, LIVE_ATTENDANCE_REPORT_HREF } from "./live-dashboard-meta";

type LiveDashboardSessionsViewProps = {
  slug: string;
  sectionTitle: string;
  board: InsightLiveSessionsBoard | null;
  loading: boolean;
  error: string | null;
  query: Required<InsightLiveSessionsQuery>;
  onQueryChange: (patch: Partial<InsightLiveSessionsQuery>) => void;
  onRefresh: () => void;
};

function Shimmer({ className }: { className: string }) {
  return <div className={`${insightShimmerClassName} ${className}`} />;
}

function formatClock(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDuration(minutes: number | null): string | null {
  if (minutes == null || minutes <= 0) return null;
  if (minutes < 60) return `${minutes}m duration`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours}h ${rem}m duration` : `${hours}h duration`;
}

function rateToneClass(tone: ReturnType<typeof liveAttendanceRateTone>): string {
  if (tone === "success") return "text-[var(--admin-success)]";
  if (tone === "warning") return "text-[var(--admin-warning)]";
  if (tone === "danger") return "text-[var(--admin-danger)]";
  return "text-[var(--admin-on-surface)]";
}

function rateBarClass(tone: ReturnType<typeof liveAttendanceRateTone>): string {
  if (tone === "success") return "bg-[var(--admin-success)]";
  if (tone === "warning") return "bg-[var(--admin-warning)]";
  if (tone === "danger") return "bg-[var(--admin-danger)]";
  return "bg-[var(--admin-primary)]";
}

function statusPillClass(status: string): string {
  if (status === "live") {
    return "border-[color-mix(in_srgb,var(--admin-success)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]";
  }
  if (status === "scheduled") {
    return "border-[color-mix(in_srgb,var(--admin-warning)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]";
  }
  if (status === "cancelled") {
    return "border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]";
  }
  return "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]";
}

const VIEW_TABS: Array<{ id: InsightLiveSessionsView; label: string }> = [
  { id: "all", label: "All sessions" },
  { id: "low-turnout", label: "Low turnout" },
  { id: "upcoming", label: "Upcoming" },
  { id: "live", label: "Live now" },
];

const STATUS_OPTIONS: Array<{ value: InsightLiveSessionsStatusFilter; label: string }> = [
  { value: "all", label: "Any status" },
  { value: "live", label: "Live" },
  { value: "scheduled", label: "Scheduled" },
  { value: "ended", label: "Ended" },
  { value: "cancelled", label: "Cancelled" },
];

const TURNOUT_OPTIONS: Array<{ value: InsightLiveSessionsTurnoutFilter; label: string }> = [
  { value: "all", label: "Any turnout" },
  { value: "below-50", label: "Below 50%" },
  { value: "above-50", label: "50% or higher" },
  { value: "no-roster", label: "No roster" },
];

const WATCH_OPTIONS: Array<{ value: InsightLiveSessionsWatchFilter; label: string }> = [
  { value: "all", label: "Any watch time" },
  { value: "short", label: "Under 30 min" },
  { value: "long", label: "30 min or more" },
];

const SORT_OPTIONS: Array<{ value: InsightLiveSessionsSort; label: string }> = [
  { value: "scheduled_desc", label: "Scheduled (Desc)" },
  { value: "scheduled_asc", label: "Scheduled (Asc)" },
  { value: "rate_desc", label: "Rate (High to low)" },
  { value: "rate_asc", label: "Rate (Low to high)" },
  { value: "attended_desc", label: "Attended (Desc)" },
];

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

function sessionsCsv(board: InsightLiveSessionsBoard): string {
  return widgetToCsv(
    [
      { key: "title", label: "Session" },
      { key: "status", label: "Status" },
      { key: "scheduledAt", label: "Scheduled" },
      { key: "attended", label: "Attended" },
      { key: "rostered", label: "Registered/Rostered" },
      { key: "rate", label: "Rate %" },
      { key: "avgMin", label: "Avg min" },
      { key: "batch", label: "Batch" },
      { key: "course", label: "Course" },
    ],
    board.sessions.map((session) => ({
      title: session.title,
      status: session.statusLabel,
      scheduledAt: session.scheduledAt ?? "",
      attended: session.attendedCount,
      rostered: `${session.registeredCount}/${session.rosteredCount}`,
      rate: session.attendanceRate ?? "",
      avgMin: session.avgWatchMinutes ?? "",
      batch: session.batchLabel ?? "",
      course: session.courseLabel ?? "",
    })),
  );
}

function FilterDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value)?.label ?? label;

  return (
    <div className="min-w-[9rem]">
      <DropdownField
        label={null}
        labelId={`${label}-filter`}
        open={open}
        onToggle={() => {
          setOpen((prev) => !prev);
        }}
        triggerContent={current}
        panelAriaLabel={label}
        portalZIndex={85}
      >
        <div className="max-h-64 overflow-y-auto bg-[var(--admin-surface)] p-1">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={dropdownItemClassName}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </DropdownField>
    </div>
  );
}

function LiveDashboardSessionsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading sessions ledger">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
        <div className={`${insightPanelClassName} p-5 lg:col-span-2`}>
          <Shimmer className="h-4 w-24" />
          <Shimmer className="mt-3 h-9 w-20" />
          <Shimmer className="mt-4 h-3 w-48" />
        </div>
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className={`${insightPanelClassName} p-5`}>
            <Shimmer className="h-3 w-28" />
            <Shimmer className="mt-3 h-9 w-16" />
            <Shimmer className="mt-4 h-1.5 w-full rounded-full" />
          </div>
        ))}
        <div className="flex flex-col gap-6">
          <div className={`${insightPanelClassName} p-4`}>
            <Shimmer className="h-3 w-24" />
            <Shimmer className="mt-2 h-5 w-16" />
          </div>
          <div className={`${insightPanelClassName} p-4`}>
            <Shimmer className="h-3 w-20" />
            <Shimmer className="mt-2 h-5 w-20" />
          </div>
        </div>
      </div>
      <div className={insightPanelClassName}>
        <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
          <div className="mb-3 flex gap-3">
            <Shimmer className="h-8 w-28" />
            <Shimmer className="h-8 w-28" />
            <Shimmer className="h-8 w-24" />
          </div>
          <div className="flex flex-wrap gap-3">
            <Shimmer className="h-10 w-64" />
            <Shimmer className="h-10 w-28" />
            <Shimmer className="h-10 w-28" />
          </div>
        </div>
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] px-4 last:border-b-0"
          >
            <Shimmer className="h-4 w-4" />
            <Shimmer className="h-4 w-48 flex-1" />
            <Shimmer className="h-5 w-16 rounded-full" />
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-4 w-10" />
            <Shimmer className="h-4 w-12" />
          </div>
        ))}
      </div>
      <div className={`${insightPanelClassName} p-6`}>
        <Shimmer className="mb-6 h-5 w-40" />
        <div className="flex h-40 items-end gap-1">
          {Array.from({ length: 10 }).map((_, index) => (
            <Shimmer key={index} className="h-full flex-1 rounded-t" />
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryBand({
  board,
  onOpenLowTurnout,
}: {
  board: InsightLiveSessionsBoard;
  onOpenLowTurnout: () => void;
}) {
  const { summary, allHealthy } = board;
  const healthyZero = allHealthy || summary.below50Count === 0;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
      <div className={`${insightPanelClassName} justify-between p-5 lg:col-span-2`}>
        <h3 className="text-base font-semibold text-[var(--admin-on-surface-variant)]">Sessions</h3>
        <p className="mt-2 font-data text-[28px] font-semibold leading-9 tracking-tight text-[var(--admin-on-surface)]">
          {formatInsightNumber(summary.sessionCount)}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]">
          <span>{formatInsightNumber(summary.endedCount)} ended</span>
          <span className="h-1 w-1 rounded-full bg-[var(--admin-outline)]" aria-hidden="true" />
          <span>{formatInsightNumber(summary.upcomingCount)} upcoming</span>
          <span className="h-1 w-1 rounded-full bg-[var(--admin-outline)]" aria-hidden="true" />
          <span className="inline-flex items-center gap-1 font-semibold text-[var(--admin-success)]">
            <span
              className="h-2 w-2 rounded-full bg-[var(--admin-success)] motion-safe:animate-pulse"
              aria-hidden="true"
            />
            {formatInsightNumber(summary.liveCount)} live
          </span>
        </div>
      </div>

      <div className={`${insightPanelClassName} justify-between p-5`}>
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
          Attendance rate
        </h3>
        <p className="mt-2 font-data text-[28px] font-semibold leading-9 text-[var(--admin-on-surface)]">
          {summary.attendanceRate}%
        </p>
        <div className="mt-4 h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
          <div
            className="h-full bg-[var(--admin-primary)]"
            style={{ width: `${Math.min(100, Math.max(0, summary.attendanceRate))}%` }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenLowTurnout}
        className={`rounded-xl border p-5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 ${
          healthyZero
            ? "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))]"
            : "border-[color-mix(in_srgb,var(--admin-warning)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] hover:bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))]"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <h3
            className={`text-[12px] font-semibold uppercase tracking-[0.06em] ${
              healthyZero ? "text-[var(--admin-success)]" : "text-[var(--admin-warning)]"
            }`}
          >
            Below 50% turnout
          </h3>
          <ExternalLink
            className={`h-4 w-4 shrink-0 ${
              healthyZero ? "text-[var(--admin-success)]" : "text-[var(--admin-warning)]"
            }`}
            aria-hidden="true"
          />
        </div>
        <p
          className={`mt-2 font-data text-[28px] font-semibold leading-9 ${
            healthyZero ? "text-[var(--admin-success)]" : "text-[var(--admin-warning)]"
          }`}
        >
          {formatInsightNumber(summary.below50Count)}
        </p>
        <p
          className={`mt-4 text-xs ${
            healthyZero ? "text-[var(--admin-success)]" : "text-[var(--admin-warning)]"
          }`}
        >
          {healthyZero ? "All healthy" : "Sessions requiring review"}
        </p>
      </button>

      <div className="flex flex-col gap-6">
        <div className={`${insightPanelClassName} justify-center p-4`}>
          <h3 className="text-xs text-[var(--admin-on-surface-variant)]">Average watch</h3>
          <p className="mt-1 font-data text-sm font-semibold text-[var(--admin-on-surface)]">
            {formatInsightNumber(summary.avgWatchMinutes)} min
          </p>
        </div>
        <div className={`${insightPanelClassName} justify-center p-4`}>
          <h3 className="text-xs text-[var(--admin-on-surface-variant)]">Total watch</h3>
          <p className="mt-1 font-data text-sm font-semibold text-[var(--admin-on-surface)]">
            {formatInsightNumber(summary.totalWatchHours)} hrs
          </p>
        </div>
      </div>
    </div>
  );
}

function SessionRow({
  session,
  selected,
  onToggle,
  now,
}: {
  session: InsightLiveSessionsRow;
  selected: boolean;
  onToggle: () => void;
  now: Date;
}) {
  const tone =
    session.attendanceRate != null ? liveAttendanceRateTone(session.attendanceRate) : "neutral";
  const maxWatch = 120;
  const watchPct =
    session.avgWatchMinutes != null
      ? Math.min(100, Math.round((session.avgWatchMinutes / maxWatch) * 100))
      : 0;

  return (
    <tr
      className={`group relative ${insightTableRowClassName} ${
        selected ? "bg-[var(--admin-primary-container)]" : ""
      } ${
        session.accent === "live"
          ? "border-l-2 border-l-[var(--admin-success)]"
          : session.accent === "low"
            ? "border-l-2 border-l-[var(--admin-warning)]"
            : ""
      }`}
    >
      <td className="border-r border-[var(--admin-border)] px-4">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${session.title}`}
        />
      </td>
      <td className="px-4 py-2">
        <Link
          href={session.href}
          prefetch={false}
          className="font-semibold text-[var(--admin-primary)] hover:underline"
        >
          {session.title}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          {session.courseLabel ? (
            <span className="rounded-sm bg-[var(--admin-surface-high)] px-1.5 text-xs text-[var(--admin-on-surface-variant)]">
              {session.courseLabel}
            </span>
          ) : null}
          {session.batchLabel ? (
            <span className="rounded-sm bg-[var(--admin-surface-high)] px-1.5 text-xs text-[var(--admin-on-surface-variant)]">
              {session.batchLabel}
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-4">
        <span
          className={`inline-block rounded border px-2 py-0.5 font-data text-[11px] font-semibold uppercase tracking-wide ${statusPillClass(session.status)}`}
        >
          {session.statusLabel}
        </span>
      </td>
      <td className="px-4 text-right">
        <div className="font-data text-sm text-[var(--admin-on-surface)]">
          {formatClock(session.scheduledAt ?? session.startedAt)}
        </div>
        <div className="text-xs text-[var(--admin-on-surface-variant)]">
          {session.status === "live" && session.startedAt
            ? `Started ${formatRelativeTime(session.startedAt, now)}`
            : (formatDuration(session.durationMinutes) ?? " ")}
        </div>
      </td>
      <td
        className={`px-4 text-right font-data text-sm ${
          session.accent === "low"
            ? "text-[var(--admin-warning)]"
            : "text-[var(--admin-on-surface)]"
        }`}
      >
        {formatInsightNumber(session.attendedCount)}
      </td>
      <td className="px-4 text-right font-data text-sm text-[var(--admin-on-surface-variant)]">
        {formatInsightNumber(session.registeredCount)} /{" "}
        {formatInsightNumber(session.rosteredCount)}
      </td>
      <td className="px-4 text-right">
        {session.attendanceRate == null ? (
          <div>
            <div className="font-data text-sm text-[var(--admin-on-surface-variant)]">-</div>
            <div className="text-[10px] text-[var(--admin-on-surface-variant)]">
              No roster recorded
            </div>
          </div>
        ) : (
          <div>
            <div className={`mb-1 font-data text-sm ${rateToneClass(tone)}`}>
              {session.attendanceRate}%
            </div>
            <div className="ml-auto h-[3px] w-16 overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
              <div
                className={`h-full ${rateBarClass(tone)}`}
                style={{
                  width: `${Math.min(100, Math.max(0, session.attendanceRate))}%`,
                }}
              />
            </div>
          </div>
        )}
      </td>
      <td className="px-4 text-right">
        <div className="mb-1 font-data text-sm text-[var(--admin-on-surface)]">
          {session.avgWatchMinutes != null ? formatInsightNumber(session.avgWatchMinutes) : "-"}
        </div>
        {session.avgWatchMinutes != null ? (
          <div className="ml-auto h-[3px] w-16 overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
            <div className="h-full bg-[var(--admin-outline)]" style={{ width: `${watchPct}%` }} />
          </div>
        ) : null}
      </td>
      <td className="px-2 text-center">
        <Link
          href={session.href}
          prefetch={false}
          className="inline-flex rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
          aria-label={`Open ${session.title}`}
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        </Link>
      </td>
    </tr>
  );
}

function TurnoutHistogram({ board }: { board: InsightLiveSessionsBoard }) {
  const { histogram, allHealthy } = board;
  const max = Math.max(1, histogram.maxCount);

  return (
    <section className={`${insightPanelClassName} p-6`}>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
            Turnout distribution
          </h3>
          <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
            Histogram of attendance rates across ended sessions with a roster.
          </p>
        </div>
        <div className="flex gap-6">
          <div className="text-right">
            <div className="text-xs text-[var(--admin-on-surface-variant)]">Median</div>
            <div className="font-data text-sm text-[var(--admin-on-surface)]">
              {histogram.median != null ? `${histogram.median}%` : "-"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-[var(--admin-on-surface-variant)]">Mean</div>
            <div className="font-data text-sm text-[var(--admin-on-surface)]">
              {histogram.mean != null ? `${histogram.mean}%` : "-"}
            </div>
          </div>
        </div>
      </div>

      {allHealthy ? (
        <div className="mb-4 flex items-center gap-2 rounded border border-[color-mix(in_srgb,var(--admin-success)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] p-2">
          <CheckCircle2 className="h-4 w-4 text-[var(--admin-success)]" aria-hidden="true" />
          <span className="text-xs text-[var(--admin-success)]">{histogram.caption}</span>
        </div>
      ) : null}

      <div className="relative flex h-48 w-full items-end gap-1 border-b border-[var(--admin-border)] pb-1">
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-[1] w-px border-l-2 border-dashed border-[var(--admin-outline)]">
          <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[var(--admin-surface)] px-1 text-[10px] text-[var(--admin-on-surface-variant)]">
            Low attendance threshold
          </span>
        </div>
        {histogram.buckets.map((bucket) => {
          const heightPct = Math.max(bucket.count > 0 ? 6 : 0, (bucket.count / max) * 100);
          return (
            <div
              key={bucket.id}
              title={`${bucket.label}: ${bucket.count}`}
              className={`flex-1 rounded-t transition-colors ${
                bucket.belowThreshold
                  ? "bg-[color-mix(in_srgb,var(--admin-warning)_80%,transparent)] hover:bg-[var(--admin-warning)]"
                  : "bg-[color-mix(in_srgb,var(--admin-primary)_80%,transparent)] hover:bg-[var(--admin-primary)]"
              }`}
              style={{ height: `${heightPct}%` }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-[var(--admin-on-surface-variant)]">
        <span>0%</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>100%</span>
      </div>
      {!allHealthy ? (
        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-[var(--admin-on-surface-variant)]">
          <span
            className="inline-block h-3 w-3 rounded-sm bg-[color-mix(in_srgb,var(--admin-warning)_80%,transparent)]"
            aria-hidden="true"
          />
          <span>{histogram.caption}</span>
        </p>
      ) : null}
    </section>
  );
}

export function LiveDashboardSessionsView({
  slug,
  sectionTitle,
  board,
  loading,
  error,
  query,
  onQueryChange,
  onRefresh,
}: LiveDashboardSessionsViewProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copyFlash, setCopyFlash] = useState(false);
  const [searchDraft, setSearchDraft] = useState(query.q);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    setSearchDraft(query.q);
  }, [query.q]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(new Date());
    }, 30_000);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (searchDraft !== query.q) {
        onQueryChange({ q: searchDraft, page: 1 });
      }
    }, 250);
    return () => {
      window.clearTimeout(handle);
    };
  }, [searchDraft, query.q, onQueryChange]);

  const showSkeleton = loading && !board;
  const pageSessions = board?.sessions ?? [];
  const allSelected =
    pageSessions.length > 0 && pageSessions.every((session) => selected.has(session.id));

  const pageButtons = useMemo(() => {
    if (!board) return [];
    const pages: number[] = [];
    const total = board.pageCount;
    const current = board.page;
    const pushUnique = (value: number) => {
      if (value >= 1 && value <= total && !pages.includes(value)) pages.push(value);
    };
    pushUnique(1);
    for (let i = current - 1; i <= current + 1; i += 1) pushUnique(i);
    pushUnique(total);
    return pages.sort((a, b) => a - b);
  }, [board]);

  const hasActiveFilters =
    query.view !== "all" ||
    query.q.trim() !== "" ||
    query.status !== "all" ||
    query.turnout !== "all" ||
    query.watch !== "all" ||
    query.sort !== "scheduled_desc";

  const resetFilters = () => {
    setSearchDraft("");
    onQueryChange({
      view: "all",
      q: "",
      status: "all",
      turnout: "all",
      watch: "all",
      sort: "scheduled_desc",
      page: 1,
    });
  };

  return (
    <div className={insightPageClassName}>
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
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
              href={adminInsightSessionsHref(slug)}
              prefetch={false}
              className="font-medium text-[var(--admin-on-surface)]"
            >
              Sessions
            </Link>
          </nav>
          <h1 className={insightPageTitleClassName}>Sessions</h1>
          <p className={insightPageDescClassName}>
            Every session in the window, with turnout and watch time.
          </p>
          <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
            {board?.caveat ?? "Per-session analytics and comparison live in Live Class Attendance."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={insightGhostButtonClassName}
            disabled={!board || board.sessions.length === 0}
            onClick={() => {
              if (!board) return;
              void copyText(sessionsCsv(board)).then((ok) => {
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
            disabled={!board || board.sessions.length === 0}
            onClick={() => {
              if (!board) return;
              downloadCsv(`live-sessions-${slug}.csv`, sessionsCsv(board));
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
            <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />
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

      {showSkeleton ? <LiveDashboardSessionsSkeleton /> : null}

      {error && !board ? (
        <section className="flex flex-col items-start justify-between gap-4 rounded border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-[var(--admin-danger)]" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-[var(--admin-danger)]">
                Could not load sessions ledger
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

          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            {board.windowLabel} · Generated {formatRelativeTime(board.generatedAt, now)}
            {" · "}
            <Link
              href={adminInsightNowHref(slug)}
              prefetch={false}
              className="text-[var(--admin-primary)] hover:underline"
            >
              Open Now board
            </Link>
          </p>

          {board.empty ? (
            <div
              className={`${insightPanelClassName} items-center justify-center px-8 py-16 text-center`}
            >
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                <CalendarX2
                  className="h-10 w-10 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
              </div>
              <h3 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
                No sessions in this window
              </h3>
              <p className="mb-8 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
                Adjust your filters or wait for live class activity to populate this ledger.
              </p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  className={insightGhostButtonClassName}
                  onClick={resetFilters}
                >
                  <RotateCcw className="h-[18px] w-[18px]" aria-hidden="true" />
                  Reset filters
                </button>
              ) : (
                <Link
                  href={board.sessionsHref}
                  prefetch={false}
                  className={insightGhostButtonClassName}
                >
                  Open Live Sessions
                </Link>
              )}
            </div>
          ) : (
            <>
              <SummaryBand
                board={board}
                onOpenLowTurnout={() => {
                  onQueryChange({ view: "low-turnout", page: 1, turnout: "below-50" });
                }}
              />

              <section className={insightPanelClassName}>
                <div className="flex flex-col gap-4 border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-low)_50%,transparent)] p-4">
                  <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--admin-border)] pb-1">
                    {VIEW_TABS.map((tab) => {
                      const active = query.view === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          className={
                            active
                              ? "-mb-[2px] border-b-2 border-[var(--admin-primary)] px-4 py-2 text-sm font-semibold text-[var(--admin-primary)]"
                              : "px-4 py-2 text-sm text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)]"
                          }
                          onClick={() => {
                            onQueryChange({
                              view: tab.id,
                              page: 1,
                              turnout: tab.id === "low-turnout" ? "below-50" : "all",
                            });
                          }}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative w-full max-w-xs shrink-0">
                      <Search
                        className="pointer-events-none absolute left-2.5 top-2.5 h-[18px] w-[18px] text-[var(--admin-on-surface-variant)]"
                        aria-hidden="true"
                      />
                      <input
                        value={searchDraft}
                        onChange={(event) => {
                          setSearchDraft(event.target.value);
                        }}
                        placeholder="Search session title"
                        className="w-full rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] py-1.5 pl-9 pr-3 text-sm text-[var(--admin-on-surface)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                      />
                    </div>
                    <FilterDropdown
                      label="Status"
                      value={query.status}
                      options={STATUS_OPTIONS}
                      onChange={(status) => {
                        onQueryChange({ status, page: 1 });
                      }}
                    />
                    <FilterDropdown
                      label="Turnout"
                      value={query.turnout}
                      options={TURNOUT_OPTIONS}
                      onChange={(turnout) => {
                        onQueryChange({ turnout, page: 1 });
                      }}
                    />
                    <FilterDropdown
                      label="Watch time"
                      value={query.watch}
                      options={WATCH_OPTIONS}
                      onChange={(watch) => {
                        onQueryChange({ watch, page: 1 });
                      }}
                    />
                    <div className="mx-1 hidden h-6 w-px bg-[var(--admin-border)] sm:block" />
                    <div className="ml-auto min-w-[12rem]">
                      <FilterDropdown
                        label="Sort"
                        value={query.sort}
                        options={SORT_OPTIONS}
                        onChange={(sort) => {
                          onQueryChange({ sort, page: 1 });
                        }}
                      />
                    </div>
                    {hasActiveFilters ? (
                      <button
                        type="button"
                        className="text-sm text-[var(--admin-primary)] hover:underline"
                        onClick={resetFilters}
                      >
                        Reset
                      </button>
                    ) : null}
                  </div>
                </div>

                {board.totalFiltered === 0 ? (
                  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                    <h3 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
                      No sessions match these filters
                    </h3>
                    <p className="mb-6 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
                      Adjust your filters or window to view historical session data.
                    </p>
                    <button
                      type="button"
                      className={insightGhostButtonClassName}
                      onClick={resetFilters}
                    >
                      <RotateCcw className="h-[18px] w-[18px]" aria-hidden="true" />
                      Reset filters
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1000px] border-collapse text-left whitespace-nowrap">
                        <thead className={insightTableHeadClassName}>
                          <tr>
                            <th className="w-11 border-r border-[var(--admin-border)] px-4 py-3">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                                checked={allSelected}
                                onChange={() => {
                                  setSelected((prev) => {
                                    const next = new Set(prev);
                                    if (allSelected) {
                                      for (const session of pageSessions) next.delete(session.id);
                                    } else {
                                      for (const session of pageSessions) next.add(session.id);
                                    }
                                    return next;
                                  });
                                }}
                                aria-label="Select all on page"
                              />
                            </th>
                            <th className="px-4 py-3">Session</th>
                            <th className="w-28 px-4 py-3">Status</th>
                            <th className="w-40 px-4 py-3 text-right">
                              <span className="inline-flex items-center gap-1">
                                Scheduled
                                {query.sort.startsWith("scheduled") ? (
                                  <ArrowDown className="h-3 w-3" aria-hidden="true" />
                                ) : null}
                              </span>
                            </th>
                            <th className="w-24 px-4 py-3 text-right">Attended</th>
                            <th className="w-32 px-4 py-3 text-right">Registered/Rostered</th>
                            <th className="w-32 px-4 py-3 text-right">Rate %</th>
                            <th className="w-32 px-4 py-3 text-right">Avg min</th>
                            <th className="w-11 px-2 py-3" />
                          </tr>
                        </thead>
                        <tbody>
                          {pageSessions.map((session) => (
                            <SessionRow
                              key={session.id}
                              session={session}
                              selected={selected.has(session.id)}
                              now={now}
                              onToggle={() => {
                                setSelected((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(session.id)) next.delete(session.id);
                                  else next.add(session.id);
                                  return next;
                                });
                              }}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 text-xs text-[var(--admin-on-surface-variant)]">
                      <div>
                        Showing {(board.page - 1) * board.pageSize + 1}-
                        {Math.min(board.page * board.pageSize, board.totalFiltered)} of{" "}
                        {formatInsightNumber(board.totalFiltered)} sessions
                        {selected.size > 0 ? ` · ${selected.size} selected` : ""}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded hover:bg-[var(--admin-surface-high)] disabled:opacity-50"
                          disabled={board.page <= 1}
                          onClick={() => {
                            onQueryChange({ page: board.page - 1 });
                          }}
                          aria-label="Previous page"
                        >
                          <ChevronLeft className="h-[18px] w-[18px]" aria-hidden="true" />
                        </button>
                        {pageButtons.map((page, index) => {
                          const prev = pageButtons[index - 1];
                          const gap = prev != null && page - prev > 1;
                          return (
                            <span key={page} className="inline-flex items-center gap-1">
                              {gap ? <span className="px-1">...</span> : null}
                              <button
                                type="button"
                                className={
                                  page === board.page
                                    ? "flex h-7 w-7 items-center justify-center rounded bg-[var(--admin-surface-high)] font-semibold text-[var(--admin-on-surface)]"
                                    : "flex h-7 w-7 items-center justify-center rounded hover:bg-[var(--admin-surface-high)]"
                                }
                                onClick={() => {
                                  onQueryChange({ page });
                                }}
                              >
                                {page}
                              </button>
                            </span>
                          );
                        })}
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded hover:bg-[var(--admin-surface-high)] disabled:opacity-50"
                          disabled={board.page >= board.pageCount}
                          onClick={() => {
                            onQueryChange({ page: board.page + 1 });
                          }}
                          aria-label="Next page"
                        >
                          <ChevronRight className="h-[18px] w-[18px]" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </section>

              <TurnoutHistogram board={board} />
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
