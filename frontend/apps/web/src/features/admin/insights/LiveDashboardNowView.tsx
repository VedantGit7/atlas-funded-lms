"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronRight,
  Info,
  Moon,
  MoreHorizontal,
  PlayCircle,
  Presentation,
  RefreshCw,
  Users,
  X,
} from "lucide-react";
import {
  ADMIN_INSIGHTS_HREF,
  adminInsightHref,
  adminInsightNowHref,
} from "./admin-insights-catalog";
import type { InsightLiveNowBoard, InsightLiveNowSession } from "./admin-insights-api";
import { formatInsightNumber, formatRelativeTime } from "./admin-insights-format";
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

type LiveDashboardNowViewProps = {
  slug: string;
  sectionTitle: string;
  board: InsightLiveNowBoard | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

function Shimmer({ className }: { className: string }) {
  return <div className={`${insightShimmerClassName} ${className}`} />;
}

function formatClock(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatRunningLabel(startedAt: string | null, now: Date): string {
  if (!startedAt) return "In progress";
  const start = new Date(startedAt);
  if (Number.isNaN(start.getTime())) return "In progress";
  const minutes = Math.max(0, Math.round((now.getTime() - start.getTime()) / 60000));
  const clock = formatClock(startedAt);
  if (minutes < 60) return `Started ${clock} · running ${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return `Started ${clock} · running ${hours}h ${rem}m`;
}

function formatStartsIn(
  scheduledAt: string | null,
  now: Date,
): {
  label: string;
  urgent: boolean;
} {
  if (!scheduledAt) return { label: "Unscheduled", urgent: false };
  const start = new Date(scheduledAt);
  if (Number.isNaN(start.getTime())) return { label: "Unscheduled", urgent: false };
  const minutes = Math.round((start.getTime() - now.getTime()) / 60000);
  if (minutes <= 0) return { label: "starting now", urgent: true };
  if (minutes < 60) return { label: `in ${minutes}m`, urgent: minutes <= 30 };
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return {
    label: rem > 0 ? `in ${hours}h ${rem}m` : `in ${hours}h`,
    urgent: false,
  };
}

function rateToneClass(tone: ReturnType<typeof liveAttendanceRateTone>): string {
  if (tone === "success") return "text-[var(--admin-success)]";
  if (tone === "warning") return "text-[var(--admin-warning)]";
  if (tone === "danger") return "text-[var(--admin-danger)]";
  return "text-[var(--admin-on-surface-variant)]";
}

function rateBarClass(tone: ReturnType<typeof liveAttendanceRateTone>): string {
  if (tone === "success") return "bg-[var(--admin-success)]";
  if (tone === "warning") return "bg-[var(--admin-warning)]";
  if (tone === "danger") return "bg-[var(--admin-danger)]";
  return "bg-[var(--admin-primary)]";
}

function LiveDashboardNowSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading Now board">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="flex flex-col gap-2">
          <Shimmer className="h-4 w-48" />
          <Shimmer className="h-8 w-28" />
          <Shimmer className="h-4 w-72" />
        </div>
        <div className="flex flex-wrap gap-3">
          <Shimmer className="h-11 w-32" />
          <Shimmer className="h-11 w-48" />
          <Shimmer className="h-11 w-28" />
        </div>
      </div>
      <Shimmer className="h-12 w-full rounded-r" />
      <div className="flex flex-col gap-4">
        <Shimmer className="h-5 w-28" />
        <div className={`${insightPanelClassName} p-6`}>
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-col gap-2">
              <Shimmer className="h-5 w-64" />
              <Shimmer className="h-4 w-40" />
            </div>
            <div className="flex w-full max-w-sm flex-col gap-2">
              <Shimmer className="h-8 w-36 ml-auto" />
              <Shimmer className="h-1.5 w-full rounded-full" />
            </div>
            <Shimmer className="h-11 w-24" />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex flex-[7] flex-col gap-4">
          <Shimmer className="h-5 w-24" />
          <div className={insightPanelClassName}>
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] px-4 last:border-b-0"
              >
                <Shimmer className="h-4 w-40 flex-1" />
                <Shimmer className="h-4 w-12" />
                <Shimmer className="h-4 w-16" />
                <Shimmer className="h-4 w-10" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-[3] flex-col gap-4">
          <Shimmer className="h-5 w-28" />
          <div className={`${insightPanelClassName} p-4`}>
            <div className="flex flex-col gap-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex flex-1 flex-col gap-2">
                    <Shimmer className="h-4 w-3/4" />
                    <Shimmer className="h-3 w-1/2 opacity-70" />
                  </div>
                  <Shimmer className="h-4 w-10" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LiveSessionCard({ session, now }: { session: InsightLiveNowSession; now: Date }) {
  const rate =
    session.rosteredCount > 0
      ? Math.round((session.attendedCount / session.rosteredCount) * 100)
      : session.attendanceRate;
  const tone = liveAttendanceRateTone(rate);

  return (
    <article className="flex flex-col items-start justify-between gap-6 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-sm transition-shadow duration-200 hover:shadow-md md:flex-row md:items-center">
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
            {session.title}
          </h3>
          <span className="inline-flex items-center gap-1.5 rounded border border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] px-2 py-0.5 font-data text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-success)]">
            <span
              className="h-1.5 w-1.5 rounded-full bg-[var(--admin-success)] motion-safe:animate-pulse"
              aria-hidden="true"
            />
            Live
          </span>
        </div>
        <p className="font-data text-sm text-[var(--admin-on-surface-variant)]">
          {formatRunningLabel(session.startedAt, now)}
        </p>
      </div>
      <div className="w-full max-w-sm flex-1">
        <div className="mb-1 flex items-end justify-between gap-3">
          <span className="text-xs text-[var(--admin-on-surface-variant)]">Attendance</span>
          <div className="flex items-baseline gap-2">
            <span className="font-data text-[32px] font-semibold leading-9 tracking-tight text-[var(--admin-on-surface)]">
              {formatInsightNumber(session.attendedCount)} /{" "}
              {formatInsightNumber(session.rosteredCount)}
            </span>
            <span className={`font-data text-xs ${rateToneClass(tone)}`}>{rate}%</span>
          </div>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
          <div
            className={`h-1.5 rounded-full ${rateBarClass(tone)}`}
            style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 md:ml-4">
        <Link href={session.watchHref} prefetch={false} className={insightPrimaryButtonClassName}>
          <PlayCircle className="h-[18px] w-[18px]" aria-hidden="true" />
          Watch
        </Link>
        <Link
          href={session.href}
          prefetch={false}
          className="inline-flex h-11 w-11 items-center justify-center rounded text-[var(--admin-on-surface-variant)] outline-none transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
          aria-label={`Open ${session.title}`}
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function PresentMode({
  board,
  sectionTitle,
  now,
  onExit,
}: {
  board: InsightLiveNowBoard;
  sectionTitle: string;
  now: Date;
  onExit: () => void;
}) {
  const live = board.liveSessions[0] ?? null;
  const upcoming = board.nextUpGroups.flatMap((group) => group.sessions).slice(0, 3);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onExit]);

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col overflow-hidden bg-[var(--admin-bg)] p-8 text-[var(--admin-on-surface)]"
      role="dialog"
      aria-modal="true"
      aria-label="Present mode"
    >
      <div className="mb-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {live ? (
            <>
              <span
                className="h-4 w-4 rounded-full bg-[var(--admin-danger)] motion-safe:animate-pulse"
                aria-hidden="true"
              />
              <span className="text-2xl font-semibold uppercase tracking-[0.12em] text-[var(--admin-danger)]">
                Live
              </span>
            </>
          ) : (
            <span className="text-2xl font-semibold text-[var(--admin-on-surface-variant)]">
              All quiet
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-2xl font-semibold text-[var(--admin-on-surface-variant)]">
            {sectionTitle} · Admin Console
          </span>
          <button type="button" className={insightGhostButtonClassName} onClick={onExit}>
            <X className="h-4 w-4" aria-hidden="true" />
            Exit
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-8">
        <section className="flex w-7/12 flex-col justify-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-12 shadow-sm lg:p-16">
          {live ? (
            <>
              <div className="mb-4">
                <span className="inline-flex items-center gap-2 rounded border border-[var(--admin-primary)] bg-[var(--admin-primary-container)] px-3 py-1 font-data text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-primary)]">
                  In progress
                </span>
              </div>
              <h1 className="mb-12 text-[40px] font-semibold leading-[48px] tracking-[-0.02em] text-[var(--admin-on-surface)]">
                {live.title}
              </h1>
              <div className="mt-auto border-t border-[var(--admin-border)] pt-12">
                <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                  Current attendance
                </p>
                <div className="flex flex-wrap items-baseline gap-6">
                  <span className="font-data text-[64px] font-semibold leading-[72px] text-[var(--admin-primary)]">
                    {formatInsightNumber(live.attendedCount)}
                  </span>
                  <span className="font-data text-sm text-[var(--admin-on-surface-variant)]">
                    of {formatInsightNumber(live.rosteredCount)} rostered
                    {live.rosteredCount > 0
                      ? ` · ${Math.round((live.attendedCount / live.rosteredCount) * 100)}%`
                      : ""}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-start gap-4">
              <Moon
                className="h-10 w-10 text-[var(--admin-on-surface-variant)] opacity-50"
                aria-hidden="true"
              />
              <h1 className="text-[40px] font-semibold leading-[48px] tracking-[-0.02em]">
                Nothing running right now
              </h1>
              {board.nextSession ? (
                <p className="text-lg text-[var(--admin-on-surface-variant)]">
                  Next: {board.nextSession.title}
                  {board.nextSession.scheduledAt
                    ? ` · ${formatClock(board.nextSession.scheduledAt)}`
                    : ""}
                </p>
              ) : null}
            </div>
          )}
        </section>

        <section className="flex w-5/12 flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 shadow-sm lg:p-12">
          <h2 className="mb-8 flex items-center gap-3 text-base font-semibold text-[var(--admin-on-surface-variant)]">
            Next up
          </h2>
          {upcoming.length === 0 ? (
            <p className="text-lg text-[var(--admin-on-surface-variant)]">
              No sessions scheduled in the next 24 hours.
            </p>
          ) : (
            <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
              {upcoming.map((session, index) => {
                const starts = formatStartsIn(session.scheduledAt, now);
                return (
                  <div
                    key={session.id}
                    className="flex items-center justify-between gap-4 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-6"
                    style={{ opacity: Math.max(0.55, 1 - index * 0.15) }}
                  >
                    <div className="min-w-0">
                      <p className="mb-2 truncate text-2xl font-semibold leading-8 text-[var(--admin-on-surface)]">
                        {session.title}
                      </p>
                      {session.batchLabel ? (
                        <p className="text-xs text-[var(--admin-on-surface-variant)]">
                          {session.batchLabel}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="block font-data text-xl leading-7 text-[var(--admin-on-surface)]">
                        {formatClock(session.scheduledAt)}
                      </span>
                      {index === 0 && starts.urgent ? (
                        <span className="mt-2 inline-block rounded border border-[color-mix(in_srgb,var(--admin-warning)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] px-2 py-1 font-data text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-warning)]">
                          Starts {starts.label}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <p className="pointer-events-none absolute bottom-8 right-8 font-data text-sm text-[var(--admin-on-surface-variant)]">
        Generated {formatClock(board.generatedAt)} · {formatRelativeTime(board.generatedAt, now)}
      </p>
    </div>
  );
}

export function LiveDashboardNowView({
  slug,
  sectionTitle,
  board,
  loading,
  error,
  onRefresh,
}: LiveDashboardNowViewProps) {
  const [presentMode, setPresentMode] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(new Date());
    }, 30_000);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  const showSkeleton = loading && !board;
  const quiet = Boolean(board?.quiet);
  const nextFlat = useMemo(
    () => board?.nextUpGroups.flatMap((group) => group.sessions) ?? [],
    [board],
  );

  return (
    <div className={insightPageClassName}>
      {presentMode && board ? (
        <PresentMode
          board={board}
          sectionTitle={sectionTitle}
          now={now}
          onExit={() => {
            setPresentMode(false);
          }}
        />
      ) : null}

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
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <Link
              href={adminInsightHref(slug)}
              prefetch={false}
              className="hover:text-[var(--admin-on-surface)]"
            >
              {sectionTitle}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <Link
              href={adminInsightNowHref(slug)}
              prefetch={false}
              className="font-medium text-[var(--admin-on-surface)]"
            >
              Now
            </Link>
          </nav>
          <h1 className={insightPageTitleClassName}>Now</h1>
          <p className={insightPageDescClassName}>Sessions running right now and scheduled next.</p>
        </div>
        <div className="flex flex-col items-stretch gap-3 md:items-end">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              className={insightGhostButtonClassName}
              disabled={!board}
              onClick={() => {
                setPresentMode(true);
              }}
            >
              <Presentation className="h-[18px] w-[18px]" aria-hidden="true" />
              Present mode
            </button>
            <Link
              href={board?.attendanceHref ?? LIVE_ATTENDANCE_REPORT_HREF}
              prefetch={false}
              className={insightGhostButtonClassName}
            >
              <Users className="h-[18px] w-[18px]" aria-hidden="true" />
              Open Live Class Attendance
            </Link>
            <button
              type="button"
              className={insightPrimaryButtonClassName}
              disabled={loading}
              onClick={onRefresh}
            >
              <RefreshCw
                className={`h-[18px] w-[18px] ${loading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              Refresh
            </button>
          </div>
          {board ? (
            <p className="font-data text-sm text-[var(--admin-on-surface-variant)] md:text-right">
              Generated {formatClock(board.generatedAt)} ·{" "}
              {formatRelativeTime(board.generatedAt, now)}
            </p>
          ) : null}
        </div>
      </header>

      {showSkeleton ? <LiveDashboardNowSkeleton /> : null}

      {error && !board ? (
        <section className="flex flex-col items-start justify-between gap-4 rounded border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
            <div>
              <h3 className="text-sm font-semibold text-[var(--admin-danger)]">
                Could not load Now board
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
          <div className="flex items-start gap-3 rounded-r border border-[var(--admin-border)] border-l-4 border-l-[var(--admin-on-surface-variant)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
            <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p>{board.caveat}</p>
          </div>

          {error ? (
            <p className="rounded border border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] px-4 py-2 text-sm text-[var(--admin-warning)]">
              Refresh failed: {error}. Showing last successful snapshot.
            </p>
          ) : null}

          <section className="flex flex-col gap-4">
            <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">Live region</h2>
            {quiet ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-8 py-12 text-center">
                <Moon
                  className="mb-4 h-10 w-10 text-[var(--admin-on-surface-variant)] opacity-50"
                  aria-hidden="true"
                />
                <h3 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
                  Nothing running right now
                </h3>
                {board.nextSession ? (
                  <p className="text-sm text-[var(--admin-on-surface-variant)]">
                    Next session: {board.nextSession.title}
                    {board.nextSession.scheduledAt
                      ? ` starts ${formatClock(board.nextSession.scheduledAt)} (${formatRelativeTime(board.nextSession.scheduledAt, now)})`
                      : ""}
                  </p>
                ) : (
                  <p className="text-sm text-[var(--admin-on-surface-variant)]">
                    No upcoming scheduled sessions found.
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {board.liveSessions.map((session) => (
                  <LiveSessionCard key={session.id} session={session} now={now} />
                ))}
              </div>
            )}
          </section>

          <div className="flex flex-col gap-6 lg:flex-row">
            <section className="flex flex-[7] flex-col gap-4">
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">Next up</h2>
              <div className={insightPanelClassName}>
                {nextFlat.length === 0 ? (
                  <p className="px-6 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]">
                    No sessions scheduled in the next 24 hours.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <thead className={insightTableHeadClassName}>
                        <tr>
                          <th className="h-11 px-4">Session</th>
                          <th className="h-11 px-4 text-right">Starts</th>
                          <th className="h-11 px-4 text-right">Registered / Rostered</th>
                          <th className="h-11 px-4 text-right">Expected</th>
                          <th className="h-11 w-12 px-4" />
                        </tr>
                      </thead>
                      <tbody>
                        {board.nextUpGroups.map((group) => (
                          <Fragment key={group.id}>
                            <tr className="border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-high)_50%,transparent)]">
                              <td
                                className="h-8 px-4 text-xs font-semibold uppercase tracking-wider text-[var(--admin-on-surface)]"
                                colSpan={5}
                              >
                                {group.label}
                              </td>
                            </tr>
                            {group.sessions.map((session) => {
                              const starts = formatStartsIn(session.scheduledAt, now);
                              return (
                                <tr
                                  key={session.id}
                                  className={`group ${insightTableRowClassName}`}
                                >
                                  <td className="h-11 px-4">
                                    <div className="flex items-center gap-2">
                                      <Link
                                        href={session.href}
                                        prefetch={false}
                                        className="text-sm font-medium text-[var(--admin-primary)] hover:underline"
                                      >
                                        {session.title}
                                      </Link>
                                      {session.batchLabel ? (
                                        <span className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-1.5 py-0.5 font-data text-[11px] text-[var(--admin-on-surface-variant)]">
                                          {session.batchLabel}
                                        </span>
                                      ) : null}
                                    </div>
                                  </td>
                                  <td className="h-11 px-4 text-right">
                                    <div className="font-data text-sm text-[var(--admin-on-surface)]">
                                      {formatClock(session.scheduledAt)}
                                    </div>
                                    <div
                                      className={`text-xs ${
                                        starts.urgent
                                          ? "text-[var(--admin-warning)]"
                                          : "text-[var(--admin-on-surface-variant)]"
                                      }`}
                                    >
                                      {starts.label}
                                    </div>
                                  </td>
                                  <td className="h-11 px-4 text-right">
                                    <div className="font-data text-sm text-[var(--admin-on-surface)]">
                                      {formatInsightNumber(session.registeredCount)} /{" "}
                                      {formatInsightNumber(session.rosteredCount)}
                                    </div>
                                    {session.fillRate != null ? (
                                      <div className="ml-auto mt-1 h-[3px] max-w-[80px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                                        <div
                                          className="h-[3px] bg-[var(--admin-primary)]"
                                          style={{
                                            width: `${Math.min(100, Math.max(0, session.fillRate))}%`,
                                          }}
                                        />
                                      </div>
                                    ) : null}
                                  </td>
                                  <td className="h-11 px-4 text-right font-data text-sm text-[var(--admin-on-surface-variant)]">
                                    {session.expectedAttended != null
                                      ? `~${formatInsightNumber(session.expectedAttended)}`
                                      : "-"}
                                  </td>
                                  <td className="h-11 px-4 text-right">
                                    <Link
                                      href={session.href}
                                      prefetch={false}
                                      className="inline-flex text-[var(--admin-on-surface-variant)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--admin-on-surface)]"
                                      aria-label={`Open ${session.title}`}
                                    >
                                      <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                                    </Link>
                                  </td>
                                </tr>
                              );
                            })}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>

            <section className="flex flex-[3] flex-col gap-4">
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                Ended today
              </h2>
              <div className={`${insightPanelClassName} relative`}>
                {board.endedToday.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]">
                    No sessions ended today yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <thead className={insightTableHeadClassName}>
                        <tr>
                          <th className="h-11 px-4">Session</th>
                          <th className="h-11 px-4 text-right">Ended</th>
                          <th className="h-11 px-4 text-right">Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {board.endedToday.map((session) => {
                          const tone = liveAttendanceRateTone(session.attendanceRate);
                          const low = tone === "warning" || tone === "danger";
                          return (
                            <tr
                              key={session.id}
                              className={`${insightTableRowClassName} ${
                                low ? "border-l-2 border-l-[var(--admin-warning)]" : ""
                              }`}
                            >
                              <td className="h-11 max-w-[140px] truncate px-4 text-sm text-[var(--admin-on-surface)]">
                                <Link
                                  href={session.href}
                                  prefetch={false}
                                  className="hover:text-[var(--admin-primary)] hover:underline"
                                >
                                  {session.title}
                                </Link>
                              </td>
                              <td className="h-11 px-4 text-right font-data text-sm text-[var(--admin-on-surface-variant)]">
                                {formatClock(session.endedAt ?? session.startedAt)}
                              </td>
                              <td className="h-11 px-4 text-right">
                                <div className="flex flex-col items-end gap-1">
                                  <span className={`font-data text-xs ${rateToneClass(tone)}`}>
                                    {session.attendanceRate}%
                                  </span>
                                  <div className="h-[3px] w-12 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                                    <div
                                      className={`h-[3px] ${rateBarClass(tone)}`}
                                      style={{
                                        width: `${Math.min(100, Math.max(0, session.attendanceRate))}%`,
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
                )}
                {board.endedTodayTotal > board.endedToday.length ? (
                  <div className="border-t border-[var(--admin-border)] p-3 text-center">
                    <Link
                      href={board.sessionsHref}
                      prefetch={false}
                      className="text-sm text-[var(--admin-primary)] hover:underline"
                    >
                      View all {board.endedTodayTotal} ended sessions
                    </Link>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
