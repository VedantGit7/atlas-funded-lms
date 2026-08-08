"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  Mail,
  MoreVertical,
  Video,
} from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  exportPollReport,
  fetchLiveSessionPollReport,
  type LiveSessionMatrixCellKind,
  type LiveSessionPollReport,
} from "./admin-polls-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-sm bg-[var(--admin-surface-high)]",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.8s_infinite]",
        "after:bg-gradient-to-r after:from-transparent after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] after:to-transparent",
        className ?? "",
      ].join(" ")}
    />
  );
}

function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${Number(value).toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds) || seconds <= 0) return "-";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}

function formatSessionWhen(
  iso: string | null,
  timezoneLabel: string | null,
): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  const formatted = date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return timezoneLabel ? `${formatted} ${timezoneLabel}` : formatted;
}

function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatOffsetLabel(offsetSeconds: number): string {
  const total = Math.max(0, Math.round(offsetSeconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function learnerInitials(name: string | null, email: string | null): string {
  const source = (name?.trim() || email?.trim() || "?").replace(/\s+/g, " ");
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function matrixCellClass(kind: LiveSessionMatrixCellKind): string {
  switch (kind) {
    case "answered":
      return "bg-[var(--admin-primary)]";
    case "missed":
      return "border border-[var(--admin-outline)] bg-transparent";
    case "correct":
      return "bg-[var(--admin-success)]";
    case "incorrect":
      return "bg-[var(--admin-danger)]";
    case "anonymous":
      return "bg-[var(--admin-surface-low)]";
    default:
      return "border border-[var(--admin-outline)]";
  }
}

function matrixLabel(kind: LiveSessionMatrixCellKind): string {
  const map: Record<LiveSessionMatrixCellKind, string> = {
    answered: "Answered",
    missed: "Missed",
    correct: "Correct",
    incorrect: "Incorrect",
    anonymous: "Anonymous",
  };
  return map[kind];
}

function completionBarColor(answered: number, total: number): string {
  if (total <= 0) return "bg-[var(--admin-outline)]";
  const pct = answered / total;
  if (pct >= 1) return "bg-[var(--admin-success)]";
  if (pct >= 0.5) return "bg-[var(--admin-warning)]";
  return "bg-[var(--admin-danger)]";
}

function SessionTimeline({
  data,
  onSelectPoll,
}: {
  data: LiveSessionPollReport;
  onSelectPoll: (pollId: string) => void;
}) {
  const duration = Math.max(1, data.timeline.durationSeconds);
  const attendance = data.timeline.attendance.points;
  const maxConcurrent = Math.max(1, ...attendance.map((p) => p.concurrent), 1);

  const areaPath = useMemo(() => {
    if (attendance.length === 0) return "";
    const coords = attendance.map((point) => {
      const x = (point.offsetSeconds / duration) * 100;
      const y = 100 - (point.concurrent / maxConcurrent) * 80;
      return `${x},${y}`;
    });
    return `0,100 ${coords.join(" ")} 100,100`;
  }, [attendance, duration, maxConcurrent]);

  const tickCount = 5;
  const ticks = Array.from({ length: tickCount }, (_, i) =>
    Math.round((duration * i) / (tickCount - 1)),
  );

  return (
    <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
          Session timeline
        </h2>
        {data.timeline.insight ? (
          <p className="max-w-xl text-xs text-[var(--admin-on-surface-variant)]">
            {data.timeline.insight}
          </p>
        ) : null}
      </div>
      <div className="relative h-24 border-b border-[var(--admin-border)]">
        {areaPath ? (
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polygon
              points={areaPath}
              fill="color-mix(in srgb, var(--admin-primary) 18%, transparent)"
            />
          </svg>
        ) : null}
        {data.timeline.polls.map((band) => {
          const left = (band.offsetStartSeconds / duration) * 100;
          const width = Math.max(
            1.5,
            ((band.offsetEndSeconds - band.offsetStartSeconds) / duration) * 100,
          );
          return (
            <button
              key={band.pollId}
              type="button"
              title={band.title}
              onClick={() => onSelectPoll(band.pollId)}
              className="absolute inset-y-0 border-x border-[color-mix(in_srgb,var(--admin-primary)_25%,transparent)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)] pt-1 transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_22%,transparent)]"
              style={{ left: `${left}%`, width: `${width}%` }}
            >
              <span className="block truncate px-0.5 text-center font-mono text-[10px] text-[var(--admin-primary-strong)]">
                {formatPct(band.participationPct)}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex justify-between pt-2 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
        {ticks.map((tick) => (
          <span key={tick}>{formatOffsetLabel(tick)}</span>
        ))}
      </div>
    </section>
  );
}

function PollBlockMenu({
  pollId,
  anonymous,
}: {
  pollId: string;
  anonymous: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
        aria-expanded={open}
        aria-label="Poll actions"
        onClick={() => setOpen((value) => !value)}
      >
        <MoreVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+4px)] z-30 min-w-[200px] rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 shadow-lg">
          <Link
            href={`/admin/reports/polls/${pollId}`}
            className="block px-3 py-2 text-sm text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
            onClick={() => setOpen(false)}
          >
            Open report
          </Link>
          {!anonymous ? (
            <>
              <Link
                href={`/admin/reports/polls/${pollId}`}
                className="block px-3 py-2 text-sm text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                onClick={() => setOpen(false)}
              >
                View respondents
              </Link>
              <Link
                href={`/admin/reports/polls/${pollId}/non-respondents`}
                className="block px-3 py-2 text-sm text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                onClick={() => setOpen(false)}
              >
                View non-respondents
              </Link>
            </>
          ) : null}
          <Link
            href={`/admin/reports/polls/${pollId}/live`}
            className="block px-3 py-2 text-sm text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
            onClick={() => setOpen(false)}
          >
            Open monitor
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <Shimmer className="h-3 w-80" />
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
        <div className="space-y-2">
          <Shimmer className="h-8 w-72 max-w-full" />
          <Shimmer className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Shimmer className="h-9 w-24" />
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-48" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <Shimmer className="h-28 md:col-span-3" />
        <Shimmer className="h-28 md:col-span-3" />
        <Shimmer className="h-28 md:col-span-6" />
      </div>
      <Shimmer className="h-40 w-full" />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-8">
          <Shimmer className="h-48" />
          <Shimmer className="h-48" />
        </div>
        <Shimmer className="h-56 lg:col-span-4" />
      </div>
      <Shimmer className="h-72 w-full" />
    </div>
  );
}

export function AdminLiveSessionPollReportPage({
  liveSessionId,
}: {
  liveSessionId: string;
}) {
  const [data, setData] = useState<LiveSessionPollReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [messageHint, setMessageHint] = useState<string | null>(null);
  const pollRefs = useRef<Record<string, HTMLElement | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchLiveSessionPollReport(liveSessionId);
      setData(response.data);
    } catch (err) {
      setData(null);
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't load session analytics.",
      );
    } finally {
      setLoading(false);
    }
  }, [liveSessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const scrollToPoll = (pollId: string) => {
    pollRefs.current[pollId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleExport = async () => {
    if (!data?.polls.length) return;
    setBusy(true);
    setError(null);
    try {
      // Export the least-answered / first poll as a starting CSV; full session export is not wired yet.
      const pollId = data.summary.leastAnswered?.pollId ?? data.polls[0]!.pollId;
      const queued = await exportPollReport({ pollId, emailDownloadLink: false });
      const completed = await pollReportRunUntilComplete(queued.data.runId);
      if (completed.status === "failed") {
        throw new Error(completed.errorMessage ?? "Export failed.");
      }
      if (completed.status === "completed") {
        await downloadReportExport(completed.id, "csv");
      }
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to export.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
        <LoadingSkeleton />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
        <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="flex flex-col gap-3 border-b border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 text-[var(--admin-danger)]">
              <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
              <p className="text-base font-semibold">Couldn't load session analytics.</p>
            </div>
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={() => void load()}
            >
              Retry
            </button>
          </div>
          <div className="grid grid-cols-12 gap-8 p-6">
            <Shimmer className="col-span-12 h-64 lg:col-span-8" />
            <Shimmer className="col-span-12 h-64 lg:col-span-4" />
            <Shimmer className="col-span-12 h-40" />
          </div>
        </div>
        <p className="text-sm text-[var(--admin-danger)]">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const whenIso = data.session.startedAt ?? data.session.scheduledAt;
  const openSessionHref = data.session.batchId
    ? `/admin/reports/batches/${data.session.batchId}/live-sessions/${liveSessionId}`
    : `/admin/reports/live-class-attendance`;

  if (data.polls.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
        <nav
          className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]"
          aria-label="Breadcrumb"
        >
          <Link href="/admin" className="hover:text-[var(--admin-primary)]">
            Admin
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link href="/admin/reports" className="hover:text-[var(--admin-primary)]">
            Reports
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link href="/admin/reports/polls" className="hover:text-[var(--admin-primary)]">
            Polls
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link
            href="/admin/reports/polls/live-sessions"
            className="font-medium text-[var(--admin-on-surface)] hover:text-[var(--admin-primary)]"
          >
            Live sessions
          </Link>
        </nav>

        <div className="flex flex-1 items-center justify-center py-16">
          <div className="flex w-full max-w-md flex-col items-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-8 py-16 text-center">
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
              <Calendar
                className="h-12 w-12 text-[var(--admin-on-surface-variant)]"
                strokeWidth={1.25}
                aria-hidden="true"
              />
            </div>
            <h1 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
              No polls were run in this session
            </h1>
            <p className="mb-8 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
              Polls must be launched during the live event to appear here.
            </p>
            <Link href={openSessionHref} className={secondaryButtonClassName}>
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open session
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
      <nav
        className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]"
        aria-label="Breadcrumb"
      >
        <Link href="/admin" className="hover:text-[var(--admin-primary)]">
          Admin
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href="/admin/reports" className="hover:text-[var(--admin-primary)]">
          Reports
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href="/admin/reports/polls" className="hover:text-[var(--admin-primary)]">
          Polls
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link
          href="/admin/reports/polls/live-sessions"
          className="hover:text-[var(--admin-primary)]"
        >
          Live sessions
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium text-[var(--admin-on-surface)]">
          {data.session.title}
        </span>
      </nav>

      {error ? (
        <div
          className="flex items-start gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-3"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-danger)]" />
          <p className="text-sm text-[var(--admin-danger)]">{error}</p>
        </div>
      ) : null}

      {messageHint ? (
        <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
          {messageHint}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <Link href="/admin/reports/polls" className={`${ghostButtonClassName} mb-3 inline-flex`}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All polls
          </Link>
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
            {data.session.title}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
            <span>{formatSessionWhen(whenIso, data.session.timezoneLabel)}</span>
            <span className="h-1 w-1 rounded-full bg-[var(--admin-outline)]" />
            <span>{formatDuration(data.session.durationSeconds)}</span>
            <span className="h-1 w-1 rounded-full bg-[var(--admin-outline)]" />
            <span>{data.session.attendanceCount.toLocaleString()} attendees</span>
            {data.session.hostLabel ? (
              <>
                <span className="h-1 w-1 rounded-full bg-[var(--admin-outline)]" />
                <span>hosted by {data.session.hostLabel}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={busy}
            onClick={() => void handleExport()}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {busy ? "Exporting..." : "Export CSV"}
          </button>
          <Link href={openSessionHref} className={secondaryButtonClassName}>
            Open session
          </Link>
          <button
            type="button"
            className={primaryButtonClassName}
            onClick={() =>
              setMessageHint(
                "Messaging low-engagement attendees is not available yet from this report.",
              )
            }
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            Message low-engagement attendees
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <div className="flex flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 md:col-span-3">
          <div>
            <span className="mb-1 block text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Polls run
            </span>
            <div className="font-mono text-[32px] leading-tight text-[var(--admin-on-surface)]">
              {data.summary.pollsRun}
            </div>
          </div>
          <p className="mt-3 text-xs text-[var(--admin-on-surface-variant)]">
            {data.summary.opinionCount} opinion · {data.summary.quizCount} quiz
          </p>
        </div>
        <div className="flex flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 md:col-span-3">
          <div>
            <span className="mb-1 block text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Average participation
            </span>
            <div className="font-mono text-[32px] leading-tight text-[var(--admin-on-surface)]">
              {formatPct(data.summary.avgParticipationPct)}
            </div>
          </div>
          {data.summary.avgParticipationPct != null ? (
            <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
              <div
                className="h-full bg-[var(--admin-primary)]"
                style={{
                  width: `${Math.max(0, Math.min(100, data.summary.avgParticipationPct))}%`,
                }}
              />
            </div>
          ) : (
            <p className="mt-3 text-xs text-[var(--admin-on-surface-variant)]">
              Needs attendance to compute rate
            </p>
          )}
        </div>
        <div className="flex flex-col justify-center gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 md:col-span-6">
          {data.summary.mostAnswered ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[var(--admin-primary)]" />
                <span className="text-xs text-[var(--admin-on-surface-variant)]">
                  Most answered
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-4">
                <Link
                  href={`/admin/reports/polls/${data.summary.mostAnswered.pollId}`}
                  className="truncate text-[13px] text-[var(--admin-on-surface)] hover:text-[var(--admin-primary)]"
                >
                  {data.summary.mostAnswered.title}
                </Link>
                <span className="shrink-0 font-mono text-sm text-[var(--admin-on-surface)]">
                  {data.summary.mostAnswered.responseCount.toLocaleString()}
                </span>
              </div>
            </div>
          ) : null}
          <div className="h-px bg-[var(--admin-border)]" />
          {data.summary.leastAnswered ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[var(--admin-warning)]" />
                <span className="text-xs text-[var(--admin-on-surface-variant)]">
                  Least answered
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-4">
                <Link
                  href={`/admin/reports/polls/${data.summary.leastAnswered.pollId}`}
                  className="truncate text-[13px] text-[var(--admin-warning)] hover:underline"
                >
                  {data.summary.leastAnswered.title}
                </Link>
                <span className="shrink-0 font-mono text-sm text-[var(--admin-warning)]">
                  {data.summary.leastAnswered.responseCount.toLocaleString()}
                </span>
              </div>
            </div>
          ) : null}
          <div className="h-px bg-[var(--admin-border)]" />
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--admin-success)]" />
              <span className="text-xs text-[var(--admin-on-surface-variant)]">
                Answered every poll
              </span>
            </div>
            <span className="font-mono text-sm text-[var(--admin-on-surface)]">
              {data.summary.answeredEveryPollCount.toLocaleString()} learners
            </span>
          </div>
        </div>
      </div>

      <SessionTimeline data={data} onSelectPoll={scrollToPoll} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-8">
          {data.polls.map((poll) => (
            <article
              key={poll.pollId}
              id={`poll-${poll.pollId}`}
              ref={(node) => {
                pollRefs.current[poll.pollId] = node;
              }}
              className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] transition-colors hover:bg-[var(--admin-surface-high)]"
            >
              <div className="flex items-start justify-between gap-4 border-b border-[var(--admin-border)] p-4">
                <div className="min-w-0">
                  <Link
                    href={`/admin/reports/polls/${poll.pollId}`}
                    className="mb-1 block text-[15px] font-semibold text-[var(--admin-on-surface)] hover:text-[var(--admin-primary)]"
                  >
                    {poll.title}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]">
                    <span className="rounded-sm bg-[var(--admin-surface-variant)] px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      {poll.anonymousVote ? "Anonymous" : "Identified"}
                    </span>
                    <span>·</span>
                    <span>{poll.quizMode ? "Quiz" : "Opinion"}</span>
                    {poll.quizMode && poll.correctPct != null ? (
                      <>
                        <span>·</span>
                        <span className="text-[var(--admin-success)]">
                          {formatPct(poll.correctPct)} correct
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div
                      className={[
                        "font-mono text-sm",
                        poll.participationPct != null && poll.participationPct < 50
                          ? "text-[var(--admin-warning)]"
                          : "text-[var(--admin-on-surface)]",
                      ].join(" ")}
                    >
                      {poll.responseCount.toLocaleString()}
                      {poll.eligibleCount != null
                        ? ` of ${poll.eligibleCount.toLocaleString()}`
                        : ""}
                    </div>
                    <div className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                      {formatPct(poll.participationPct)}
                    </div>
                  </div>
                  <PollBlockMenu pollId={poll.pollId} anonymous={poll.anonymousVote} />
                </div>
              </div>
              <div
                className={[
                  "space-y-3 p-4",
                  poll.anonymousVote
                    ? "rounded-b-lg border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)]"
                    : "",
                ].join(" ")}
              >
                {poll.anonymousVote ? (
                  <p className="text-xs text-[var(--admin-on-surface-variant)]">
                    Anonymous poll. Individual responses are not tracked.
                  </p>
                ) : null}
                {poll.options.map((option, index) => {
                  const showCorrect = poll.quizMode && option.isCorrect;
                  const opacity = index === 0 ? 1 : Math.max(0.35, 1 - index * 0.2);
                  return (
                    <div key={option.optionId} className="flex w-full items-center gap-4">
                      <span className="flex w-[30%] items-center gap-2 truncate text-[13px] text-[var(--admin-on-surface)]">
                        {showCorrect ? (
                          <CheckCircle2
                            className="h-3.5 w-3.5 shrink-0 text-[var(--admin-success)]"
                            aria-hidden="true"
                          />
                        ) : poll.quizMode ? (
                          <span className="inline-block w-3.5" />
                        ) : null}
                        <span className="truncate">{option.label}</span>
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                        <div
                          className={[
                            "h-full",
                            showCorrect
                              ? "bg-[var(--admin-success)]"
                              : poll.quizMode && !option.isCorrect && option.percent >= 20
                                ? "bg-[var(--admin-warning)]"
                                : "bg-[var(--admin-primary)]",
                          ].join(" ")}
                          style={{
                            width: `${Math.max(0, Math.min(100, option.percent))}%`,
                            opacity: showCorrect ? 1 : opacity,
                          }}
                        />
                      </div>
                      <span
                        className={[
                          "w-[15%] text-right font-mono text-[13px]",
                          showCorrect
                            ? "font-medium text-[var(--admin-success)]"
                            : "text-[var(--admin-on-surface-variant)]",
                        ].join(" ")}
                      >
                        {formatPct(option.percent)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>

        <aside className="lg:col-span-4">
          <div className="sticky top-24 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--admin-on-surface)]">
              Session details
            </h3>
            <div className="space-y-3 text-[13px]">
              <div className="flex justify-between gap-3 border-b border-[var(--admin-border)] pb-2">
                <span className="text-[var(--admin-on-surface-variant)]">Module</span>
                <span className="text-right font-medium text-[var(--admin-on-surface)]">
                  {data.session.courseTitle ?? "-"}
                </span>
              </div>
              <div className="flex justify-between gap-3 border-b border-[var(--admin-border)] pb-2">
                <span className="text-[var(--admin-on-surface-variant)]">Cohort</span>
                <span className="text-right font-medium text-[var(--admin-on-surface)]">
                  {data.session.batchName ?? "-"}
                </span>
              </div>
              <div className="flex justify-between gap-3 pb-2">
                <span className="text-[var(--admin-on-surface-variant)]">Recording</span>
                {data.session.recordingUrl ? (
                  <a
                    href={data.session.recordingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-[var(--admin-primary)] hover:underline"
                  >
                    View VOD
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="font-medium text-[var(--admin-on-surface)]">Not available</span>
                )}
              </div>
              {data.session.batchId ? (
                <Link
                  href={`/admin/reports/batches/${data.session.batchId}/live-sessions/${liveSessionId}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--admin-primary)] hover:underline"
                >
                  <Video className="h-4 w-4" aria-hidden="true" />
                  Attendance report
                </Link>
              ) : null}
            </div>
          </div>
        </aside>
      </div>

      <section className="flex flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
            Cross-poll participation matrix
          </h2>
          <div className="flex flex-wrap gap-4 text-xs text-[var(--admin-on-surface-variant)]">
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-[2px] bg-[var(--admin-primary)]" /> Answered
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-[2px] border border-[var(--admin-outline)]" />{" "}
              Missed
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-[2px] bg-[var(--admin-success)]" /> Correct
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-[2px] bg-[var(--admin-danger)]" /> Incorrect
            </div>
          </div>
        </div>

        <p className="border-b border-[var(--admin-border)] px-4 py-3 text-xs text-[var(--admin-on-surface-variant)] lg:hidden">
          Open on a larger screen to see the participation grid.
        </p>

        {data.matrix.learners.length === 0 ? (
          <p className="p-6 text-sm text-[var(--admin-on-surface-variant)]">
            No attendance records for this session, so the matrix cannot be built yet.
          </p>
        ) : (
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[800px] border-collapse text-left whitespace-nowrap">
              <thead>
                <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                  <th className="sticky left-0 top-0 z-30 min-w-[250px] bg-[var(--admin-surface-low)] p-3 shadow-[1px_0_0_0_var(--admin-border)]">
                    Learner
                  </th>
                  {data.matrix.polls.map((poll) => (
                    <th
                      key={poll.pollId}
                      className={[
                        "sticky top-0 z-20 border-l border-[var(--admin-border)] p-3 text-center",
                        poll.anonymousVote
                          ? "bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]"
                          : "bg-[var(--admin-surface-low)]",
                      ].join(" ")}
                      title={
                        poll.anonymousVote
                          ? `${poll.title} — Anonymous, not tracked per learner`
                          : poll.title
                      }
                    >
                      <div className="mx-auto max-w-[120px] truncate">
                        {poll.anonymousVote ? "Anonymous" : poll.title}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] font-normal lowercase">
                        {poll.anonymousVote ? "not tracked" : formatClock(poll.openedAt)}
                      </div>
                    </th>
                  ))}
                  <th className="sticky top-0 z-20 border-l border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 pr-6 text-right">
                    Completion
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {data.matrix.learners.map((learner) => {
                  const name = learner.learnerName ?? learner.email ?? "Learner";
                  const total = learner.trackedPollCount;
                  const pct = total > 0 ? (learner.answeredCount / total) * 100 : 0;
                  return (
                    <tr
                      key={learner.membershipId}
                      className="group border-b border-[var(--admin-border)] transition-colors hover:bg-[var(--admin-surface-high)]"
                    >
                      <td className="sticky left-0 z-10 bg-[var(--admin-surface)] p-3 shadow-[1px_0_0_0_var(--admin-border)] transition-colors group-hover:bg-[var(--admin-surface-high)]">
                        <div className="flex items-center gap-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_14%,var(--admin-surface))] text-[10px] font-bold text-[var(--admin-primary-strong)]">
                            {learnerInitials(learner.learnerName, learner.email)}
                          </div>
                          <span className="w-40 truncate text-[var(--admin-on-surface)]">
                            {name}
                          </span>
                        </div>
                      </td>
                      {learner.cells.map((cell) => {
                        const poll = data.matrix.polls.find((p) => p.pollId === cell.pollId);
                        if (cell.kind === "anonymous") {
                          return (
                            <td
                              key={cell.pollId}
                              className="relative border-l border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-0"
                            >
                              <div
                                className="absolute inset-0 opacity-40"
                                style={{
                                  backgroundImage:
                                    "repeating-linear-gradient(-45deg, transparent, transparent 4px, var(--admin-border) 4px, var(--admin-border) 5px)",
                                }}
                              />
                              <span className="sr-only">Anonymous — not tracked</span>
                            </td>
                          );
                        }
                        return (
                          <td
                            key={cell.pollId}
                            className="border-l border-[var(--admin-border)] p-3 text-center"
                          >
                            <div
                              className={`mx-auto h-3 w-3 rounded-[2px] ${matrixCellClass(cell.kind)}`}
                              title={`${name} · ${poll?.title ?? "Poll"} · ${matrixLabel(cell.kind)}`}
                              aria-label={`${name}, ${poll?.title ?? "poll"}: ${matrixLabel(cell.kind)}`}
                            />
                          </td>
                        );
                      })}
                      <td className="border-l border-[var(--admin-border)] p-3 pr-6 text-right font-mono">
                        <div className="flex items-center justify-end gap-2">
                          <span
                            className={[
                              "text-xs",
                              pct < 40
                                ? "text-[var(--admin-danger)]"
                                : "text-[var(--admin-on-surface)]",
                            ].join(" ")}
                          >
                            {learner.answeredCount} of {total}
                          </span>
                          <div className="h-[3px] w-12 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                            <div
                              className={`h-full ${completionBarColor(learner.answeredCount, total)}`}
                              style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-[var(--admin-surface-low)] font-mono text-xs font-medium">
                  <td className="sticky left-0 bg-[var(--admin-surface-low)] p-3 text-right uppercase tracking-wider text-[var(--admin-on-surface-variant)] shadow-[1px_0_0_0_var(--admin-border)]">
                    Rate
                  </td>
                  {data.matrix.polls.map((poll) => (
                    <td
                      key={poll.pollId}
                      className={[
                        "border-l border-[var(--admin-border)] p-3 text-center",
                        poll.participationPct != null && poll.participationPct < 50
                          ? "text-[var(--admin-warning)]"
                          : "text-[var(--admin-on-surface)]",
                      ].join(" ")}
                    >
                      {poll.anonymousVote ? "—" : formatPct(poll.participationPct)}
                    </td>
                  ))}
                  <td className="border-l border-[var(--admin-border)]" />
                </tr>
              </tbody>
            </table>
            {data.matrix.truncated ? (
              <p className="border-t border-[var(--admin-border)] px-4 py-2 text-xs text-[var(--admin-on-surface-variant)]">
                Showing the first 300 attendees. Export individual poll reports for the full
                roster.
              </p>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
