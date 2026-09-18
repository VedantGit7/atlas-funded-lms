"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  RefreshCw,
  StopCircle,
  Timer,
  TrendingUp,
  X,
} from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  closePollLive,
  exportPollReport,
  extendPollLive,
  fetchPollLiveMonitor,
  type PollLiveMonitor,
  type PollOptionBreakdown,
  type PollTimelineEvent,
  type PollTimelinePoint,
} from "./admin-polls-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

const POLL_INTERVAL_MS = 2500;

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const dangerButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-danger)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-danger)] transition-all hover:bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-danger)]/30 disabled:cursor-not-allowed disabled:opacity-50";

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
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function formatSeconds(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  const rounded = value;
  if (rounded % 1 === 0) return `${rounded}s`;
  return `${rounded.toFixed(1)}s`;
}

function formatCountdown(totalSeconds: number | null): string {
  if (totalSeconds == null || totalSeconds < 0) return "--:--";
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatClock(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatRelativeAgo(iso: string, nowMs: number): string {
  const delta = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 1000));
  if (delta < 1) return "just now";
  if (delta < 60) return `${delta}s ago`;
  const mins = Math.floor(delta / 60);
  return `${mins}m ago`;
}

function learnerInitials(name: string | null): string {
  const source = (name?.trim() || "?").replace(/\s+/g, " ");
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function barOpacity(index: number, total: number): number {
  if (index === 0) return 1;
  const step = 0.8 / Math.max(1, total - 1);
  return Math.max(0.25, 1 - index * step);
}

function VelocityChart({ points, label }: { points: PollTimelinePoint[]; label: string }) {
  const width = 640;
  const height = 180;
  const pad = { top: 16, right: 12, bottom: 28, left: 36 };
  const maxY = Math.max(1, ...points.map((p) => p.responseCount));
  const maxX = Math.max(1, ...points.map((p) => p.offsetSeconds), 1);
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const coords = points.map((point) => {
    const x = pad.left + (point.offsetSeconds / maxX) * plotW;
    const y = pad.top + plotH - (point.responseCount / maxY) * plotH;
    return { x, y, ...point };
  });

  let linePath = "";
  let areaPath = "";
  const firstCoord = coords[0];
  const lastCoord = coords.at(-1);
  if (firstCoord && lastCoord) {
    linePath = coords
      .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
      .join(" ");
    areaPath = `${linePath} L${lastCoord.x.toFixed(1)},${(pad.top + plotH).toFixed(1)} L${firstCoord.x.toFixed(1)},${(pad.top + plotH).toFixed(1)} Z`;
  }

  const peak = coords.reduce<(typeof coords)[number] | null>((best, c) => {
    if (!best || c.responseCount > best.responseCount) return c;
    return best;
  }, null);

  return (
    <div className="relative h-full w-full">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 py-4">
        <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
          Response velocity
        </h2>
        <span className="text-xs text-[var(--admin-on-surface-variant)]">{label}</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full pt-10"
        role="img"
        aria-label="Responses over time"
      >
        {[0.25, 0.5, 0.75].map((frac) => {
          const y = pad.top + plotH * (1 - frac);
          return (
            <line
              key={frac}
              x1={pad.left}
              x2={width - pad.right}
              y1={y}
              y2={y}
              stroke="var(--admin-border)"
              strokeWidth={1}
            />
          );
        })}
        {areaPath ? (
          <path d={areaPath} fill="color-mix(in srgb, var(--admin-primary) 18%, transparent)" />
        ) : null}
        {linePath ? (
          <path
            d={linePath}
            fill="none"
            stroke="var(--admin-primary)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {peak && peak.responseCount > 0 ? (
          <>
            <circle
              cx={peak.x}
              cy={peak.y}
              r={4}
              fill="var(--admin-surface)"
              stroke="var(--admin-primary)"
              strokeWidth={2}
            />
            <text
              x={peak.x}
              y={Math.max(pad.top + 10, peak.y - 10)}
              textAnchor="middle"
              className="fill-[var(--admin-on-surface-variant)]"
              style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}
            >
              Peak {formatSeconds(peak.offsetSeconds)}
            </text>
          </>
        ) : null}
        <text
          x={pad.left - 8}
          y={pad.top + 4}
          textAnchor="end"
          className="fill-[var(--admin-on-surface-variant)]"
          style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}
        >
          {maxY}
        </text>
        <text
          x={pad.left - 8}
          y={pad.top + plotH}
          textAnchor="end"
          className="fill-[var(--admin-on-surface-variant)]"
          style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}
        >
          0
        </text>
      </svg>
    </div>
  );
}

