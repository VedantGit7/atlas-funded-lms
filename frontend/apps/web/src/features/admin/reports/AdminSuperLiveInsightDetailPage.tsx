"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeftRight,
  Calendar,
  ChevronRight,
  Clock3,
  Download,
  FolderX,
  History,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { primaryButtonClassName } from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  exportSuperLiveInsightsReport,
  fetchSuperLiveInsightDetail,
  type SuperLiveInsightContext,
  type SuperLiveInsightItem,
} from "./admin-super-live-insights-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-sm bg-[var(--admin-surface-high)]",
        "motion-safe:after:absolute motion-safe:after:inset-0 motion-safe:after:-translate-x-full",
        "motion-safe:after:animate-[shimmer_1.8s_infinite]",
        "motion-safe:after:bg-gradient-to-r motion-safe:after:from-transparent",
        "motion-safe:after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] motion-safe:after:to-transparent",
        className ?? "",
      ].join(" ")}
    />
  );
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateShort(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTimeRange(start: string | null, end: string | null): string {
  if (!start) return "-";
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return "-";
  const startLabel = startDate.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (!end) return startLabel;
  const endDate = new Date(end);
  if (Number.isNaN(endDate.getTime())) return startLabel;
  return `${startLabel} - ${endDate.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "-";
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${String(hours)}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${String(minutes)}m ${String(secs).padStart(2, "0")}s`;
  return `${String(secs)}s`;
}

function formatRate(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function sharePct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function sessionStatusTone(status: string): "success" | "warning" | "danger" | "muted" | "primary" {
  if (status === "live") return "success";
  if (status === "scheduled") return "primary";
  if (status === "cancelled") return "danger";
  return "muted";
}

function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger" | "muted" | "primary";
  children: ReactNode;
}) {
  const tones = {
    success:
      "border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]",
    warning:
      "border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]",
    danger:
      "border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]",
    muted:
      "border-[var(--admin-outline)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
    primary:
      "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)] text-[var(--admin-primary)]",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function MetricBar({
  pct,
  tone = "primary",
  tickPct,
  tickLabel,
}: {
  pct: number | null;
  tone?: "primary" | "success" | "warning";
  tickPct?: number | null;
  tickLabel?: string | null;
}) {
  const width = Math.max(0, Math.min(100, pct ?? 0));
  const fill =
    tone === "success"
      ? "bg-[var(--admin-success)]"
      : tone === "warning"
        ? "bg-[var(--admin-warning)]"
        : "bg-[var(--admin-primary)]";
  return (
    <div className="relative">
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ease-out ${fill}`}
          style={{ width: `${String(width)}%` }}
        />
      </div>
      {tickPct != null ? (
        <>
          <div
            className="absolute top-1/2 z-10 h-3 w-px -translate-y-1/2 bg-[var(--admin-on-surface-variant)]"
            style={{ left: `${String(Math.max(0, Math.min(100, tickPct)))}%` }}
          />
          {tickLabel ? (
            <div
              className="absolute top-4 -translate-x-1/2 font-mono text-[11px] text-[var(--admin-on-surface-variant)]"
              style={{ left: `${String(Math.max(0, Math.min(100, tickPct)))}%` }}
            >
              {tickLabel}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function DetailLoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading session insight">
      <div className="flex justify-between gap-4">
        <div className="flex-1 space-y-2">
          <Shimmer className="h-4 w-64" />
          <Shimmer className="h-8 w-2/3" />
          <Shimmer className="h-5 w-40" />
        </div>
        <Shimmer className="h-9 w-56" />
      </div>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 lg:col-span-8">
          <Shimmer className="mb-2 h-3 w-28" />
          <Shimmer className="mb-6 h-8 w-24" />
          <Shimmer className="h-1 w-full" />
        </div>
        <div className="col-span-12 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 lg:col-span-4">
          <Shimmer className="mb-2 h-3 w-24" />
          <Shimmer className="mb-6 h-7 w-20" />
          <Shimmer className="h-1 w-full" />
        </div>
      </div>
      <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
        <Shimmer className="mb-4 h-4 w-40" />
        <Shimmer className="mb-3 h-4 w-full" />
        <div className="flex gap-6">
          <Shimmer className="h-4 w-24" />
          <Shimmer className="h-4 w-24" />
          <Shimmer className="h-4 w-24" />
        </div>
      </div>
    </div>
  );
}

function ComparisonAxis({
  label,
  rightLabel,
  valuePct,
  bandStart,
  bandEnd,
  tickPct,
  caption,
}: {
  label: string;
  rightLabel?: string;
  valuePct: number | null;
  bandStart: number | null;
  bandEnd: number | null;
  tickPct?: number | null;
  caption?: string | null;
}) {
  const pin = valuePct == null ? null : Math.max(0, Math.min(100, valuePct));
  const start = bandStart == null ? 40 : Math.max(0, Math.min(100, bandStart));
  const end = bandEnd == null ? 85 : Math.max(start, Math.min(100, bandEnd));
  return (
    <div>
      <div className="mb-2 flex justify-between text-xs text-[var(--admin-on-surface-variant)]">
        <span>{label}</span>
        {rightLabel ? <span>{rightLabel}</span> : null}
      </div>
      <div className="relative flex h-6 items-center">
        <div className="absolute h-px w-full bg-[var(--admin-border)]" />
        <div
          className="absolute h-2 rounded-full border border-[color-mix(in_srgb,var(--admin-outline)_50%,transparent)] bg-[var(--admin-surface-low)]"
          style={{ left: `${String(start)}%`, width: `${String(Math.max(2, end - start))}%` }}
        />
        {tickPct != null ? (
          <div
            className="absolute z-10 h-full border-l border-dashed border-[var(--admin-on-surface-variant)]"
            style={{ left: `${String(Math.max(0, Math.min(100, tickPct)))}%` }}
          />
        ) : null}
        {pin != null ? (
          <div
            className="absolute z-20 h-3 w-3 -translate-x-1/2 rounded-full bg-[var(--admin-primary)] shadow-sm"
            style={{ left: `${String(pin)}%` }}
          />
        ) : null}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
        <span>0%</span>
        {caption ? <span className="px-[10%] text-center">{caption}</span> : <span />}
        <span>100%</span>
      </div>
    </div>
  );
}

export function AdminSuperLiveInsightDetailPage({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SuperLiveInsightItem | null>(null);
  const [context, setContext] = useState<SuperLiveInsightContext | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchSuperLiveInsightDetail(sessionId);
      setSession(response.data.session);
      setContext(response.data.context);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load session details.",
      );
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const response = await exportSuperLiveInsightsReport({
        sessionId,
        emailDownloadLink: true,
      });
      const completed = await pollReportRunUntilComplete(response.data.runId);
      if (completed.status === "failed") {
        throw new Error(completed.errorMessage ?? "Export failed.");
      }
      if (completed.status === "completed") {
        await downloadReportExport(completed.id, "csv");
      }
    } catch (exportError) {
      setError(
        exportError instanceof ClientApiError
          ? exportError.message
          : exportError instanceof Error
            ? exportError.message
            : "Unable to export report.",
      );
    } finally {
      setBusy(false);
    }
  }

  const cancelled = session?.status === "cancelled";
  const scheduled = session?.status === "scheduled";
  const noRecords = session != null && session.totalCount === 0 && !cancelled && !scheduled;
  const rateTone =
    context?.rateDeltaVsCourse != null && context.rateDeltaVsCourse < 0 ? "warning" : "success";

  const attendedPct = session ? sharePct(session.attendedCount, session.totalCount) : 0;
  const registeredPct = session ? sharePct(session.registeredCount, session.totalCount) : 0;
  const absentPct = session ? sharePct(session.absentCount, session.totalCount) : 0;

  const maxTrendRate = Math.max(
    1,
    ...(context?.trend.map((item) => item.attendanceRate ?? 0) ?? [100]),
  );

  const startDelayMinutes =
    session?.scheduledAt && session.startedAt
      ? Math.round(
          (new Date(session.startedAt).getTime() - new Date(session.scheduledAt).getTime()) / 60000,
        )
      : null;

  return (
    <div className="space-y-6">
      <nav
        className="flex flex-wrap items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]"
        aria-label="Breadcrumb"
      >
        <Link href="/admin" className="hover:text-[var(--admin-on-surface)]">
          Admin
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href="/admin/reports" className="hover:text-[var(--admin-on-surface)]">
          Reports
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link
          href="/admin/reports/super-live-insights"
          className="hover:text-[var(--admin-on-surface)]"
        >
          Super Live Insights
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium text-[var(--admin-on-surface)]">
          {session?.title ?? "Session"}
        </span>
      </nav>

      <div>
        <Link
          href="/admin/reports/super-live-insights"
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--admin-primary)] hover:underline"
        >
          All sessions
        </Link>
      </div>

      {error ? (
        <div className="overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[var(--admin-surface)]">
          <div className="flex items-center justify-between gap-3 bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-danger)]">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Couldn&apos;t load session details</span>
            </div>
            <button
              type="button"
              className="rounded-lg border border-[var(--admin-danger)] bg-[var(--admin-surface)] px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] active:translate-y-px"
              onClick={() => void load()}
            >
              Retry
            </button>
          </div>
          <div className="pointer-events-none p-6 opacity-30 grayscale">
            <Shimmer className="mb-4 h-6 w-1/2" />
            <Shimmer className="h-20 w-full" />
          </div>
        </div>
      ) : null}

      {loading && !session ? <DetailLoadingSkeleton /> : null}

      {!loading && session && context && !error ? (
        <>
          {cancelled ? (
            <div className="flex items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-4 py-3 text-sm font-medium text-[var(--admin-danger)]">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                This session was cancelled
                {context.cancelledAt ? ` on ${formatDateShort(context.cancelledAt)}` : ""}
              </span>
            </div>
          ) : null}

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
                <span className={cancelled ? "opacity-50" : ""}>{session.title}</span>
                <StatusPill tone={sessionStatusTone(session.status)}>
                  {titleCase(session.status)}
                </StatusPill>
              </h1>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--admin-on-surface-variant)]">
                {session.courseTitle ? (
                  <span className="rounded-md bg-[var(--admin-surface-high)] px-2 py-1">
                    {session.courseTitle}
                  </span>
                ) : null}
                {session.batchName ? (
                  <span className="rounded-md bg-[var(--admin-surface-high)] px-2 py-1">
                    {session.batchName}
                  </span>
                ) : null}
                {session.scheduledAt ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-[var(--admin-surface-high)] px-2 py-1">
                    <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                    {formatDate(session.scheduledAt)}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={secondaryButtonClassName}
                disabled={busy}
                onClick={() => void handleExport()}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Export CSV
              </button>
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => {
                  router.push("/admin/reports/super-live-insights");
                }}
              >
                <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                Compare with another session
              </button>
              <Link
                href={`/admin/reports/live-class-attendance/${session.id}`}
                className={primaryButtonClassName}
              >
                View attendees
              </Link>
            </div>
          </div>

          {noRecords ? (
            <section className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-12 text-center">
              <FolderX className="mb-3 h-8 w-8 text-[var(--admin-outline)]" aria-hidden="true" />
              <h2 className="mb-1 text-base font-semibold text-[var(--admin-on-surface)]">
                No attendance records for this session
              </h2>
              <p className="max-w-md text-sm text-[var(--admin-on-surface-variant)]">
                Ensure tracking was enabled or manual imports are completed.
              </p>
            </section>
          ) : null}

          {!noRecords ? (
            <>
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 flex flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 lg:col-span-8">
                  {scheduled ? (
                    <>
                      <div>
                        <div className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">
                          Current registrations
                        </div>
                        <div className="font-mono text-[32px] font-semibold leading-none text-[var(--admin-on-surface)]">
                          {formatCount(session.registeredCount)}
                        </div>
                      </div>
                      <div className="mt-6">
                        <div className="relative h-3 overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                          <div
                            className="h-full bg-[color-mix(in_srgb,var(--admin-warning)_60%,transparent)]"
                            style={{
                              width: `${String(
                                Math.min(
                                  100,
                                  context.estimatedTurnout != null && session.registeredCount > 0
                                    ? (context.estimatedTurnout / session.registeredCount) * 100
                                    : 60,
                                ),
                              )}%`,
                            }}
                          />
                          {context.courseAvgAttendanceRate != null ? (
                            <div
                              className="absolute inset-y-0 w-px border-l border-dashed border-[var(--admin-on-surface-variant)]"
                              style={{
                                left: `${String(Math.max(0, Math.min(100, context.courseAvgAttendanceRate)))}%`,
                              }}
                            />
                          ) : null}
                        </div>
                        <p className="mt-2 text-right text-xs text-[var(--admin-on-surface-variant)]">
                          {context.estimatedTurnout != null
                            ? `Est. turnout: ~${formatCount(context.estimatedTurnout)} (${formatRate(context.courseAvgAttendanceRate)})`
                            : "Estimate unavailable until course averages exist."}
                        </p>
                      </div>
                      <div className="mt-6 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 text-center">
                        <Clock3
                          className="mx-auto mb-2 h-6 w-6 text-[var(--admin-on-surface-variant)]"
                          aria-hidden="true"
                        />
                        <p className="text-sm text-[var(--admin-on-surface)]">
                          Session data will populate once the event starts.
                        </p>
                        <p className="mt-2 font-mono text-sm text-[var(--admin-on-surface-variant)]">
                          Not held yet
                        </p>
                      </div>
                    </>
                  ) : cancelled ? (
                    <>
                      <div className="opacity-75">
                        <div className="mb-1 flex items-end justify-between">
                          <span className="font-mono text-[11px] uppercase text-[var(--admin-on-surface-variant)]">
                            Composition
                          </span>
                          <span className="font-mono text-sm text-[var(--admin-on-surface)]">
                            {formatCount(session.registeredCount)} Registered
                          </span>
                        </div>
                        <div
                          className="h-3 w-full overflow-hidden rounded-sm border border-[var(--admin-border)]"
                          style={{
                            backgroundImage:
                              "repeating-linear-gradient(45deg, var(--admin-surface-high), var(--admin-surface-high) 10px, var(--admin-surface-low) 10px, var(--admin-surface-low) 20px)",
                          }}
                        />
                      </div>
                      <table className="mt-6 w-full border-collapse text-left opacity-50">
                        <thead>
                          <tr className="border-b border-[var(--admin-border)]">
                            <th className="py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                              Metric
                            </th>
                            <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                              Value
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-[var(--admin-border)]">
                            <td className="py-2 text-sm text-[var(--admin-on-surface)]">
                              Attendance rate
                            </td>
                            <td className="py-2 text-right font-mono text-sm text-[var(--admin-on-surface-variant)]">
                              -
                            </td>
                          </tr>
                          <tr className="border-b border-[var(--admin-border)]">
                            <td className="py-2 text-sm text-[var(--admin-on-surface)]">
                              Avg duration
                            </td>
                            <td className="py-2 text-right font-mono text-sm text-[var(--admin-on-surface-variant)]">
                              -
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">
                          Attendance rate
                        </div>
                        <div className="flex flex-wrap items-baseline gap-3">
                          <span className="font-mono text-[32px] font-semibold leading-none text-[var(--admin-on-surface)]">
                            {formatRate(session.attendanceRate)}
                          </span>
                          {context.rateDeltaVsCourse != null ? (
                            <span
                              className={`inline-flex items-center text-xs ${
                                context.rateDeltaVsCourse < 0
                                  ? "text-[var(--admin-warning)]"
                                  : "text-[var(--admin-success)]"
                              }`}
                            >
                              {context.rateDeltaVsCourse < 0 ? (
                                <TrendingDown className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                              ) : (
                                <TrendingUp className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                              )}
                              {Math.abs(context.rateDeltaVsCourse).toFixed(1)} points{" "}
                              {context.rateDeltaVsCourse < 0 ? "below" : "above"} course avg
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-6">
                        <MetricBar
                          pct={session.attendanceRate}
                          tone={rateTone === "warning" ? "warning" : "primary"}
                          tickPct={context.courseAvgAttendanceRate}
                          tickLabel={
                            context.courseAvgAttendanceRate != null
                              ? `${formatRate(context.courseAvgAttendanceRate)} AVG`
                              : null
                          }
                        />
                        <div className="mt-8 text-xs text-[var(--admin-on-surface-variant)]">
                          {formatCount(session.attendedCount)} attended of{" "}
                          {formatCount(session.totalCount)} records
                          {context.rateDeltaVsCourse != null &&
                          context.courseAvgAttendanceRate != null
                            ? ` · ${Math.abs(context.rateDeltaVsCourse).toFixed(1)} points ${
                                context.rateDeltaVsCourse < 0 ? "below" : "above"
                              } the ${formatRate(context.courseAvgAttendanceRate)} average for this course`
                            : ""}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="col-span-12 flex flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 lg:col-span-4">
                  <div>
                    <div className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">
                      Avg duration
                    </div>
                    <div className="font-mono text-2xl font-semibold leading-none text-[var(--admin-on-surface)]">
                      {cancelled || scheduled ? "-" : formatDuration(session.avgDurationSeconds)}
                    </div>
                  </div>
                  {!cancelled && !scheduled ? (
                    <div className="mt-6">
                      <MetricBar pct={context.durationCoveragePct} />
                      <div className="mt-3 flex justify-between font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                        <span>Coverage</span>
                        <span>Session: {formatDuration(session.durationSeconds)}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-6 text-xs text-[var(--admin-on-surface-variant)]">
                      {scheduled
                        ? "Duration metrics appear after the session ends."
                        : "Session cancelled - duration metrics unavailable."}
                    </p>
                  )}
                </div>
              </div>

              {!cancelled && !scheduled ? (
                <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
                  <h2 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">
                    Cohort composition
                  </h2>
                  <div className="mb-3 flex h-4 w-full overflow-hidden rounded-sm">
                    <Link
                      href={`/admin/reports/live-class-attendance/${session.id}`}
                      className="h-full bg-[var(--admin-success)]"
                      style={{ width: `${String(attendedPct)}%` }}
                      title={`Attended (${formatCount(session.attendedCount)})`}
                    />
                    <Link
                      href={`/admin/reports/live-class-attendance/${session.id}`}
                      className="h-full bg-[var(--admin-warning)]"
                      style={{ width: `${String(registeredPct)}%` }}
                      title={`Registered (${formatCount(session.registeredCount)})`}
                    />
                    <Link
                      href={`/admin/reports/live-class-attendance/${session.id}`}
                      className="h-full bg-[var(--admin-danger)]"
                      style={{ width: `${String(absentPct)}%` }}
                      title={`Absent (${formatCount(session.absentCount)})`}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-6 font-mono text-sm">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[var(--admin-success)]" />
                        <span className="text-[var(--admin-on-surface)]">
                          {formatCount(session.attendedCount)}
                        </span>
                        <span className="text-xs text-[var(--admin-on-surface-variant)]">
                          Attended
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[var(--admin-warning)]" />
                        <span className="text-[var(--admin-on-surface)]">
                          {formatCount(session.registeredCount)}
                        </span>
                        <span className="text-xs text-[var(--admin-on-surface-variant)]">
                          Registered
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[var(--admin-danger)]" />
                        <span className="text-[var(--admin-on-surface)]">
                          {formatCount(session.absentCount)}
                        </span>
                        <span className="text-xs text-[var(--admin-on-surface-variant)]">
                          Absent
                        </span>
                      </div>
                    </div>
                    <div className="font-mono text-[11px] uppercase text-[var(--admin-on-surface-variant)]">
                      Total: {formatCount(session.totalCount)} records
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-[var(--admin-on-surface-variant)]">
                    {formatCount(session.attendedCount)} attended +{" "}
                    {formatCount(session.registeredCount)} registered +{" "}
                    {formatCount(session.absentCount)} absent = {formatCount(session.totalCount)}{" "}
                    records.
                  </p>
                </div>
              ) : null}

              {!scheduled ? (
                <div className="grid grid-cols-12 gap-6">
                  <div className="col-span-12 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 lg:col-span-7">
                    <h2 className="mb-6 text-base font-semibold text-[var(--admin-on-surface)]">
                      How this session compares
                    </h2>
                    {cancelled ? (
                      <p className="text-sm text-[var(--admin-on-surface-variant)]">
                        Comparison axes are unavailable for cancelled sessions.
                      </p>
                    ) : (
                      <div className="space-y-8">
                        <ComparisonAxis
                          label="Attendance rate distribution"
                          rightLabel="Course sessions"
                          valuePct={session.attendanceRate}
                          bandStart={context.courseRateP25}
                          bandEnd={context.courseRateP75}
                          tickPct={context.courseAvgAttendanceRate}
                          caption={context.courseRankCaption}
                        />
                        <ComparisonAxis
                          label="Avg duration vs scheduled"
                          valuePct={context.durationCoveragePct}
                          bandStart={60}
                          bandEnd={90}
                        />
                      </div>
                    )}
                  </div>

                  <div className="col-span-12 flex flex-col gap-4 lg:col-span-5">
                    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
                      <h3 className="mb-3 border-b border-[var(--admin-border)] pb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                        Same series
                      </h3>
                      <div className="space-y-1">
                        {context.series.length === 0 ? (
                          <p className="px-2 py-3 text-xs text-[var(--admin-on-surface-variant)]">
                            No related sessions in this course or batch.
                          </p>
                        ) : (
                          context.series.map((item) => (
                            <Link
                              key={item.id}
                              href={`/admin/reports/super-live-insights/${item.id}`}
                              className={[
                                "flex items-center justify-between rounded-md p-2 transition-colors",
                                item.isCurrent
                                  ? "bg-[var(--admin-surface-high)]"
                                  : "hover:bg-[var(--admin-surface-high)]",
                              ].join(" ")}
                            >
                              <div className="flex items-center gap-2">
                                {item.isCurrent ? (
                                  <span className="h-2 w-2 rounded-full bg-[var(--admin-primary)]" />
                                ) : (
                                  <History
                                    className="h-3.5 w-3.5 text-[var(--admin-on-surface-variant)]"
                                    aria-hidden="true"
                                  />
                                )}
                                <span
                                  className={[
                                    "text-xs text-[var(--admin-on-surface)]",
                                    item.isCurrent ? "font-medium" : "",
                                  ].join(" ")}
                                >
                                  {item.isCurrent ? `${item.title} (Current)` : item.title}
                                </span>
                              </div>
                              <span className="font-mono text-sm text-[var(--admin-on-surface-variant)]">
                                {formatRate(item.attendanceRate)}
                              </span>
                            </Link>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="flex gap-6 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
                      <div className="flex-1">
                        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          Timing
                        </h3>
                        <div className="font-mono text-sm text-[var(--admin-on-surface)]">
                          {formatTimeRange(
                            session.scheduledAt,
                            session.endedAt ?? session.startedAt,
                          )}
                        </div>
                        <div className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                          {formatDateShort(session.scheduledAt)}
                        </div>
                        {startDelayMinutes != null && startDelayMinutes > 5 ? (
                          <p className="mt-2 text-xs text-[var(--admin-warning)]">
                            Started {startDelayMinutes} minutes after schedule
                          </p>
                        ) : null}
                      </div>
                      <div className="flex-1 border-l border-[var(--admin-border)] pl-6">
                        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          Actual
                        </h3>
                        <div className="font-mono text-sm text-[var(--admin-on-surface)]">
                          {formatTimeRange(session.startedAt, session.endedAt)}
                        </div>
                        <div className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                          {formatDuration(session.durationSeconds)} elapsed
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
                      <h3 className="mb-3 border-b border-[var(--admin-border)] pb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                        Related reports
                      </h3>
                      <div className="space-y-1">
                        <Link
                          href={`/admin/reports/live-class-attendance/${session.id}`}
                          className="flex items-center justify-between rounded-md px-2 py-2 text-sm text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                        >
                          Attendee roster in Live Class Attendance
                          <ChevronRight className="h-4 w-4 text-[var(--admin-on-surface-variant)]" />
                        </Link>
                        {session.batchId ? (
                          <Link
                            href="/admin/reports/batches"
                            className="flex items-center justify-between rounded-md px-2 py-2 text-sm text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                          >
                            Batch report
                            <ChevronRight className="h-4 w-4 text-[var(--admin-on-surface-variant)]" />
                          </Link>
                        ) : null}
                        {session.courseId ? (
                          <Link
                            href="/admin/reports/progress-score"
                            className="flex items-center justify-between rounded-md px-2 py-2 text-sm text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                          >
                            Course progress
                            <ChevronRight className="h-4 w-4 text-[var(--admin-on-surface-variant)]" />
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {!cancelled && context.trend.length > 1 ? (
                <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
                  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                        Course attendance trend
                      </h2>
                      {context.trendDeltaPoints != null ? (
                        <p
                          className={`mt-1 flex items-center text-xs ${
                            context.trendDeltaPoints < 0
                              ? "text-[var(--admin-warning)]"
                              : "text-[var(--admin-success)]"
                          }`}
                        >
                          <AlertTriangle className="mr-1 h-4 w-4" aria-hidden="true" />
                          {context.trendDeltaPoints < 0
                            ? `Turnout has fallen ${Math.abs(context.trendDeltaPoints).toFixed(0)} points across the last four sessions.`
                            : `Turnout has risen ${Math.abs(context.trendDeltaPoints).toFixed(0)} points across the last four sessions.`}
                        </p>
                      ) : null}
                    </div>
                    {session.courseId ? (
                      <Link
                        href="/admin/reports/live-class-attendance/series"
                        className="inline-flex items-center text-xs font-medium text-[var(--admin-primary)] hover:underline"
                      >
                        View course report
                        <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
                      </Link>
                    ) : null}
                  </div>
                  <div className="flex h-32 w-full items-end gap-2">
                    {context.trend.map((item) => {
                      const height =
                        item.isFuture || item.attendanceRate == null
                          ? 10
                          : Math.max(8, (item.attendanceRate / maxTrendRate) * 100);
                      if (item.isFuture) {
                        return (
                          <div
                            key={`${item.label}-future`}
                            className="flex-1 rounded-t border border-dashed border-[var(--admin-outline)] bg-transparent"
                            style={{ height: `${String(height)}%` }}
                            title={item.title}
                          />
                        );
                      }
                      return (
                        <div
                          key={item.id ?? item.label}
                          className={[
                            "group relative flex flex-1 flex-col justify-end rounded-t transition-colors",
                            item.isCurrent
                              ? "bg-[var(--admin-primary)]"
                              : "bg-[var(--admin-surface-high)] hover:bg-[var(--admin-outline)]",
                          ].join(" ")}
                          style={{ height: `${String(height)}%` }}
                          title={`${item.title}: ${formatRate(item.attendanceRate)}`}
                        >
                          <div
                            className={[
                              "pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded bg-[var(--admin-on-surface)] px-2 py-1 font-mono text-[10px] text-[var(--admin-surface)] transition-opacity",
                              item.isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                            ].join(" ")}
                          >
                            {formatRate(item.attendanceRate)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex justify-between font-mono text-[11px] uppercase text-[var(--admin-on-surface-variant)]">
                    {context.trend.map((item) => (
                      <span
                        key={`${item.label}-axis`}
                        className={item.isCurrent ? "font-bold text-[var(--admin-primary)]" : ""}
                      >
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
