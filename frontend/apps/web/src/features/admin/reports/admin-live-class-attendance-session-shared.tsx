"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Braces, Info, Send, X } from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import { type LiveSessionDetail } from "./admin-live-class-attendance-roster-api";
import { type ViewerLocale } from "./viewer-time";

export type MessageAudience = "absentees" | "selected" | "registrants";

export type SortBy =
  | "status"
  | "learner_name"
  | "email"
  | "joined_at"
  | "left_at"
  | "duration_seconds";

export type SortDir = "asc" | "desc";

export const PAGE_SIZE = 25;

export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-transparent px-4 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-low)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

export const fieldClassName =
  "h-9 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

export const MERGE_TAGS = [
  { tag: "{{learner_name}}", label: "learner_name" },
  { tag: "{{session_title}}", label: "session_title" },
  { tag: "{{recording_link}}", label: "recording_link" },
  { tag: "{{next_session_date}}", label: "next_session_date" },
] as const;

export const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "attended", label: "Attended" },
  { value: "registered", label: "Registered" },
  { value: "absent", label: "Absent" },
];

export const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "status:asc", label: "Status (absentees first)" },
  { value: "joined_at:desc", label: "Joined (newest)" },
  { value: "joined_at:asc", label: "Joined (oldest)" },
  { value: "duration_seconds:desc", label: "Duration (longest)" },
  { value: "duration_seconds:asc", label: "Duration (shortest)" },
  { value: "learner_name:asc", label: "Name A-Z" },
  { value: "learner_name:desc", label: "Name Z-A" },
  { value: "email:asc", label: "Email A-Z" },
  { value: "left_at:desc", label: "Left (newest)" },
];