function OptionBars({
  options,
  showCorrect,
  dense,
  present,
}: {
  options: PollOptionBreakdown[];
  showCorrect: boolean;
  dense?: boolean;
  present?: boolean;
}) {
  const sorted = useMemo(
    () => [...options].sort((a, b) => b.count - a.count || a.sortOrder - b.sortOrder),
    [options],
  );

  if (sorted.length === 0) {
    return <p className="text-sm text-[var(--admin-on-surface-variant)]">No options configured.</p>;
  }

  return (
    <div className={present ? "flex flex-col gap-8" : "flex flex-col"}>
      {sorted.map((option, index) => {
        const isCorrect = showCorrect && option.isCorrect;
        const opacity = barOpacity(index, sorted.length);
        return (
          <div
            key={option.optionId}
            className={[
              present
                ? "flex items-center gap-6"
                : "flex h-11 items-center gap-3 rounded-sm px-2 -mx-2 transition-colors hover:bg-[var(--admin-surface-high)]",
              dense && !present ? "border-b border-[var(--admin-border)] last:border-b-0" : "",
            ].join(" ")}
          >
            <div
              className={[
                "shrink-0 truncate text-[var(--admin-on-surface)]",
                present
                  ? "w-1/3 text-right text-xl font-semibold"
                  : "flex w-48 items-center gap-2 text-sm",
              ].join(" ")}
            >
              <span className="truncate">{option.label}</span>
              {isCorrect && !present ? (
                <span className="shrink-0 rounded-sm border border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] px-1.5 py-px font-mono text-[10px] font-medium uppercase tracking-wide text-[var(--admin-success)]">
                  Correct
                </span>
              ) : null}
            </div>
            <div
              className={[
                "flex-1 overflow-hidden border border-[var(--admin-border)] bg-[var(--admin-surface-low)]",
                present ? "h-7 rounded-sm" : "h-7",
              ].join(" ")}
            >
              <div
                className={[
                  "h-full transition-[width] duration-200 ease-out",
                  isCorrect ? "bg-[var(--admin-success)]" : "bg-[var(--admin-primary)]",
                ].join(" ")}
                style={{
                  width: `${Math.max(0, Math.min(100, option.percent))}%`,
                  opacity: isCorrect ? 1 : opacity,
                }}
              />
            </div>
            <div
              className={[
                "shrink-0 text-right font-mono text-[var(--admin-on-surface)]",
                present
                  ? "flex w-36 items-baseline justify-end gap-3 text-xl"
                  : "flex w-32 items-baseline justify-end gap-3 text-sm",
              ].join(" ")}
            >
              <span>{option.count.toLocaleString()}</span>
              <span className="w-12 text-[var(--admin-on-surface-variant)]">
                {formatPct(option.percent)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EventLog({ events, closed }: { events: PollTimelineEvent[]; closed: boolean }) {
  return (
    <div className="flex h-64 flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-3">
        <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
          {closed ? "Final event log" : "Event log"}
        </h2>
      </div>
      <div
        className={[
          "flex flex-1 flex-col gap-0.5 overflow-y-auto p-3",
          closed ? "opacity-80" : "",
        ].join(" ")}
      >
        {events.length === 0 ? (
          <p className="px-2 py-2 text-xs text-[var(--admin-on-surface-variant)]">No events yet.</p>
        ) : (
          [...events].reverse().map((event, index) => (
            <div
              key={`${event.kind}-${event.at}-${index}`}
              className="flex items-start gap-3 rounded-sm px-2 py-1.5 hover:bg-[var(--admin-surface-high)]"
            >
              <span className="pt-0.5 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                {formatClock(event.at)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[var(--admin-on-surface-variant)]">{event.label}</p>
                {event.detail ? (
                  <p className="text-[11px] text-[var(--admin-on-surface-variant)] opacity-80">
                    {event.detail}
                  </p>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
      {closed ? (
        <div className="border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-2 text-center">
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--admin-on-surface-variant)]">
            End of log
          </span>
        </div>
      ) : null}
    </div>
  );
}

function PresentModeView({
  data,
  showCorrect,
  onExit,
}: {
  data: PollLiveMonitor;
  showCorrect: boolean;
  onExit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[var(--admin-bg)] text-[var(--admin-on-surface)]">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          {data.isOpen ? (
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] px-2 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--admin-success)]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--admin-success)]" />
              Live
            </span>
          ) : (
            <span className="rounded-sm border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] px-2 py-1 font-mono text-[11px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              Closed
            </span>
          )}
          {data.isOpen && data.secondsRemaining != null ? (
            <span className="font-mono text-sm text-[var(--admin-on-surface-variant)]">
              Closes in{" "}
              <span className="text-[var(--admin-warning)]">
                {formatCountdown(data.secondsRemaining)}
              </span>
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className={secondaryButtonClassName}
          onClick={onExit}
          aria-label="Exit present mode"
        >
          <Minimize2 className="h-4 w-4" aria-hidden="true" />
          Exit present
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col items-center justify-center gap-16 px-8 pb-16">
        <h1 className="max-w-4xl text-center text-4xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)] md:text-5xl">
          {data.title}
        </h1>

        <div className="flex w-full max-w-2xl flex-col items-center gap-6">
          <div className="flex items-end justify-center gap-6">
            <span className="font-mono text-6xl font-medium leading-none text-[var(--admin-primary)] md:text-7xl">
              {data.totalResponses.toLocaleString()}
            </span>
            <span className="pb-2 text-2xl text-[var(--admin-on-surface-variant)]">
              {data.eligibleCount != null
                ? `of ${data.eligibleCount.toLocaleString()} answered`
                : "answered"}
            </span>
          </div>
          {data.participationPct != null ? (
            <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
              <div
                className="h-full bg-[var(--admin-primary)] transition-[width] duration-700 ease-out"
                style={{
                  width: `${Math.max(0, Math.min(100, data.participationPct))}%`,
                }}
              />
            </div>
          ) : null}
        </div>

        <div className="w-full max-w-4xl">
          <OptionBars options={data.options} showCorrect={showCorrect} present />
        </div>
      </div>
    </div>
  );
}

export function AdminPollLiveMonitorPage({ pollId }: { pollId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const present = searchParams.get("present") === "1";

  const [data, setData] = useState<PollLiveMonitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revealCorrect, setRevealCorrect] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [localRemaining, setLocalRemaining] = useState<number | null>(null);
  const skewRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const setPresent = useCallback(
    (next: boolean) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("present", "1");
      else params.delete("present");
      const qs = params.toString();
      router.replace(
        qs ? `/admin/reports/polls/${pollId}/live?${qs}` : `/admin/reports/polls/${pollId}/live`,
        { scroll: false },
      );
    },
    [pollId, router, searchParams],
  );

  const applySnapshot = useCallback((snapshot: PollLiveMonitor) => {
    setData(snapshot);
    const serverMs = new Date(snapshot.serverNow).getTime();
    if (!Number.isNaN(serverMs)) {
      skewRef.current = serverMs - Date.now();
    }
    setLocalRemaining(snapshot.secondsRemaining);
    setError(null);
  }, []);

  const load = useCallback(
    async (opts?: { quiet?: boolean }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (!opts?.quiet) setLoading(true);
      try {
        const response = await fetchPollLiveMonitor(pollId);
        if (controller.signal.aborted) return;
        applySnapshot(response.data);
      } catch (err) {
        if (controller.signal.aborted) return;
        const message =
          err instanceof ClientApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to load live poll monitor.";
        setError(message);
      } finally {
        if (!controller.signal.aborted && !opts?.quiet) setLoading(false);
      }
    },
    [applySnapshot, pollId],
  );

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  useEffect(() => {
    if (!data?.isOpen) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void load({ quiet: true });
    }, POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [data?.isOpen, load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const skewedNow = Date.now() + skewRef.current;
      setNowMs(skewedNow);
      if (data?.isOpen && data.closesAt) {
        const remaining = Math.max(
          0,
          Math.ceil((new Date(data.closesAt).getTime() - skewedNow) / 1000),
        );
        setLocalRemaining(remaining);
      }
    }, 250);
    return () => {
      window.clearInterval(id);
    };
  }, [data?.closesAt, data?.isOpen]);

  useEffect(() => {
    if (!present) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPresent(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [present, setPresent]);

  const showCorrect = Boolean(
    data && (data.showCorrectAnswers || (data.quizMode && revealCorrect)),
  );

  const handleClose = async () => {
    if (!window.confirm("Close this poll now? Learners will no longer be able to vote.")) {
      return;
    }
    setBusy(true);
    try {
      const response = await closePollLive(pollId);
      applySnapshot(response.data);
    } catch (err) {
      const message =
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to close poll.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleExtend = async () => {
    setBusy(true);
    try {
      const response = await extendPollLive(pollId, 30);
      applySnapshot(response.data);
    } catch (err) {
      const message =
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to extend poll.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async () => {
    setBusy(true);
    try {
      const queued = await exportPollReport({ pollId, emailDownloadLink: false });
      const completed = await pollReportRunUntilComplete(queued.data.runId);
      if (completed.status === "failed") {
        throw new Error(completed.errorMessage ?? "Export failed.");
      }
      if (completed.status === "completed") {
        await downloadReportExport(completed.id, "csv");
      }
    } catch (err) {
      const message =
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Export failed.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16" aria-busy="true">
        <Shimmer className="h-3 w-80" />
        <Shimmer className="h-10 w-96 max-w-full" />
        <div className="grid gap-8 lg:grid-cols-12">
          <Shimmer className="h-72 lg:col-span-8" />
          <Shimmer className="h-72 lg:col-span-4" />
        </div>
        <div className="grid gap-8 lg:grid-cols-12">
          <Shimmer className="h-64 lg:col-span-8" />
          <Shimmer className="h-64 lg:col-span-4" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 pb-16">
        <div
          className="flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-4 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
            <p className="text-sm text-[var(--admin-danger)]">{error}</p>
          </div>
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--admin-danger)] px-4 text-xs font-semibold text-[var(--admin-on-danger)]"
            onClick={() => void load()}
          >
            Retry
          </button>
        </div>
        <Link href={`/admin/reports/polls/${pollId}`} className={ghostButtonClassName}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to poll report
        </Link>
      </div>
    );
  }

  if (!data) return null;

  if (present) {
    return (
      <PresentModeView
        data={{ ...data, secondsRemaining: localRemaining }}
        showCorrect={showCorrect}
        onExit={() => {
          setPresent(false);
        }}
      />
    );
  }

  const isOpen = data.isOpen;
  const remaining = localRemaining ?? data.secondsRemaining;

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
        <Link href={`/admin/reports/polls/${pollId}`} className="hover:text-[var(--admin-primary)]">
          {data.title}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium text-[var(--admin-on-surface)]">Live monitor</span>
      </nav>

      {error ? (
        <div
          className="flex items-start gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-3"
          role="alert"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-danger)]"
            aria-hidden="true"
          />
          <p className="text-sm text-[var(--admin-danger)]">{error}</p>
          <button
            type="button"
            className="ml-auto text-xs font-medium text-[var(--admin-danger)]"
            onClick={() => {
              setError(null);
            }}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 border-b border-[var(--admin-border)] pb-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0 flex-1">
          <Link
            href={`/admin/reports/polls/${pollId}`}
            className={`${ghostButtonClassName} mb-3 inline-flex`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Full report
          </Link>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            {isOpen ? (
              <span className="inline-flex items-center gap-1.5 rounded-sm border border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] px-2 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--admin-success)]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--admin-success)]" />
                Live
              </span>
            ) : (
              <span className="rounded-sm border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                Closed
              </span>
            )}
            {!isOpen && data.closedAt ? (
              <span className="text-xs text-[var(--admin-on-surface-variant)]">
                Closed {formatClock(data.closedAt)}
                {data.ranForSeconds != null
                  ? ` · ran for ${formatSeconds(data.ranForSeconds)}`
                  : ""}
              </span>
            ) : null}
            {data.anonymousVote ? (
              <span className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                Anonymous
              </span>
            ) : (
              <span className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                Identified
              </span>
            )}
          </div>
          <h1 className="text-[28px] font-semibold leading-8 tracking-[-0.01em] text-[var(--admin-on-surface)]">
            {data.title}
          </h1>
          {data.description ? (
            <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
              {data.description}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          {isOpen ? (
            <div className="font-mono text-xl font-medium text-[var(--admin-on-surface)]">
              Closes in{" "}
              <span
                className={
                  remaining != null && remaining <= 15
                    ? "text-[var(--admin-danger)]"
                    : "text-[var(--admin-warning)]"
                }
              >
                {formatCountdown(remaining)}
              </span>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={secondaryButtonClassName}
              disabled={busy}
              onClick={() => void load()}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </button>
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={() => {
                setPresent(true);
              }}
            >
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
              Present mode
            </button>
            {isOpen ? (
              <>
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  disabled={busy}
                  onClick={() => void handleExtend()}
                >
                  <Timer className="h-4 w-4" aria-hidden="true" />
                  Extend by 30s
                </button>
                <button
                  type="button"
                  className={dangerButtonClassName}
                  disabled={busy}
                  onClick={() => void handleClose()}
                >
                  <StopCircle className="h-4 w-4" aria-hidden="true" />
                  Close poll now
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  disabled={busy}
                  onClick={() => void handleExport()}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  {busy ? "Exporting..." : "Export CSV"}
                </button>
                <Link href={`/admin/reports/polls/${pollId}`} className={primaryButtonClassName}>
                  Open full report
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {isOpen ? (
        <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-mono text-[44px] font-medium leading-none text-[var(--admin-on-surface)]">
                {data.totalResponses.toLocaleString()}
              </span>
              <span className="text-base font-semibold text-[var(--admin-on-surface-variant)]">
                {data.eligibleCount != null
                  ? `of ${data.eligibleCount.toLocaleString()} answered`
                  : "answered"}
              </span>
            </div>
            <div className="text-right">
              <div className="font-mono text-xl font-medium text-[var(--admin-on-surface)]">
                {formatPct(data.participationPct)}
              </div>
              {data.recentResponseCount > 0 ? (
                <div className="mt-1 flex items-center justify-end gap-1 text-xs text-[var(--admin-success)]">
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />+
                  {data.recentResponseCount} in the last 10 seconds
                </div>
              ) : (
                <div className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                  No new answers in the last 10s
                </div>
              )}
            </div>
          </div>
          {data.participationPct != null ? (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
              <div
                className="h-full bg-[var(--admin-primary)] transition-[width] duration-200 ease-out"
                style={{
                  width: `${Math.max(0, Math.min(100, data.participationPct))}%`,
                }}
              />
            </div>
          ) : (
            <p className="text-xs text-[var(--admin-on-surface-variant)]">
              Participation rate needs a known audience (live session attendance).
            </p>
          )}
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <section className="flex flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-8">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--admin-on-surface)]">
              <BarChart3 className="h-5 w-5 text-[var(--admin-primary)]" aria-hidden="true" />
              {isOpen ? "Live results" : "Final results"}
            </h2>
            <span className="text-xs text-[var(--admin-on-surface-variant)]">
              Total respondents: {data.totalResponses.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col gap-4 p-5">
            {data.quizMode && isOpen && !data.showCorrectAnswers ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] pb-4">
                <p className="flex items-center gap-1.5 text-xs text-[var(--admin-on-surface-variant)]">
                  {revealCorrect ? (
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {revealCorrect
                    ? "Correct answer revealed on this screen only."
                    : "Correct answer hidden until the poll closes."}
                </p>
                <button
                  type="button"
                  className="inline-flex h-8 items-center rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] px-3 text-xs font-medium text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                  onClick={() => {
                    setRevealCorrect((value) => !value);
                  }}
                >
                  {revealCorrect ? "Hide correct answer" : "Reveal correct answer"}
                </button>
              </div>
            ) : null}
            {data.description || data.title ? (
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                Q: {data.description?.trim() || data.title}
              </p>
            ) : null}
            <OptionBars options={data.options} showCorrect={showCorrect} dense={!isOpen} />
          </div>
        </section>

        <section className="flex flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-4">
          <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-3">
            <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
              Participation metrics
            </h2>
          </div>
          <div className="flex flex-col gap-6 p-5">
            <div>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                Total participation
              </span>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
                  {data.totalResponses.toLocaleString()}
                </span>
                {data.eligibleCount != null ? (
                  <span className="text-sm text-[var(--admin-on-surface-variant)]">
                    / {data.eligibleCount.toLocaleString()} eligible
                  </span>
                ) : null}
              </div>
              {data.participationPct != null ? (
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                  <div
                    className="h-full bg-[var(--admin-primary)]"
                    style={{
                      width: `${Math.max(0, Math.min(100, data.participationPct))}%`,
                    }}
                  />
                </div>
              ) : null}
            </div>
            <hr className="border-[var(--admin-border)]" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                  Avg answer time
                </span>
                <span className="font-mono text-lg text-[var(--admin-on-surface)]">
                  {formatSeconds(data.avgResponseSeconds)}
                </span>
              </div>
              <div>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                  Recent pace
                </span>
                <span className="font-mono text-lg text-[var(--admin-on-surface)]">
                  {data.recentResponseCount}/10s
                </span>
              </div>
              <div>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                  Correct ratio
                </span>
                <span
                  className={[
                    "font-mono text-lg",
                    data.correctPct != null && showCorrect
                      ? "font-medium text-[var(--admin-success)]"
                      : "text-[var(--admin-on-surface)]",
                  ].join(" ")}
                >
                  {data.quizMode ? (showCorrect ? formatPct(data.correctPct) : "Hidden") : "-"}
                </span>
              </div>
              <div>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                  Duration
                </span>
                <span className="font-mono text-lg text-[var(--admin-on-surface)]">
                  {isOpen
                    ? formatSeconds(data.durationSeconds)
                    : formatSeconds(data.ranForSeconds ?? data.durationSeconds)}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-[var(--admin-on-surface-variant)]">
              Drop-off and peak concurrency are not tracked yet for polls.
            </p>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-8 pb-4 lg:grid-cols-12">
        <section className="relative h-64 overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-8">
          <VelocityChart
            points={data.timeline.points}
            label={isOpen ? "Live" : "Static final state"}
          />
        </section>

        {isOpen && !data.anonymousVote ? (
          <section className="flex h-64 flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-4">
            <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-on-surface)]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--admin-success)]" />
                Answering now
              </h2>
              <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                Live feed
              </span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {data.recentAnswers.length === 0 ? (
                <p className="text-xs text-[var(--admin-on-surface-variant)]">
                  Waiting for answers…
                </p>
              ) : (
                data.recentAnswers.map((answer, index) => {
                  const opacity = Math.max(0.35, 1 - index * 0.08);
                  return (
                    <div
                      key={`${answer.membershipId ?? "x"}-${answer.respondedAt}-${index}`}
                      className="flex items-center justify-between gap-2 text-sm"
                      style={{ opacity }}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--admin-primary-container)] text-[10px] font-bold text-[var(--admin-primary-strong)]">
                          {learnerInitials(answer.learnerName)}
                        </div>
                        <span className="w-24 truncate font-medium text-[var(--admin-on-surface)]">
                          {answer.learnerName ?? "Learner"}
                        </span>
                        <span className="max-w-[100px] truncate rounded-sm bg-[var(--admin-surface-high)] px-2 py-0.5 text-xs text-[var(--admin-on-surface)]">
                          {answer.optionLabel}
                        </span>
                      </div>
                      <span className="shrink-0 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                        {formatRelativeAgo(answer.respondedAt, nowMs)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        ) : (
          <div className="lg:col-span-4">
            <EventLog events={data.events} closed={!isOpen} />
          </div>
        )}
      </div>

      {isOpen && !data.anonymousVote ? <EventLog events={data.events} closed={false} /> : null}

      {isOpen && data.anonymousVote ? (
        <p className="text-xs text-[var(--admin-on-surface-variant)]">
          Learner feed is hidden because this poll is anonymous. Aggregate results still update
          live.
        </p>
      ) : null}
    </div>
  );
}
