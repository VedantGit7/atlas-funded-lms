"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  Mail,
  Maximize2,
  Minimize2,
  RefreshCw,
  Search,
  Send,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  fetchLiveClassSessionLiveMonitor,
  sendLiveClassAttendanceMessage,
  type LiveClassSessionLiveMonitor,
} from "./admin-live-class-attendance-roster-api";

const POLL_INTERVAL_MS = 2500;

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const fieldClassName =
  "h-9 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

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

function formatClock(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function formatRelativeAgo(iso: string, nowMs: number): string {
  const delta = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 1000));
  if (delta < 1) return "just now";
  if (delta < 60) return `${delta}s ago`;
  const mins = Math.floor(delta / 60);
  return `${mins}m ago`;
}

function defined<T>(value: T, message = "Expected value to be defined"): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

function learnerInitials(name: string | null): string {
  const source = (name?.trim() || "?").replace(/\s+/g, " ");
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${defined(parts[0])[0] ?? ""}${defined(parts[1])[0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function isLiveStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return normalized === "live" || normalized === "in_progress";
}

function defaultJoinReminderSubject(title: string): string {
  return `Join now: ${title}`;
}

function defaultJoinReminderBody(title: string): string {
  return `Hi {{learner_name}},

We're live now for {{session_title}} (${title}). Join us if you can!

A recording will be available at {{recording_link}} after the session.`;
}

function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger" | "muted";
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
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function ConcurrencyChart({
  points,
  plannedMinutes,
  asOfOffsetMinutes,
  frozen,
  label,
  clipId,
}: {
  points: Array<{ offsetMinutes: number; concurrent: number }>;
  plannedMinutes: number;
  asOfOffsetMinutes: number;
  frozen: boolean;
  label?: string;
  clipId?: string;
}) {
  const width = 640;
  const height = 180;
  const pad = { top: 16, right: 12, bottom: 28, left: 36 };
  const maxX = Math.max(plannedMinutes, asOfOffsetMinutes, 1);
  const visiblePoints = frozen
    ? points
    : points.filter((p) => p.offsetMinutes <= asOfOffsetMinutes);
  const maxY = Math.max(1, ...visiblePoints.map((p) => p.concurrent), 1);
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const clipPathId = clipId ?? "concurrency-clip";

  const xAt = (offset: number) => pad.left + (offset / maxX) * plotW;
  const yAt = (concurrent: number) => pad.top + plotH - (concurrent / maxY) * plotH;

  const coords = visiblePoints.map((point) => ({
    x: xAt(point.offsetMinutes),
    y: yAt(point.concurrent),
    ...point,
  }));

  let linePath = "";
  let areaPath = "";
  if (coords.length > 0) {
    linePath = coords
      .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
      .join(" ");
    const first = defined(coords[0]);
    const last = defined(coords[coords.length - 1]);
    areaPath = `${linePath} L${last.x.toFixed(1)},${(pad.top + plotH).toFixed(1)} L${first.x.toFixed(1)},${(pad.top + plotH).toFixed(1)} Z`;
  }

  const clipX = frozen ? pad.left + plotW : xAt(asOfOffsetMinutes);
  const strokeColor = frozen ? "var(--admin-outline)" : "var(--admin-primary)";
  const fillColor = frozen
    ? "color-mix(in srgb, var(--admin-outline) 18%, transparent)"
    : "color-mix(in srgb, var(--admin-primary) 18%, transparent)";

  const peak = coords.reduce<(typeof coords)[number] | null>((best, c) => {
    if (!best || c.concurrent > best.concurrent) return c;
    return best;
  }, null);

  const tickCount = Math.min(5, Math.max(2, Math.ceil(maxX / 15)));
  const xTicks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round((maxX * i) / tickCount),
  );

  return (
    <div className="relative h-full w-full">
      {label ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 py-4">
          <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
            Concurrent attendance
          </h2>
          <span className="text-xs text-[var(--admin-on-surface-variant)]">{label}</span>
        </div>
      ) : null}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full pt-10"
        role="img"
        aria-label="Concurrent attendance over session time"
      >
        <defs>
          <clipPath id={clipPathId}>
            <rect x={pad.left} y={pad.top} width={clipX - pad.left} height={plotH} />
          </clipPath>
        </defs>
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
        <g clipPath={`url(#${clipPathId})`}>
          {areaPath ? <path d={areaPath} fill={fillColor} /> : null}
          {linePath ? (
            <path
              d={linePath}
              fill="none"
              stroke={strokeColor}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
        </g>
        {!frozen && asOfOffsetMinutes > 0 ? (
          <line
            x1={xAt(asOfOffsetMinutes)}
            x2={xAt(asOfOffsetMinutes)}
            y1={pad.top}
            y2={pad.top + plotH}
            stroke="var(--admin-primary)"
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={0.6}
          />
        ) : null}
        {plannedMinutes > 0 ? (
          <>
            <line
              x1={xAt(plannedMinutes)}
              x2={xAt(plannedMinutes)}
              y1={pad.top}
              y2={pad.top + plotH}
              stroke="var(--admin-border)"
              strokeWidth={1}
            />
            <text
              x={xAt(plannedMinutes)}
              y={height - 8}
              textAnchor="middle"
              className="fill-[var(--admin-on-surface-variant)]"
              style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}
            >
              Sch
            </text>
          </>
        ) : null}
        {xTicks.map((tick) => (
          <text
            key={tick}
            x={xAt(tick)}
            y={height - (plannedMinutes > 0 ? 20 : 8)}
            textAnchor="middle"
            className="fill-[var(--admin-on-surface-variant)]"
            style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}
          >
            {tick}m
          </text>
        ))}
        {peak && peak.concurrent > 0 && frozen ? (
          <>
            <circle
              cx={peak.x}
              cy={peak.y}
              r={4}
              fill="var(--admin-surface)"
              stroke={strokeColor}
              strokeWidth={2}
            />
            <text
              x={peak.x}
              y={Math.max(pad.top + 10, peak.y - 10)}
              textAnchor="middle"
              className="fill-[var(--admin-on-surface-variant)]"
              style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}
            >
              Peak {peak.offsetMinutes}m
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

function PresenceGrid({
  presence,
  sessionId,
  compact,
}: {
  presence: LiveClassSessionLiveMonitor["presence"];
  sessionId: string;
  compact?: boolean;
}) {
  const counts = useMemo(() => {
    let present = 0;
    let left = 0;
    let notJoined = 0;
    for (const item of presence) {
      if (item.state === "present") present += 1;
      else if (item.state === "left") left += 1;
      else notJoined += 1;
    }
    return { present, left, notJoined };
  }, [presence]);

  if (presence.length === 0) {
    return (
      <p className="text-sm text-[var(--admin-on-surface-variant)]">
        No registrants for this session.
      </p>
    );
  }

  const squareSize = compact ? "h-3 w-3" : "h-4 w-4";

  return (
    <div className="flex flex-col gap-4">
      <div className={["flex flex-wrap gap-1", compact ? "gap-0.5" : "gap-1"].join(" ")}>
        {presence.map((item) => {
          const href = `/admin/reports/live-class-attendance/${sessionId}/attendees/${item.attendeeId}`;
          const stateLabel =
            item.state === "present" ? "Present" : item.state === "left" ? "Left" : "Not joined";
          const title = `${item.learnerName ?? item.email ?? "Learner"} · ${stateLabel}`;
          const colorClass =
            item.state === "present"
              ? "bg-[var(--admin-success)] border-[var(--admin-success)]"
              : item.state === "left"
                ? "bg-[var(--admin-warning)] border-[var(--admin-warning)]"
                : "bg-transparent border-[var(--admin-outline)]";
          return (
            <Link
              key={item.membershipId}
              href={href}
              title={title}
              aria-label={`${title} — open attendee detail`}
              className={[
                squareSize,
                "rounded-sm border transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30",
                colorClass,
              ].join(" ")}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--admin-on-surface-variant)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-[var(--admin-success)]" aria-hidden="true" />
          Present ({counts.present})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-[var(--admin-warning)]" aria-hidden="true" />
          Left ({counts.left})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-sm border border-[var(--admin-outline)] bg-transparent"
            aria-hidden="true"
          />
          Not joined ({counts.notJoined})
        </span>
      </div>
    </div>
  );
}

function ActivityTicker({
  events,
  nowMs,
}: {
  events: LiveClassSessionLiveMonitor["recentEvents"];
  nowMs: number;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-3">
        <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">Activity ticker</h2>
      </div>
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
        {events.length === 0 ? (
          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            No join/leave events yet.
          </p>
        ) : (
          events.map((event, index) => {
            const joined = event.kind === "joined";
            return (
              <div
                key={`${event.membershipId}-${event.at}-${index}`}
                className="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 hover:bg-[var(--admin-surface-high)]"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--admin-primary-container)] text-[10px] font-bold text-[var(--admin-primary-strong)]">
                    {learnerInitials(event.learnerName)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--admin-on-surface)]">
                      {event.learnerName ?? event.email ?? "Learner"}
                    </p>
                    <span
                      className={[
                        "inline-flex rounded-sm border px-1.5 py-px font-mono text-[10px] font-medium uppercase tracking-wide",
                        joined
                          ? "border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]"
                          : "border-[var(--admin-outline)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
                      ].join(" ")}
                    >
                      {joined ? "Joined" : "Left"}
                    </span>
                  </div>
                </div>
                <span className="shrink-0 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                  {formatRelativeAgo(event.at, nowMs)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function RemindModal({
  open,
  title,
  count,
  subject,
  body,
  busy,
  error,
  onSubjectChange,
  onBodyChange,
  onClose,
  onSend,
}: {
  open: boolean;
  title: string;
  count: number;
  subject: string;
  body: string;
  busy: boolean;
  error: string | null;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onClose: () => void;
  onSend: () => void;
}) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, busy, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_25%,transparent)] p-4 backdrop-blur-[1px]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close reminder dialog overlay"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        className="admin-theme relative z-10 flex w-full max-w-lg flex-col rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-start justify-between border-b border-[var(--admin-border)] px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-[var(--admin-on-surface)]">
              Send reminder
            </h2>
            <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
              {count} learner{count === 1 ? "" : "s"} · {title}
            </p>
          </div>
          <button
            type="button"
            className="rounded-full p-2 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          {error ? (
            <div
              className="rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-3 py-2 text-sm text-[var(--admin-danger)]"
              role="alert"
            >
              {error}
            </div>
          ) : null}
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-[var(--admin-on-surface-variant)]">
              Subject
            </span>
            <input
              className={fieldClassName}
              value={subject}
              onChange={(e) => {
                onSubjectChange(e.target.value);
              }}
              maxLength={200}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-[var(--admin-on-surface-variant)]">
              Message
            </span>
            <textarea
              className="min-h-[140px] w-full resize-none rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-[13px] text-[var(--admin-on-surface)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]"
              value={body}
              onChange={(e) => {
                onBodyChange(e.target.value);
              }}
              maxLength={10000}
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--admin-border)] px-5 py-4">
          <button type="button" className={ghostButtonClassName} disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={busy || count === 0 || !subject.trim() || !body.trim()}
            onClick={onSend}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {busy ? "Sending…" : `Send to ${count}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PresentModeView({
  data,
  sessionId,
  elapsedDisplay,
  onExit,
}: {
  data: LiveClassSessionLiveMonitor;
  sessionId: string;
  elapsedDisplay: number | null;
  onExit: () => void;
}) {
  const live = !data.frozen && isLiveStatus(data.status);
  const chartClipId = useId();

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-[var(--admin-bg)] text-[var(--admin-on-surface)]"
      style={{
        backgroundImage:
          "radial-gradient(circle, color-mix(in srgb, var(--admin-border) 80%, transparent) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      <div className="relative z-10 flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          {live ? (
            <span className="inline-flex items-center gap-2 font-mono text-[13px] font-semibold uppercase tracking-widest text-[var(--admin-danger)]">
              <span className="motion-safe:animate-pulse h-3 w-3 rounded-full bg-[var(--admin-danger)]" />
              Live session
            </span>
          ) : (
            <span className="rounded-sm border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-2 py-1 font-mono text-[11px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              {data.frozen ? "Ended" : "Standby"}
            </span>
          )}
          {elapsedDisplay != null ? (
            <span className="font-mono text-sm text-[var(--admin-on-surface-variant)]">
              {formatDuration(elapsedDisplay)}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]"
          onClick={onExit}
          aria-label="Exit present mode"
        >
          <Minimize2 className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <main className="relative z-10 mx-auto flex h-full w-full max-w-[1920px] flex-1 flex-col gap-8 px-8 pb-8">
        <header className="flex flex-col justify-between gap-6 border-b border-[var(--admin-border)] pb-6 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <h1 className="text-4xl font-bold tracking-tight text-[var(--admin-on-surface)] md:text-[40px] md:leading-[48px]">
              {data.title}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
              {data.courseTitle ? <span>{data.courseTitle}</span> : null}
              {data.courseTitle && data.batchName ? (
                <span className="text-[var(--admin-outline)]" aria-hidden="true">
                  |
                </span>
              ) : null}
              {data.batchName ? <span>{data.batchName}</span> : null}
              {data.scheduledAt ? (
                <>
                  <span className="text-[var(--admin-outline)]" aria-hidden="true">
                    |
                  </span>
                  <span>{formatClock(data.scheduledAt)}</span>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-start lg:items-end">
            <span className="mb-1 font-mono text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
              Current turnout
            </span>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-5xl font-bold leading-none text-[var(--admin-primary)] md:text-[64px]">
                {data.turnout.joinedCount.toLocaleString()}
              </span>
              <span className="font-mono text-sm text-[var(--admin-on-surface-variant)]">
                / {data.turnout.registeredCount.toLocaleString()}
              </span>
            </div>
            {data.turnout.ratePct != null ? (
              <div className="mt-3 h-1 w-full min-w-[200px] overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
                <div
                  className="h-full bg-[var(--admin-primary)] transition-[width] duration-700 ease-out"
                  style={{
                    width: `${Math.max(0, Math.min(100, data.turnout.ratePct))}%`,
                  }}
                />
              </div>
            ) : null}
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-8 lg:grid-cols-12">
          <section className="flex flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 lg:col-span-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                Concurrency over time
              </h2>
              <span className="inline-flex items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]">
                <span
                  className="h-2 w-2 rounded-full bg-[var(--admin-primary)]"
                  aria-hidden="true"
                />
                Active learners
              </span>
            </div>
            <div className="min-h-[220px] flex-1">
              <ConcurrencyChart
                points={data.timeline.points}
                plannedMinutes={data.timeline.plannedMinutes}
                asOfOffsetMinutes={data.timeline.asOfOffsetMinutes}
                frozen={data.frozen}
                clipId={chartClipId}
              />
            </div>
          </section>
          <section className="flex flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 lg:col-span-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                Presence grid
              </h2>
              <StatusPill tone={live ? "success" : "muted"}>
                {live ? "Live" : data.frozen ? "Frozen" : "Stable"}
              </StatusPill>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <PresenceGrid presence={data.presence} sessionId={sessionId} compact />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export function AdminLiveClassAttendanceLiveMonitorPage({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presentMode = searchParams.get("present") === "1";

  const [data, setData] = useState<LiveClassSessionLiveMonitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMembershipIds, setSelectedMembershipIds] = useState<Set<string>>(new Set());
  const [presenceSearch, setPresenceSearch] = useState("");
  const [tickNow, setTickNow] = useState(() => Date.now());
  const [remindOpen, setRemindOpen] = useState(false);
  const [remindIds, setRemindIds] = useState<string[]>([]);
  const [remindSubject, setRemindSubject] = useState("");
  const [remindBody, setRemindBody] = useState("");
  const [remindBusy, setRemindBusy] = useState(false);
  const [remindError, setRemindError] = useState<string | null>(null);

  const skewRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const baseElapsedRef = useRef<number | null>(null);
  const loadedAtRef = useRef<number>(Date.now());

  const setPresent = useCallback(
    (next: boolean) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("present", "1");
      else params.delete("present");
      const qs = params.toString();
      router.replace(
        qs
          ? `/admin/reports/live-class-attendance/${sessionId}/live?${qs}`
          : `/admin/reports/live-class-attendance/${sessionId}/live`,
        { scroll: false },
      );
    },
    [router, searchParams, sessionId],
  );

  const applySnapshot = useCallback((snapshot: LiveClassSessionLiveMonitor) => {
    setData(snapshot);
    const serverMs = new Date(snapshot.serverNow).getTime();
    if (!Number.isNaN(serverMs)) {
      skewRef.current = serverMs - Date.now();
    }
    baseElapsedRef.current = snapshot.elapsedSeconds;
    loadedAtRef.current = Date.now();
    setError(null);
  }, []);

  const load = useCallback(
    async (opts?: { quiet?: boolean }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (!opts?.quiet) setLoading(true);
      else setRefreshing(true);
      try {
        const response = await fetchLiveClassSessionLiveMonitor(sessionId);
        if (controller.signal.aborted) return;
        applySnapshot(response.data);
      } catch (err) {
        if (controller.signal.aborted) return;
        const message =
          err instanceof ClientApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to load live session monitor.";
        setError(message);
      } finally {
        if (!controller.signal.aborted) {
          if (!opts?.quiet) setLoading(false);
          else setRefreshing(false);
        }
      }
    },
    [applySnapshot, sessionId],
  );

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  useEffect(() => {
    if (!data || data.frozen) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void load({ quiet: true });
    }, POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [data?.frozen, load]);

  useEffect(() => {
    if (!data || data.frozen) return;
    const id = window.setInterval(() => {
      setTickNow(Date.now() + skewRef.current);
    }, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, [data?.frozen]);

  useEffect(() => {
    if (!presentMode) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPresent(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [presentMode, setPresent]);

  const elapsedDisplay = useMemo(() => {
    if (!data) return null;
    if (data.frozen) return data.ranForSeconds;
    if (baseElapsedRef.current == null) return data.elapsedSeconds;
    const delta = Math.floor((Date.now() + skewRef.current - loadedAtRef.current) / 1000);
    return baseElapsedRef.current + Math.max(0, delta);
  }, [data, tickNow]);

  const filteredPresence = useMemo(() => {
    if (!data) return [];
    const q = presenceSearch.trim().toLowerCase();
    if (!q) return data.presence;
    return data.presence.filter(
      (item) =>
        (item.learnerName?.toLowerCase().includes(q) ?? false) ||
        (item.email?.toLowerCase().includes(q) ?? false),
    );
  }, [data, presenceSearch]);

  function openRemind(membershipIds: string[]) {
    if (!data || membershipIds.length === 0) return;
    setRemindIds(membershipIds);
    setRemindSubject(defaultJoinReminderSubject(data.title));
    setRemindBody(defaultJoinReminderBody(data.title));
    setRemindError(null);
    setRemindOpen(true);
  }

  async function handleSendRemind() {
    if (!data || remindIds.length === 0 || !remindSubject.trim() || !remindBody.trim()) return;
    setRemindBusy(true);
    setRemindError(null);
    try {
      await sendLiveClassAttendanceMessage({
        sessionId,
        audience: "selected",
        membershipIds: remindIds,
        subject: remindSubject.trim(),
        message: remindBody.trim(),
        channels: ["email", "in_app"],
      });
      setRemindOpen(false);
      setRemindIds([]);
      setSelectedMembershipIds(new Set());
    } catch (err) {
      const message =
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't send reminder.";
      setRemindError(message);
    } finally {
      setRemindBusy(false);
    }
  }

  function toggleSelect(membershipId: string) {
    setSelectedMembershipIds((current) => {
      const next = new Set(current);
      if (next.has(membershipId)) next.delete(membershipId);
      else next.add(membershipId);
      return next;
    });
  }

  function toggleSelectAllNotJoined() {
    if (!data) return;
    const ids = data.notYetJoined.map((row) => row.membershipId);
    if (ids.every((id) => selectedMembershipIds.has(id))) {
      setSelectedMembershipIds(new Set());
    } else {
      setSelectedMembershipIds(new Set(ids));
    }
  }

  if (loading && !data) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16" aria-busy="true">
        <Shimmer className="h-3 w-80" />
        <Shimmer className="h-10 w-96 max-w-full" />
        <Shimmer className="h-32 w-full" />
        <div className="grid gap-8 lg:grid-cols-12">
          <Shimmer className="h-72 lg:col-span-8" />
          <Shimmer className="h-72 lg:col-span-4" />
        </div>
        <Shimmer className="h-48 w-full" />
        <Shimmer className="h-64 w-full" />
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
          <button type="button" className={secondaryButtonClassName} onClick={() => void load()}>
            Retry
          </button>
        </div>
        <Link
          href={`/admin/reports/live-class-attendance/${sessionId}`}
          className={ghostButtonClassName}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to session report
        </Link>
      </div>
    );
  }

  if (!data) return null;

  if (presentMode) {
    return (
      <>
        <PresentModeView
          data={data}
          sessionId={sessionId}
          elapsedDisplay={elapsedDisplay}
          onExit={() => {
            setPresent(false);
          }}
        />
        <RemindModal
          open={remindOpen}
          title={data.title}
          count={remindIds.length}
          subject={remindSubject}
          body={remindBody}
          busy={remindBusy}
          error={remindError}
          onSubjectChange={setRemindSubject}
          onBodyChange={setRemindBody}
          onClose={() => {
            if (!remindBusy) setRemindOpen(false);
          }}
          onSend={() => void handleSendRemind()}
        />
      </>
    );
  }

  const live = !data.frozen && isLiveStatus(data.status);
  const reportHref = `/admin/reports/live-class-attendance/${sessionId}`;

  if (data.frozen) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
        <nav
          className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]"
          aria-label="Breadcrumb"
        >
          <Link href="/admin/reports" className="hover:text-[var(--admin-primary)]">
            Reports
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link
            href="/admin/reports/live-class-attendance"
            className="hover:text-[var(--admin-primary)]"
          >
            Live Class Attendance
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link href={reportHref} className="hover:text-[var(--admin-primary)]">
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
          </div>
        ) : null}

        <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <StatusPill tone="muted">Ended</StatusPill>
                <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                  {data.sessionId}
                </span>
              </div>
              <h1 className="text-2xl font-semibold text-[var(--admin-on-surface)]">
                {data.title}
              </h1>
              <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
                Ended {formatClock(data.endedAt)} · ran for {formatDuration(data.ranForSeconds)}
              </p>
            </div>
            <Link href={reportHref} className={primaryButtonClassName}>
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open full report
            </Link>
          </div>
        </section>

        <section className="grid gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] md:grid-cols-3">
          <div className="bg-[var(--admin-surface)] p-5">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
              Total attended
            </p>
            <p className="font-mono text-3xl font-medium text-[var(--admin-on-surface)]">
              {data.turnout.joinedCount.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
              of {data.turnout.registeredCount.toLocaleString()} registered
            </p>
          </div>
          <div className="bg-[var(--admin-surface)] p-5">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
              Peak concurrency
            </p>
            <p className="font-mono text-3xl font-medium text-[var(--admin-on-surface)]">
              {data.timeline.peakConcurrent?.toLocaleString() ?? "-"}
            </p>
            <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
              {data.timeline.peakConcurrentAt
                ? `at ${formatClock(data.timeline.peakConcurrentAt)}`
                : data.timeline.peakConcurrentOffsetMinutes != null
                  ? `at ${data.timeline.peakConcurrentOffsetMinutes}m`
                  : "-"}
            </p>
          </div>
          <div className="bg-[var(--admin-surface)] p-5">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-danger)]">
              No shows
            </p>
            <p className="font-mono text-3xl font-medium text-[var(--admin-danger)]">
              {data.turnout.notJoinedCount.toLocaleString()}
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="border-b border-[var(--admin-border)] px-5 py-3">
            <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
              Session concurrency plot
            </h2>
          </div>
          <div className="h-64 p-2">
            <ConcurrencyChart
              points={data.timeline.points}
              plannedMinutes={data.timeline.plannedMinutes}
              asOfOffsetMinutes={data.timeline.asOfOffsetMinutes}
              frozen
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
              Final presence states
            </h2>
            <div className="relative w-full max-w-xs">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <input
                className={`${fieldClassName} pl-9`}
                value={presenceSearch}
                onChange={(e) => {
                  setPresenceSearch(e.target.value);
                }}
                placeholder="Search learners…"
                aria-label="Search presence list"
              />
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {filteredPresence.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[var(--admin-on-surface-variant)]">
                {data.presence.length === 0
                  ? "No registrants recorded."
                  : "No learners match your search."}
              </p>
            ) : (
              filteredPresence.map((item) => {
                const href = `/admin/reports/live-class-attendance/${sessionId}/attendees/${item.attendeeId}`;
                const pillTone =
                  item.state === "present"
                    ? "success"
                    : item.state === "left"
                      ? "warning"
                      : "danger";
                const pillLabel =
                  item.state === "present"
                    ? "Present"
                    : item.state === "left"
                      ? "Partial"
                      : "Absent";
                return (
                  <Link
                    key={item.membershipId}
                    href={href}
                    className="flex items-center justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-3 transition-colors last:border-0 hover:bg-[var(--admin-surface-high)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--admin-on-surface)]">
                        {item.learnerName ?? item.email ?? "Learner"}
                      </p>
                      {item.email && item.learnerName ? (
                        <p className="truncate font-mono text-xs text-[var(--admin-on-surface-variant)]">
                          {item.email}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <StatusPill tone={pillTone}>{pillLabel}</StatusPill>
                      <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                        {formatDuration(item.durationSeconds)}
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
          <div className="border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-3 text-center">
            <Link
              href={reportHref}
              className="text-sm font-medium text-[var(--admin-primary)] hover:underline"
            >
              View full session report
            </Link>
          </div>
        </section>

        <RemindModal
          open={remindOpen}
          title={data.title}
          count={remindIds.length}
          subject={remindSubject}
          body={remindBody}
          busy={remindBusy}
          error={remindError}
          onSubjectChange={setRemindSubject}
          onBodyChange={setRemindBody}
          onClose={() => {
            if (!remindBusy) setRemindOpen(false);
          }}
          onSend={() => void handleSendRemind()}
        />
      </div>
    );
  }

  const allNotJoinedIds = data.notYetJoined.map((row) => row.membershipId);
  const selectedCount = selectedMembershipIds.size;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
      <nav
        className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]"
        aria-label="Breadcrumb"
      >
        <Link href="/admin/reports" className="hover:text-[var(--admin-primary)]">
          Reports
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link
          href="/admin/reports/live-class-attendance"
          className="hover:text-[var(--admin-primary)]"
        >
          Live Class Attendance
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href={reportHref} className="hover:text-[var(--admin-primary)]">
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
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 border-b border-[var(--admin-border)] pb-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] font-semibold leading-8 tracking-[-0.01em] text-[var(--admin-on-surface)]">
            {data.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {data.courseTitle ? (
              <span className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 text-xs text-[var(--admin-on-surface-variant)]">
                {data.courseTitle}
              </span>
            ) : null}
            {data.batchName ? (
              <span className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 text-xs text-[var(--admin-on-surface-variant)]">
                {data.batchName}
              </span>
            ) : null}
            {live ? (
              <span className="inline-flex items-center gap-1.5 rounded-sm border border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] px-2 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--admin-success)]">
                <span className="motion-safe:animate-pulse h-2 w-2 rounded-full bg-[var(--admin-success)]" />
                Live
              </span>
            ) : (
              <span className="rounded-sm border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] px-2 py-1 font-mono text-[11px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                Standby
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          {elapsedDisplay != null ? (
            <div className="font-mono text-xl font-medium text-[var(--admin-on-surface)]">
              {formatDuration(elapsedDisplay)}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={secondaryButtonClassName}
              disabled={refreshing}
              onClick={() => void load({ quiet: true })}
              aria-label="Refresh live data"
            >
              <RefreshCw
                className={["h-4 w-4", refreshing ? "motion-safe:animate-spin" : ""].join(" ")}
                aria-hidden="true"
              />
              Refresh
            </button>
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={() => {
                setPresent(true);
              }}
              aria-label="Enter present mode"
            >
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
              Present mode
            </button>
            <button
              type="button"
              className={secondaryButtonClassName}
              disabled={allNotJoinedIds.length === 0}
              onClick={() => {
                openRemind(allNotJoinedIds);
              }}
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              Message absentees
            </button>
          </div>
        </div>
      </div>

      <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-[44px] font-medium leading-none text-[var(--admin-on-surface)]">
              {data.turnout.joinedCount.toLocaleString()}
            </span>
            <span className="text-base font-semibold text-[var(--admin-on-surface-variant)]">
              of {data.turnout.registeredCount.toLocaleString()} joined
            </span>
          </div>
          <div className="text-right">
            <div className="font-mono text-xl font-medium text-[var(--admin-on-surface)]">
              {formatPct(data.turnout.ratePct)}
            </div>
            {data.turnout.joinedLast5Min > 0 ? (
              <div className="mt-1 flex items-center justify-end gap-1 text-xs text-[var(--admin-success)]">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />+
                {data.turnout.joinedLast5Min} in the last 5 minutes
              </div>
            ) : (
              <div className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                No new joins in the last 5 minutes
              </div>
            )}
          </div>
        </div>
        {data.turnout.ratePct != null ? (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
            <div
              className="h-full bg-[var(--admin-primary)] transition-[width] duration-200 ease-out"
              style={{
                width: `${Math.max(0, Math.min(100, data.turnout.ratePct))}%`,
              }}
            />
          </div>
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <section className="relative h-64 overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-8">
          <ConcurrencyChart
            points={data.timeline.points}
            plannedMinutes={data.timeline.plannedMinutes}
            asOfOffsetMinutes={data.timeline.asOfOffsetMinutes}
            frozen={false}
            label={`${data.timeline.currentConcurrent} now · peak ${data.timeline.peakConcurrent ?? "-"}`}
          />
        </section>
        <section className="flex h-64 flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-4">
          <ActivityTicker events={data.recentEvents} nowMs={tickNow} />
        </section>
      </div>

      <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="border-b border-[var(--admin-border)] px-5 py-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--admin-on-surface)]">
            <Users className="h-5 w-5 text-[var(--admin-primary)]" aria-hidden="true" />
            Class overview
          </h2>
        </div>
        <div className="p-5">
          <PresenceGrid presence={data.presence} sessionId={sessionId} />
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
              Not yet joined
            </h2>
            <p className="text-xs text-[var(--admin-on-surface-variant)]">
              {data.notYetJoined.length.toLocaleString()} learner
              {data.notYetJoined.length === 1 ? "" : "s"} still absent
            </p>
          </div>
          {selectedCount > 0 ? (
            <button
              type="button"
              className={primaryButtonClassName}
              onClick={() => {
                openRemind([...selectedMembershipIds]);
              }}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Send reminder now ({selectedCount})
            </button>
          ) : null}
        </div>

        {data.notYetJoined.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-12 text-center">
            <Activity className="mb-3 h-8 w-8 text-[var(--admin-outline)]" aria-hidden="true" />
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Everyone registered has joined the session.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-[var(--admin-surface-low)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--admin-primary)]"
                      checked={
                        data.notYetJoined.length > 0 &&
                        data.notYetJoined.every((row) =>
                          selectedMembershipIds.has(row.membershipId),
                        )
                      }
                      onChange={toggleSelectAllNotJoined}
                      aria-label="Select all not yet joined"
                    />
                  </th>
                  <th className="px-4 py-3">Learner</th>
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3">Last session</th>
                  <th className="px-4 py-3">All-time rate</th>
                </tr>
              </thead>
              <tbody>
                {data.notYetJoined.map((row) => {
                  const selected = selectedMembershipIds.has(row.membershipId);
                  const ratePct = row.attendanceRatePct;
                  return (
                    <tr
                      key={row.membershipId}
                      className="border-b border-[var(--admin-border)] hover:bg-[var(--admin-surface-high)]"
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--admin-primary)]"
                          checked={selected}
                          onChange={() => {
                            toggleSelect(row.membershipId);
                          }}
                          aria-label={`Select ${row.learnerName ?? row.email ?? "learner"}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/reports/live-class-attendance/${sessionId}/attendees/${row.attendeeId}`}
                          className="font-medium text-[var(--admin-on-surface)] hover:text-[var(--admin-primary)] hover:underline"
                        >
                          {row.learnerName ?? "-"}
                        </Link>
                        {row.email ? (
                          <p className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                            {row.email}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {row.batchName ? (
                          <span className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                            {row.batchName}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.lastSessionStatus ? (
                          <StatusPill
                            tone={
                              row.lastSessionStatus === "attended"
                                ? "success"
                                : row.lastSessionStatus === "absent"
                                  ? "danger"
                                  : "muted"
                            }
                          >
                            {titleCase(row.lastSessionStatus)}
                          </StatusPill>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-[96px]">
                          <p className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                            {formatPct(ratePct)}
                          </p>
                          {ratePct != null ? (
                            <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                              <div
                                className="h-full rounded-full bg-[var(--admin-primary-strong)]"
                                style={{
                                  width: `${Math.max(0, Math.min(100, ratePct))}%`,
                                }}
                              />
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <RemindModal
        open={remindOpen}
        title={data.title}
        count={remindIds.length}
        subject={remindSubject}
        body={remindBody}
        busy={remindBusy}
        error={remindError}
        onSubjectChange={setRemindSubject}
        onBodyChange={setRemindBody}
        onClose={() => {
          if (!remindBusy) setRemindOpen(false);
        }}
        onSend={() => void handleSendRemind()}
      />
    </div>
  );
}