export function Shimmer({ className }: { className?: string }) {
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

export function formatDateFor(value: string | null | undefined, viewer: ViewerLocale): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(viewer.locale, {
    timeZone: viewer.timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatCountFor(value: number, viewer: ViewerLocale): string {
  return value.toLocaleString(viewer.locale);
}

export function formatTimeOnlyFor(value: string | null | undefined, viewer: ViewerLocale): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString(viewer.locale, {
    timeZone: viewer.timeZone,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "-";
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${String(hours)}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${String(minutes)}m ${String(secs).padStart(2, "0")}s`;
  return `${String(secs)}s`;
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

export function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function attendanceRate(attended: number, registered: number): number | null {
  if (registered <= 0) return null;
  return (attended / registered) * 100;
}

export function coveragePct(
  durationSeconds: number | null | undefined,
  sessionDurationSeconds: number | null | undefined,
): number | null {
  if (
    durationSeconds == null ||
    sessionDurationSeconds == null ||
    sessionDurationSeconds <= 0 ||
    Number.isNaN(durationSeconds) ||
    Number.isNaN(sessionDurationSeconds)
  ) {
    return null;
  }
  return Math.min(100, (durationSeconds / sessionDurationSeconds) * 100);
}

export function errMsg(error: unknown, fallback: string): string {
  if (error instanceof ClientApiError || error instanceof Error) return error.message;
  return fallback;
}

export function sessionStatusTone(status: string): "success" | "warning" | "danger" | "muted" {
  const normalized = status.toLowerCase();
  if (normalized === "live" || normalized === "in_progress") return "success";
  if (normalized === "scheduled" || normalized === "upcoming") return "warning";
  if (normalized === "cancelled" || normalized === "canceled") return "danger";
  return "muted";
}

export function sessionStatusLabel(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "live" || normalized === "in_progress") return "Live";
  if (normalized === "scheduled" || normalized === "upcoming") return "Scheduled";
  if (normalized === "cancelled" || normalized === "canceled") return "Cancelled";
  if (normalized === "ended" || normalized === "completed" || normalized === "held") return "Ended";
  return titleCase(status);
}

export function isCancelledStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return normalized === "cancelled" || normalized === "canceled";
}

export function isScheduledStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return normalized === "scheduled" || normalized === "upcoming";
}

export function isLiveMonitorEligible(status: string): boolean {
  const normalized = status.toLowerCase();
  return (
    normalized === "live" ||
    normalized === "in_progress" ||
    normalized === "ended" ||
    normalized === "completed" ||
    normalized === "held"
  );
}

export function attendeeStatusTone(status: string): "success" | "danger" | "muted" {
  if (status === "attended") return "success";
  if (status === "absent") return "danger";
  return "muted";
}

export function StatusPill({
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
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function MetricBar({
  pct,
  tone = "primary",
}: {
  pct: number | null;
  tone?: "primary" | "success" | "warning" | "danger";
}) {
  const width = Math.max(0, Math.min(100, pct ?? 0));
  const fill =
    tone === "success"
      ? "bg-[var(--admin-success)]"
      : tone === "warning"
        ? "bg-[var(--admin-warning)]"
        : tone === "danger"
          ? "bg-[var(--admin-danger)]"
          : "bg-[var(--admin-primary-strong)]";
  return (
    <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
      <div
        className={`h-full rounded-full transition-[width] duration-200 ease-out ${fill}`}
        style={{ width: `${String(width)}%` }}
      />
    </div>
  );
}

export function metricBarTone(pct: number | null): "primary" | "success" | "warning" | "danger" {
  if (pct == null) return "primary";
  if (pct >= 75) return "success";
  if (pct >= 40) return "warning";
  return "danger";
}

export function defaultMessageBody(sessionTitle: string): string {
  return `Hi {{learner_name}},

You missed {{session_title}} (${sessionTitle}). Catch up using the recording: {{recording_link}}.

Next session: {{next_session_date}}.

If you need help, reply to this message.`;
}

export function defaultRegistrantBody(sessionTitle: string): string {
  return `Hi {{learner_name}},

Reminder: {{session_title}} (${sessionTitle}) is coming up.

Join details and any recording will be available after the session: {{recording_link}}.

Next related session: {{next_session_date}}.`;
}

export function getFocusable(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
  );
}

export function parseSortValue(value: string): { sortBy: SortBy; sortDir: SortDir } {
  const [rawBy, rawDir] = value.split(":");
  const sortBy: SortBy =
    rawBy === "learner_name" ||
    rawBy === "email" ||
    rawBy === "joined_at" ||
    rawBy === "left_at" ||
    rawBy === "duration_seconds" ||
    rawBy === "status"
      ? rawBy
      : "status";
  const sortDir: SortDir = rawDir === "desc" ? "desc" : "asc";
  return { sortBy, sortDir };
}

export function AttendanceTimelineChart({
  points,
  dropInsight,
  plannedMinutes,
}: {
  points: Array<{ offsetMinutes: number; concurrent: number }>;
  dropInsight: LiveSessionDetail["timeline"]["dropInsight"];
  plannedMinutes: number | null;
}) {
  const width = 720;
  const height = 180;
  const padL = 36;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxX =
    Math.max(
      plannedMinutes ?? 0,
      ...points.map((point) => point.offsetMinutes),
      dropInsight?.toOffsetMinutes ?? 0,
      1,
    ) || 1;
  const maxY = Math.max(1, ...points.map((point) => point.concurrent));

  const xAt = (offset: number) => padL + (offset / maxX) * plotW;
  const yAt = (concurrent: number) => padT + plotH - (concurrent / maxY) * plotH;

  const linePath = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${xAt(point.offsetMinutes).toFixed(1)} ${yAt(point.concurrent).toFixed(1)}`,
    )
    .join(" ");

  const areaPath =
    points.length > 0
      ? (() => {
          const lastPoint = points[points.length - 1];
          const firstPoint = points[0];
          if (!lastPoint || !firstPoint) return "";
          return `${linePath} L ${xAt(lastPoint.offsetMinutes).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${xAt(firstPoint.offsetMinutes).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;
        })()
      : "";

  const tickCount = Math.min(6, Math.max(2, Math.ceil(maxX / 10)));
  const xTicks = Array.from({ length: tickCount + 1 }, (_, index) =>
    Math.round((maxX * index) / tickCount),
  );
  const yTicks = [0, Math.round(maxY / 2), maxY].filter(
    (value, index, arr) => arr.indexOf(value) === index,
  );

  const dropTicks =
    dropInsight != null
      ? [
          dropInsight.fromOffsetMinutes,
          Math.round((dropInsight.fromOffsetMinutes + dropInsight.toOffsetMinutes) / 2),
          dropInsight.toOffsetMinutes,
        ]
      : [];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label="Concurrent attendance over the session"
    >
      {dropInsight ? (
        <rect
          x={xAt(dropInsight.fromOffsetMinutes)}
          y={padT}
          width={Math.max(2, xAt(dropInsight.toOffsetMinutes) - xAt(dropInsight.fromOffsetMinutes))}
          height={plotH}
          fill="color-mix(in srgb, var(--admin-danger) 12%, transparent)"
        />
      ) : null}
      {yTicks.map((tick) => (
        <g key={`y-${tick}`}>
          <line
            x1={padL}
            x2={padL + plotW}
            y1={yAt(tick)}
            y2={yAt(tick)}
            stroke="var(--admin-border)"
            strokeWidth={1}
          />
          <text
            x={padL - 8}
            y={yAt(tick) + 3}
            textAnchor="end"
            className="fill-[var(--admin-on-surface-variant)]"
            style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}
          >
            {tick}
          </text>
        </g>
      ))}
      {areaPath ? (
        <path d={areaPath} fill="color-mix(in srgb, var(--admin-primary) 22%, transparent)" />
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
      {dropTicks.map((offset, index) => (
        <line
          key={`drop-${offset}-${index}`}
          x1={xAt(offset)}
          x2={xAt(offset)}
          y1={padT + plotH - (index === 1 ? 14 : 8)}
          y2={padT + plotH}
          stroke="var(--admin-danger)"
          strokeWidth={1.5}
        />
      ))}
      {xTicks.map((tick) => (
        <text
          key={`x-${tick}`}
          x={xAt(tick)}
          y={height - 8}
          textAnchor="middle"
          className="fill-[var(--admin-on-surface-variant)]"
          style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}
        >
          {String(Math.floor(tick / 60)).padStart(2, "0")}:{String(tick % 60).padStart(2, "0")}
        </text>
      ))}
    </svg>
  );
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading session attendance">
      <Shimmer className="h-4 w-48" />
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
        <div className="space-y-2">
          <Shimmer className="h-8 w-72" />
          <Shimmer className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-36" />
          <Shimmer className="h-9 w-44" />
        </div>
      </div>
      <div className="grid grid-cols-1 overflow-hidden rounded-sm border border-[var(--admin-border)] md:grid-cols-6 md:gap-px md:bg-[var(--admin-border)]">
        <div className="space-y-3 bg-[var(--admin-surface)] p-5 md:col-span-2">
          <Shimmer className="h-3 w-24" />
          <Shimmer className="h-8 w-28" />
          <Shimmer className="h-[3px] w-full" />
          <Shimmer className="h-3 w-36" />
        </div>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-3 bg-[var(--admin-surface)] p-5 md:col-span-1">
            <Shimmer className="h-3 w-20" />
            <Shimmer className="h-7 w-16" />
            <Shimmer className="h-3 w-24" />
          </div>
        ))}
        <div className="space-y-3 bg-[var(--admin-surface)] p-5 md:col-span-1">
          <Shimmer className="h-3 w-24" />
          <Shimmer className="h-5 w-full" />
          <Shimmer className="h-5 w-40" />
        </div>
      </div>
      <Shimmer className="h-52 w-full rounded-lg" />
      <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 border-b border-[var(--admin-border)] px-4 py-3 last:border-0"
          >
            <Shimmer className="h-4 w-4" />
            <Shimmer className="h-4 w-40" />
            <Shimmer className="ml-auto h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MessageDrawer({
  open,
  audience,
  count,
  sessionTitle,
  subject,
  body,
  channelEmail,
  channelInApp,
  busy,
  error,
  onSubjectChange,
  onBodyChange,
  onChannelEmailChange,
  onChannelInAppChange,
  onClose,
  onSend,
  onTestSend,
}: {
  open: boolean;
  audience: MessageAudience;
  count: number;
  sessionTitle: string;
  subject: string;
  body: string;
  channelEmail: boolean;
  channelInApp: boolean;
  busy: boolean;
  error: string | null;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onChannelEmailChange: (value: boolean) => void;
  onChannelInAppChange: (value: boolean) => void;
  onClose: () => void;
  onSend: () => void;
  onTestSend: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel) {
      const focusables = getFocusable(panel);
      (focusables[0] ?? panel).focus();
    }
    return () => {
      previouslyFocused.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusables = getFocusable(panelRef.current);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, busy, onClose]);

  function insertTag(tag: string) {
    const el = bodyRef.current;
    if (!el) {
      onBodyChange(`${body}${tag}`);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = `${body.slice(0, start)}${tag}${body.slice(end)}`;
    onBodyChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + tag.length;
      el.setSelectionRange(pos, pos);
    });
  }

  if (!open || !mounted) return null;

  const caption =
    audience === "absentees"
      ? `${count} learner${count === 1 ? "" : "s"} registered but did not attend`
      : audience === "registrants"
        ? `Sending a reminder to ${count} registrant${count === 1 ? "" : "s"}`
        : `Sending to ${count} selected learner${count === 1 ? "" : "s"}`;

  const drawer = (
    <div className="fixed inset-0 z-50 flex justify-end bg-[color-mix(in_srgb,var(--admin-on-surface)_20%,transparent)] backdrop-blur-[1px]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close message drawer overlay"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <aside
        ref={(el) => {
          panelRef.current = el;
        }}
        className="admin-theme relative z-10 flex h-full w-full max-w-[560px] flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[-8px_0_24px_color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] motion-safe:animate-[admin-drawer-in_240ms_ease-out]"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="flex items-start justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-5">
          <div className="pr-4">
            <h2 id={titleId} className="text-base font-semibold text-[var(--admin-on-surface)]">
              Message Attendees
            </h2>
            <p
              className={`mt-1.5 flex items-center gap-1.5 text-xs ${
                audience === "absentees"
                  ? "text-[var(--admin-warning)]"
                  : "text-[var(--admin-on-surface-variant)]"
              }`}
            >
              {audience === "absentees" ? (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : null}
              <span>
                {caption}
                {sessionTitle ? (
                  <span className="text-[var(--admin-on-surface-variant)]"> · {sessionTitle}</span>
                ) : null}
              </span>
            </p>
          </div>
          <button
            type="button"
            className="rounded-full p-2 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
          {error ? (
            <div
              className="rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-3 py-2.5 text-sm text-[var(--admin-danger)]"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <label className="grid gap-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
              Subject
            </span>
            <input
              className={fieldClassName}
              value={subject}
              onChange={(event) => {
                onSubjectChange(event.target.value);
              }}
              maxLength={200}
            />
          </label>

          <div className="space-y-4">
            <label className="grid gap-2">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                Message body
              </span>
              <div className="overflow-hidden rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] focus-within:border-[var(--admin-primary)] focus-within:ring-1 focus-within:ring-[var(--admin-primary)]">
                <textarea
                  ref={bodyRef}
                  className="min-h-[240px] w-full resize-none border-0 bg-transparent px-4 py-4 text-[13px] leading-5 text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus:outline-none focus:ring-0"
                  rows={10}
                  value={body}
                  onChange={(event) => {
                    onBodyChange(event.target.value);
                  }}
                  maxLength={10000}
                  placeholder="Write your message here…"
                />
              </div>
            </label>

            <div className="flex flex-col gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
              <p className="text-xs text-[var(--admin-on-surface-variant)]">
                Available merge tags (click to insert)
              </p>
              <div className="flex flex-wrap gap-2">
                {MERGE_TAGS.map((item) => (
                  <button
                    key={item.tag}
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] px-2.5 py-1 font-mono text-[12px] text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                    onClick={() => {
                      insertTag(item.tag);
                    }}
                  >
                    <Braces className="h-3.5 w-3.5" aria-hidden="true" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t border-[var(--admin-border)] pt-4">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
              Delivery channels
            </p>
            <div className="flex flex-col gap-3">
              <label className="group flex cursor-pointer items-center gap-3 text-sm text-[var(--admin-on-surface)]">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--admin-primary)]"
                  checked={channelEmail}
                  onChange={(event) => {
                    onChannelEmailChange(event.target.checked);
                  }}
                />
                <span className="transition-colors group-hover:text-[var(--admin-primary)]">
                  Email
                </span>
              </label>
              <label className="group flex cursor-pointer items-center gap-3 text-sm text-[var(--admin-on-surface)]">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--admin-primary)]"
                  checked={channelInApp}
                  onChange={(event) => {
                    onChannelInAppChange(event.target.checked);
                  }}
                />
                <span className="transition-colors group-hover:text-[var(--admin-primary)]">
                  In-app notification
                </span>
              </label>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--admin-primary)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
              disabled={busy || !subject.trim() || !body.trim() || (!channelEmail && !channelInApp)}
              onClick={onTestSend}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Send a test to myself
            </button>
          </div>
        </div>

        <div className="space-y-4 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-5">
          <div className="flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--admin-warning)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] p-3">
            <Info
              className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--admin-warning)]"
              aria-hidden="true"
            />
            <p className="text-xs text-[var(--admin-on-surface)]">
              You are about to send this message to{" "}
              <span className="font-semibold">
                {count} learner{count === 1 ? "" : "s"}
              </span>
              . Operations of this type are processed immediately and{" "}
              <span className="font-semibold">cannot be recalled</span>.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className={ghostButtonClassName}
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className={primaryButtonClassName}
              disabled={
                busy ||
                count === 0 ||
                !subject.trim() ||
                !body.trim() ||
                (!channelEmail && !channelInApp)
              }
              onClick={onSend}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {busy ? "Sending…" : `Send to ${count} learner${count === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );

  return createPortal(drawer, document.body);
}
