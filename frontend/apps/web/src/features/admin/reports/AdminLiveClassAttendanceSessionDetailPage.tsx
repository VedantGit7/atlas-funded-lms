"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Braces,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Info,
  Mail,
  PlayCircle,
  Presentation,
  RefreshCw,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import {
  DropdownField,
  dropdownItemClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  LIVE_ATTENDANCE_COLUMN_OPTIONS,
  dateInputToEndIso,
  dateInputToStartIso,
  exportLiveClassAttendanceReport,
  fetchLiveClassSessionAttendees,
  fetchLiveClassSessionDetail,
  sendLiveClassAttendanceMessage,
  type LiveAttendanceColumnKey,
  type LiveAttendeeItem,
  type LiveSessionDetail,
} from "./admin-live-class-attendance-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

type MessageAudience = "absentees" | "selected" | "registrants";
type SortBy = "status" | "learner_name" | "email" | "joined_at" | "left_at" | "duration_seconds";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 25;
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-transparent px-4 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-low)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const fieldClassName =
  "h-9 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

const MERGE_TAGS = [
  { tag: "{{learner_name}}", label: "learner_name" },
  { tag: "{{session_title}}", label: "session_title" },
  { tag: "{{recording_link}}", label: "recording_link" },
  { tag: "{{next_session_date}}", label: "next_session_date" },
] as const;

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "attended", label: "Attended" },
  { value: "registered", label: "Registered" },
  { value: "absent", label: "Absent" },
];

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
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

function formatDate(value: string | null | undefined): string {
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

function formatTimeOnly(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
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

function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function attendanceRate(attended: number, registered: number): number | null {
  if (registered <= 0) return null;
  return (attended / registered) * 100;
}

function coveragePct(
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

function errMsg(error: unknown, fallback: string): string {
  if (error instanceof ClientApiError || error instanceof Error) return error.message;
  return fallback;
}

function sessionStatusTone(status: string): "success" | "warning" | "danger" | "muted" {
  const normalized = status.toLowerCase();
  if (normalized === "live" || normalized === "in_progress") return "success";
  if (normalized === "scheduled" || normalized === "upcoming") return "warning";
  if (normalized === "cancelled" || normalized === "canceled") return "danger";
  return "muted";
}

function sessionStatusLabel(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "live" || normalized === "in_progress") return "Live";
  if (normalized === "scheduled" || normalized === "upcoming") return "Scheduled";
  if (normalized === "cancelled" || normalized === "canceled") return "Cancelled";
  if (normalized === "ended" || normalized === "completed" || normalized === "held") return "Ended";
  return titleCase(status);
}

function isCancelledStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return normalized === "cancelled" || normalized === "canceled";
}

function isScheduledStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return normalized === "scheduled" || normalized === "upcoming";
}

function isLiveMonitorEligible(status: string): boolean {
  const normalized = status.toLowerCase();
  return (
    normalized === "live" ||
    normalized === "in_progress" ||
    normalized === "ended" ||
    normalized === "completed" ||
    normalized === "held"
  );
}

function attendeeStatusTone(status: string): "success" | "danger" | "muted" {
  if (status === "attended") return "success";
  if (status === "absent") return "danger";
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
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function MetricBar({
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

function metricBarTone(pct: number | null): "primary" | "success" | "warning" | "danger" {
  if (pct == null) return "primary";
  if (pct >= 75) return "success";
  if (pct >= 40) return "warning";
  return "danger";
}

function defaultMessageBody(sessionTitle: string): string {
  return `Hi {{learner_name}},

You missed {{session_title}} (${sessionTitle}). Catch up using the recording: {{recording_link}}.

Next session: {{next_session_date}}.

If you need help, reply to this message.`;
}

function defaultRegistrantBody(sessionTitle: string): string {
  return `Hi {{learner_name}},

Reminder: {{session_title}} (${sessionTitle}) is coming up.

Join details and any recording will be available after the session: {{recording_link}}.

Next related session: {{next_session_date}}.`;
}

function getFocusable(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
  );
}

function parseSortValue(value: string): { sortBy: SortBy; sortDir: SortDir } {
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

function AttendanceTimelineChart({
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

function PageSkeleton() {
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

function MessageDrawer({
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

export function AdminLiveClassAttendanceSessionDetailPage({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const columnsLabelId = useId();
  const statusLabelId = useId();
  const sortLabelId = useId();
  const autoMessageHandled = useRef(false);

  const [detail, setDetail] = useState<LiveSessionDetail | null>(null);
  const [attendees, setAttendees] = useState<LiveAttendeeItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [draftLearnerName, setDraftLearnerName] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const [draftJoinedFrom, setDraftJoinedFrom] = useState("");
  const [draftJoinedTo, setDraftJoinedTo] = useState("");
  const [draftSortValue, setDraftSortValue] = useState("status:asc");

  const [learnerName, setLearnerName] = useState("");
  const [email, setEmail] = useState("");
  const [attendeeStatus, setAttendeeStatus] = useState("");
  const [joinedFrom, setJoinedFrom] = useState("");
  const [joinedTo, setJoinedTo] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [columns, setColumns] = useState<LiveAttendanceColumnKey[]>(
    LIVE_ATTENDANCE_COLUMN_OPTIONS.map((column) => column.key),
  );
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [messageOpen, setMessageOpen] = useState(false);
  const [messageAudience, setMessageAudience] = useState<MessageAudience>("absentees");
  const [messageIds, setMessageIds] = useState<string[]>([]);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [channelEmail, setChannelEmail] = useState(true);
  const [channelInApp, setChannelInApp] = useState(true);
  const [messageBusy, setMessageBusy] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  const hasAttendeeFilters = Boolean(
    learnerName.trim() ||
    email.trim() ||
    attendeeStatus ||
    joinedFrom ||
    joinedTo ||
    sortBy !== "status" ||
    sortDir !== "asc",
  );

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchLiveClassSessionDetail(sessionId);
      setDetail(response.data);
    } catch (loadError) {
      setDetail(null);
      setError(errMsg(loadError, "Couldn't load session attendance."));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const loadAttendees = useCallback(async () => {
    setAttendeesLoading(true);
    setError(null);
    try {
      const response = await fetchLiveClassSessionAttendees(sessionId, {
        learnerName: learnerName.trim() || undefined,
        email: email.trim() || undefined,
        status: attendeeStatus || undefined,
        joinedFrom: dateInputToStartIso(joinedFrom),
        joinedTo: dateInputToEndIso(joinedTo),
        sortBy,
        sortDir,
        columns,
        page,
      });
      setAttendees(response.data.items);
      setTotalCount(response.data.pageInfo.totalCount);
      setTotalPages(response.data.pageInfo.totalPages);
      setSelectedIds((current) =>
        current.filter((id) => response.data.items.some((row) => row.membershipId === id)),
      );
    } catch (loadError) {
      setAttendees([]);
      setTotalCount(0);
      setTotalPages(0);
      setError(errMsg(loadError, "Couldn't load attendees."));
    } finally {
      setAttendeesLoading(false);
    }
  }, [
    attendeeStatus,
    columns,
    email,
    joinedFrom,
    joinedTo,
    learnerName,
    page,
    sessionId,
    sortBy,
    sortDir,
  ]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    void loadAttendees();
  }, [loadAttendees]);

  const cancelled = detail ? isCancelledStatus(detail.status) : false;
  const scheduled = detail ? isScheduledStatus(detail.status) : false;
  const rate = detail ? attendanceRate(detail.attendanceCount, detail.registeredCount) : null;
  const avgCoverage =
    detail?.avgCoveragePct ?? coveragePct(detail?.avgDurationSeconds, detail?.durationSeconds);
  const plannedMinutes =
    detail?.durationSeconds != null ? Math.round(detail.durationSeconds / 60) : null;
  const showTimeline = !!detail && !cancelled && !scheduled && detail.timeline.points.length > 0;

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);

  const statusLabel =
    STATUS_OPTIONS.find((option) => option.value === draftStatus)?.label ?? "All statuses";
  const sortLabel =
    SORT_OPTIONS.find((option) => option.value === draftSortValue)?.label ??
    "Status (absentees first)";

  const messageCount = useMemo(() => {
    if (messageAudience === "selected") return messageIds.length;
    if (messageAudience === "registrants") return detail?.registeredCount ?? 0;
    return detail?.absentCount ?? 0;
  }, [detail?.absentCount, detail?.registeredCount, messageAudience, messageIds.length]);

  function applyFilters(overrides?: { status?: string; page?: number }) {
    const nextStatus = overrides?.status ?? draftStatus;
    const parsed = parseSortValue(draftSortValue);
    setLearnerName(draftLearnerName.trim());
    setEmail(draftEmail.trim());
    setAttendeeStatus(nextStatus);
    setDraftStatus(nextStatus);
    setJoinedFrom(draftJoinedFrom);
    setJoinedTo(draftJoinedTo);
    setSortBy(parsed.sortBy);
    setSortDir(parsed.sortDir);
    setPage(overrides?.page ?? 1);
    setSelectedIds([]);
  }

  function filterAbsentees() {
    setDraftStatus("absent");
    applyFilters({ status: "absent", page: 1 });
  }

  function toggleColumn(key: LiveAttendanceColumnKey) {
    setColumns((current) => {
      if (current.includes(key)) {
        if (current.length === 1) return current;
        return current.filter((column) => column !== key);
      }
      return [...current, key];
    });
  }

  function toggleSelectAll() {
    if (attendees.length === 0) return;
    if (selectedIds.length === attendees.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(attendees.map((row) => row.membershipId));
  }

  function toggleRow(membershipId: string) {
    setSelectedIds((current) =>
      current.includes(membershipId)
        ? current.filter((id) => id !== membershipId)
        : [...current, membershipId],
    );
  }

  async function handleExport() {
    setBusy(true);
    setActionError(null);
    try {
      const response = await exportLiveClassAttendanceReport({
        sessionId,
        learnerName: learnerName.trim() || undefined,
        email: email.trim() || undefined,
        status: attendeeStatus || undefined,
        joinedFrom: dateInputToStartIso(joinedFrom),
        joinedTo: dateInputToEndIso(joinedTo),
        columns,
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
      setActionError(errMsg(exportError, "Unable to export report."));
    } finally {
      setBusy(false);
    }
  }

  function openMessageDrawer(audience: MessageAudience, membershipIds?: string[]) {
    if (!detail) return;
    const title = detail.title;
    setMessageAudience(audience);
    setMessageIds(membershipIds ?? []);
    setMessageError(null);
    setChannelEmail(true);
    setChannelInApp(true);
    if (audience === "registrants") {
      setMessageSubject(`Reminder: ${title}`);
      setMessageBody(defaultRegistrantBody(title));
    } else {
      setMessageSubject(`You missed: ${title}`);
      setMessageBody(defaultMessageBody(title));
    }
    setMessageOpen(true);
  }

  useEffect(() => {
    if (!detail || autoMessageHandled.current) return;
    if (searchParams.get("message") !== "absentees") return;
    autoMessageHandled.current = true;

    const cancelledSession = isCancelledStatus(detail.status);
    if (!cancelledSession && detail.absentCount > 0) {
      setMessageAudience("absentees");
      setMessageIds([]);
      setMessageError(null);
      setChannelEmail(true);
      setChannelInApp(true);
      setMessageSubject(`You missed: ${detail.title}`);
      setMessageBody(defaultMessageBody(detail.title));
      setMessageOpen(true);
      setDraftStatus("absent");
      setAttendeeStatus("absent");
      setPage(1);
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("message");
    const query = params.toString();
    router.replace(
      query
        ? `/admin/reports/live-class-attendance/${sessionId}?${query}`
        : `/admin/reports/live-class-attendance/${sessionId}`,
    );
  }, [detail, router, searchParams, sessionId]);

  async function handleSendMessage(options?: { sendTestToSelf?: boolean }) {
    if (!detail || !messageSubject.trim() || !messageBody.trim()) return;
    if (!channelEmail && !channelInApp) return;

    const channels: Array<"email" | "in_app"> = [];
    if (channelEmail) channels.push("email");
    if (channelInApp) channels.push("in_app");

    setMessageBusy(true);
    setMessageError(null);
    setActionError(null);
    try {
      await sendLiveClassAttendanceMessage({
        sessionId,
        audience: messageAudience,
        ...(messageAudience === "selected" ? { membershipIds: messageIds } : {}),
        subject: messageSubject.trim(),
        message: messageBody.trim(),
        channels,
        ...(options?.sendTestToSelf ? { sendTestToSelf: true } : {}),
      });
      if (!options?.sendTestToSelf) {
        setMessageOpen(false);
        setMessageSubject("");
        setMessageBody("");
        setMessageIds([]);
        if (messageAudience === "selected") setSelectedIds([]);
      }
    } catch (sendError) {
      setMessageError(errMsg(sendError, "Couldn't send message."));
    } finally {
      setMessageBusy(false);
    }
  }

  async function retryAll() {
    await Promise.all([loadDetail(), loadAttendees()]);
  }

  if (loading && !detail) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
        <PageSkeleton />
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
        <div
          className="flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-4 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium text-[var(--admin-danger)]">
                Couldn&apos;t load session attendance.
              </p>
              <p className="mt-0.5 text-xs text-[color-mix(in_srgb,var(--admin-danger)_70%,var(--admin-on-surface))]">
                {error}
              </p>
            </div>
          </div>
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={() => void retryAll()}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
        <div className="opacity-40">
          <PageSkeleton />
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const primaryMessageDisabled =
    cancelled || (scheduled ? detail.registeredCount === 0 : detail.absentCount === 0);
  const primaryMessageLabel = scheduled
    ? "Message registrants"
    : `Message absentees (${detail.absentCount})`;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
      <nav
        className="flex flex-wrap items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]"
        aria-label="Breadcrumb"
      >
        <Link href="/admin" className="hover:text-[var(--admin-primary-strong)]">
          Admin
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href="/admin/reports" className="hover:text-[var(--admin-primary-strong)]">
          Reports
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link
          href="/admin/reports/live-class-attendance"
          className="hover:text-[var(--admin-primary-strong)]"
        >
          Live Class Attendance
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="text-[var(--admin-on-surface)]">{detail.title}</span>
      </nav>

      <Link
        href="/admin/reports/live-class-attendance"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-[var(--admin-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        All sessions
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
              {detail.title}
            </h1>
            <StatusPill tone={sessionStatusTone(detail.status)}>
              {sessionStatusLabel(detail.status)}
            </StatusPill>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--admin-on-surface-variant)]">
            <span className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1">
              {detail.courseTitle ?? "No linked course"}
            </span>
            <span className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1">
              {detail.batchName ?? "No linked batch"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[140px]">
            <DropdownField
              label={<span className="sr-only">Columns</span>}
              labelId={columnsLabelId}
              open={columnsOpen}
              onToggle={() => {
                setColumnsOpen((open) => !open);
                setStatusOpen(false);
                setSortOpen(false);
              }}
              triggerContent={
                <span className="flex w-full items-center gap-2 text-[13px] font-medium text-[var(--admin-on-surface)]">
                  <Columns3
                    className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
                    aria-hidden="true"
                  />
                  <span className="flex-1 text-left">Columns</span>
                  <ChevronDown
                    className={`h-4 w-4 text-[var(--admin-on-surface-variant)] transition-transform duration-200 ${columnsOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </span>
              }
              panelAriaLabel="Visible columns"
            >
              <div className="space-y-1 p-2" role="group" aria-label="Column checkboxes">
                {LIVE_ATTENDANCE_COLUMN_OPTIONS.map((column) => {
                  const checked = columns.includes(column.key);
                  return (
                    <label
                      key={column.key}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--admin-primary)]"
                        checked={checked}
                        disabled={checked && columns.length === 1}
                        onChange={() => {
                          toggleColumn(column.key);
                        }}
                      />
                      {column.label}
                    </label>
                  );
                })}
              </div>
            </DropdownField>
          </div>

          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={busy || attendeesLoading}
            onClick={() => void handleExport()}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </button>

          {isLiveMonitorEligible(detail.status) ? (
            <Link
              href={`/admin/reports/live-class-attendance/${sessionId}/live`}
              className={secondaryButtonClassName}
            >
              <Activity className="h-4 w-4" aria-hidden="true" />
              Live monitor
            </Link>
          ) : null}

          {detail.recordingUrl ? (
            <a
              href={detail.recordingUrl}
              target="_blank"
              rel="noreferrer"
              className={secondaryButtonClassName}
            >
              <PlayCircle className="h-4 w-4" aria-hidden="true" />
              Open recording
            </a>
          ) : (
            <button type="button" className={secondaryButtonClassName} disabled>
              <PlayCircle className="h-4 w-4" aria-hidden="true" />
              Open recording
            </button>
          )}

          <button
            type="button"
            className={primaryButtonClassName}
            disabled={busy || primaryMessageDisabled}
            onClick={() => {
              openMessageDrawer(scheduled ? "registrants" : "absentees");
            }}
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            {primaryMessageLabel}
          </button>
        </div>
      </div>

      {actionError || error ? (
        <div
          className="flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-4 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
            <p className="text-sm text-[var(--admin-danger)]">{actionError ?? error}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={ghostButtonClassName}
              onClick={() => {
                setActionError(null);
                setError(null);
              }}
            >
              Dismiss
            </button>
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={() => void retryAll()}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Retry
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 overflow-hidden rounded-sm border border-[var(--admin-border)] md:grid-cols-6 md:gap-px md:bg-[var(--admin-border)]">
        <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5 md:col-span-2">
          <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
            Attendance
          </p>
          <p className="font-mono text-[32px] font-medium leading-none text-[var(--admin-on-surface)]">
            {cancelled ? (
              "-"
            ) : (
              <>
                {detail.attendanceCount.toLocaleString()}
                <span className="text-sm font-normal text-[var(--admin-on-surface-variant)]">
                  {" "}
                  of {detail.registeredCount.toLocaleString()}
                </span>
              </>
            )}
          </p>
          {!cancelled ? (
            <div className="mt-3">
              <MetricBar pct={rate} tone={metricBarTone(rate)} />
            </div>
          ) : null}
          <p className="mt-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
            {cancelled ? "-" : `${formatPct(rate)} of registrations`}
          </p>
        </div>

        <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5">
          <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-danger)]">
            Absentees
          </p>
          {cancelled ? (
            <p className="font-mono text-2xl font-medium leading-none text-[var(--admin-on-surface)]">
              -
            </p>
          ) : (
            <button
              type="button"
              className="w-fit font-mono text-2xl font-medium leading-none text-[var(--admin-danger)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
              onClick={filterAbsentees}
            >
              {detail.absentCount.toLocaleString()}
            </button>
          )}
          <p className="mt-2 flex items-center gap-1 text-xs text-[var(--admin-danger)]">
            {cancelled ? (
              "-"
            ) : detail.absentCount > 0 ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                Action required
              </>
            ) : (
              "All registrants attended"
            )}
          </p>
        </div>

        <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5 md:col-span-2">
          <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
            Average duration
          </p>
          <p className="font-mono text-2xl font-medium leading-none text-[var(--admin-on-surface)]">
            {cancelled ? "-" : formatDuration(detail.avgDurationSeconds)}
          </p>
          {!cancelled ? (
            <div className="mt-3">
              <MetricBar pct={avgCoverage} tone={metricBarTone(avgCoverage)} />
            </div>
          ) : null}
          <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
            {cancelled
              ? "-"
              : `${formatPct(avgCoverage)} of ${formatDuration(detail.durationSeconds)} session`}
          </p>
        </div>

        <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5">
          <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
            Timeline
          </p>
          <div className="space-y-1.5 font-mono text-xs text-[var(--admin-on-surface)]">
            <p>
              <span className="text-[var(--admin-on-surface-variant)]">Scheduled </span>
              {formatTimeOnly(detail.scheduledAt)}
            </p>
            <p
              className={
                detail.startDelayMinutes != null && detail.startDelayMinutes > 5
                  ? "text-[var(--admin-warning)]"
                  : undefined
              }
            >
              <span className="text-[var(--admin-on-surface-variant)]">Started </span>
              {cancelled ? "-" : formatTimeOnly(detail.startedAt)}
              {detail.startDelayMinutes != null && detail.startDelayMinutes > 5 ? (
                <span className="mt-0.5 block text-[11px]">
                  started {detail.startDelayMinutes} minutes late
                </span>
              ) : null}
            </p>
            <p>
              <span className="text-[var(--admin-on-surface-variant)]">Ended </span>
              {cancelled ? "-" : formatTimeOnly(detail.endedAt)}
            </p>
          </div>
        </div>
      </div>

      {cancelled ? (
        <section className="rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-6 py-8">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-base font-semibold text-[var(--admin-danger)]">
                This session was cancelled on {formatDate(detail.cancelledAt ?? detail.scheduledAt)}
              </h2>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                Registration list remains available. Attendance metrics are shown as dashes.
              </p>
            </div>
          </div>
        </section>
      ) : scheduled ? (
        <section className="rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-10">
          <div className="mx-auto flex max-w-lg flex-col items-center text-center">
            <Users className="mb-3 h-8 w-8 text-[var(--admin-outline)]" aria-hidden="true" />
            <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
              This session has not started yet
            </h2>
            {detail.expectedTurnoutCount != null || detail.expectedTurnoutPct != null ? (
              <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
                Expected turnout{" "}
                {detail.expectedTurnoutCount != null
                  ? detail.expectedTurnoutCount.toLocaleString()
                  : "-"}
                {detail.expectedTurnoutPct != null
                  ? ` (${formatPct(detail.expectedTurnoutPct)})`
                  : ""}
              </p>
            ) : (
              <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
                Timeline will appear after this session is held.
              </p>
            )}
            <button
              type="button"
              className={`${primaryButtonClassName} mt-5`}
              disabled={detail.registeredCount === 0}
              onClick={() => {
                openMessageDrawer("registrants");
              }}
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              Message registrants
            </button>
          </div>
        </section>
      ) : showTimeline ? (
        <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--admin-on-surface)]">
              Attendance timeline
            </h2>
            <div className="flex items-center gap-4 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full bg-[var(--admin-primary)]"
                  aria-hidden="true"
                />
                Attendees
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-px bg-[var(--admin-danger)]" aria-hidden="true" />
                Drops
              </span>
              <span>· {detail.timeline.bucketMinutes}m buckets</span>
            </div>
          </div>
          <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-2">
            <AttendanceTimelineChart
              points={detail.timeline.points}
              dropInsight={detail.timeline.dropInsight}
              plannedMinutes={plannedMinutes}
            />
          </div>
          <p className="mt-3 text-center text-sm text-[var(--admin-on-surface-variant)]">
            Peak {detail.peakConcurrent ?? "-"} concurrent
            {detail.peakConcurrentAt ? ` at ${formatTimeOnly(detail.peakConcurrentAt)}` : ""}
            {detail.timeline.dropInsight ? (
              <>
                {" · "}
                <span className="font-medium text-[var(--admin-danger)]">
                  {detail.timeline.dropInsight.message}
                </span>
              </>
            ) : null}
          </p>
        </section>
      ) : (
        <section className="rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-10 text-center">
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            No concurrent attendance timeline was recorded for this session.
          </p>
        </section>
      )}

      <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
          <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">Attendees</h2>
          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            {totalCount.toLocaleString()} record{totalCount === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
          <label className="grid min-w-[160px] flex-1 gap-1 text-xs text-[var(--admin-on-surface-variant)]">
            Name
            <span className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <input
                className={`${fieldClassName} pl-9`}
                value={draftLearnerName}
                onChange={(event) => {
                  setDraftLearnerName(event.target.value);
                }}
                placeholder="Learner name"
              />
            </span>
          </label>
          <label className="grid min-w-[180px] flex-1 gap-1 text-xs text-[var(--admin-on-surface-variant)]">
            Email
            <input
              className={fieldClassName}
              value={draftEmail}
              onChange={(event) => {
                setDraftEmail(event.target.value);
              }}
              placeholder="Learner email"
            />
          </label>
          <div className="min-w-[160px]">
            <DropdownField
              label="Status"
              labelId={statusLabelId}
              open={statusOpen}
              onToggle={() => {
                setStatusOpen((open) => !open);
                setColumnsOpen(false);
                setSortOpen(false);
              }}
              triggerContent={
                <span className="flex w-full items-center gap-2 text-[13px] font-medium text-[var(--admin-on-surface)]">
                  <span className="flex-1 truncate text-left">{statusLabel}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)] transition-transform duration-200 ${statusOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </span>
              }
              panelAriaLabel="Attendee status filter"
            >
              <div className="p-1.5" role="listbox">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value || "all"}
                    type="button"
                    role="option"
                    aria-selected={draftStatus === option.value}
                    className={dropdownItemClassName}
                    onClick={() => {
                      setDraftStatus(option.value);
                      setStatusOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </DropdownField>
          </div>
          <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
            Joined from
            <input
              type="date"
              className={fieldClassName}
              value={draftJoinedFrom}
              onChange={(event) => {
                setDraftJoinedFrom(event.target.value);
              }}
            />
          </label>
          <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
            Joined to
            <input
              type="date"
              className={fieldClassName}
              value={draftJoinedTo}
              onChange={(event) => {
                setDraftJoinedTo(event.target.value);
              }}
            />
          </label>
          <div className="min-w-[200px]">
            <DropdownField
              label="Sort"
              labelId={sortLabelId}
              open={sortOpen}
              onToggle={() => {
                setSortOpen((open) => !open);
                setColumnsOpen(false);
                setStatusOpen(false);
              }}
              triggerContent={
                <span className="flex w-full items-center gap-2 text-[13px] font-medium text-[var(--admin-on-surface)]">
                  <span className="flex-1 truncate text-left">{sortLabel}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)] transition-transform duration-200 ${sortOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </span>
              }
              panelAriaLabel="Sort attendees"
            >
              <div className="p-1.5" role="listbox">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={draftSortValue === option.value}
                    className={dropdownItemClassName}
                    onClick={() => {
                      setDraftSortValue(option.value);
                      setSortOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </DropdownField>
          </div>
          <button
            type="button"
            className={primaryButtonClassName}
            onClick={() => {
              applyFilters();
            }}
          >
            Apply
          </button>
        </div>

        {selectedIds.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
            <p className="text-sm text-[var(--admin-on-surface)]">
              {selectedIds.length} learner{selectedIds.length === 1 ? "" : "s"} selected
            </p>
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={() => {
                openMessageDrawer("selected", selectedIds);
              }}
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              Message selected
            </button>
            <button
              type="button"
              className={ghostButtonClassName}
              onClick={() => {
                setSelectedIds([]);
              }}
            >
              Clear
            </button>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          {attendeesLoading && attendees.length === 0 ? (
            <div>
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] px-4"
                >
                  <Shimmer className="h-4 w-4" />
                  <Shimmer className="h-4 w-32" />
                  <Shimmer className="h-4 w-40" />
                  <Shimmer className="h-4 w-20" />
                  <Shimmer className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : detail.registeredCount === 0 && !hasAttendeeFilters && attendees.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                <Presentation className="h-6 w-6 text-[var(--admin-outline)]" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
                No registrations for this session
              </h3>
              <p className="mt-1 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
                When learners register, they will appear here with join times and coverage.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[var(--admin-surface-low)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--admin-primary)]"
                      checked={attendees.length > 0 && selectedIds.length === attendees.length}
                      onChange={toggleSelectAll}
                      aria-label="Select all visible attendees"
                    />
                  </th>
                  {columns.includes("learner_name") ? <th className="px-4 py-3">Name</th> : null}
                  {columns.includes("email") ? <th className="px-4 py-3">Email</th> : null}
                  {columns.includes("status") ? <th className="px-4 py-3">Status</th> : null}
                  {columns.includes("joined_at") ? <th className="px-4 py-3">Joined</th> : null}
                  {columns.includes("left_at") ? <th className="px-4 py-3">Left</th> : null}
                  {columns.includes("duration_seconds") ? (
                    <th className="px-4 py-3">Duration</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {attendees.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-10 text-center text-[var(--admin-on-surface-variant)]"
                      colSpan={Math.max(2, columns.length + 1)}
                    >
                      No attendees match these filters.
                    </td>
                  </tr>
                ) : (
                  attendees.map((attendee) => {
                    const absent = attendee.status === "absent";
                    const rowCoverage = cancelled
                      ? null
                      : coveragePct(attendee.durationSeconds, detail.durationSeconds);
                    const attendeeHref = `/admin/reports/live-class-attendance/${sessionId}/attendees/${attendee.id}`;
                    return (
                      <tr
                        key={attendee.id}
                        className={[
                          "relative h-11 cursor-pointer border-b border-[var(--admin-border)] transition-colors hover:bg-[var(--admin-surface-high)]",
                          absent
                            ? "bg-[color-mix(in_srgb,var(--admin-danger)_4%,transparent)]"
                            : "",
                        ].join(" ")}
                        onClick={() => {
                          router.push(attendeeHref);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            router.push(attendeeHref);
                          }
                        }}
                        tabIndex={0}
                        role="link"
                        aria-label={`Open detail for ${attendee.learnerName ?? attendee.email ?? "attendee"}`}
                      >
                        <td
                          className="relative px-4 py-3"
                          onClick={(event) => {
                            event.stopPropagation();
                          }}
                          onKeyDown={(event) => {
                            event.stopPropagation();
                          }}
                        >
                          {absent ? (
                            <span
                              className="absolute inset-y-0 left-0 w-[3px] bg-[var(--admin-danger)]"
                              aria-hidden="true"
                            />
                          ) : null}
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[var(--admin-primary)]"
                            checked={selectedIds.includes(attendee.membershipId)}
                            onChange={() => {
                              toggleRow(attendee.membershipId);
                            }}
                            aria-label={`Select ${attendee.learnerName ?? attendee.email ?? "attendee"}`}
                          />
                        </td>
                        {columns.includes("learner_name") ? (
                          <td className="px-4 py-3 font-medium text-[var(--admin-on-surface)]">
                            <Link
                              href={attendeeHref}
                              className="hover:text-[var(--admin-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                              onClick={(event) => {
                                event.stopPropagation();
                              }}
                            >
                              {attendee.learnerName ?? "-"}
                            </Link>
                          </td>
                        ) : null}
                        {columns.includes("email") ? (
                          <td
                            className={[
                              "px-4 py-3 font-mono text-[13px]",
                              absent
                                ? "text-[color-mix(in_srgb,var(--admin-on-surface-variant)_70%,transparent)]"
                                : "text-[var(--admin-on-surface-variant)]",
                            ].join(" ")}
                          >
                            {attendee.email ?? "-"}
                          </td>
                        ) : null}
                        {columns.includes("status") ? (
                          <td className="px-4 py-3">
                            <StatusPill tone={attendeeStatusTone(attendee.status)}>
                              {titleCase(attendee.status)}
                            </StatusPill>
                          </td>
                        ) : null}
                        {columns.includes("joined_at") ? (
                          <td
                            className={[
                              "px-4 py-3 font-mono text-xs",
                              absent
                                ? "text-[color-mix(in_srgb,var(--admin-on-surface-variant)_70%,transparent)]"
                                : "text-[var(--admin-on-surface-variant)]",
                            ].join(" ")}
                          >
                            {cancelled || absent ? "-" : formatDate(attendee.joinedAt)}
                          </td>
                        ) : null}
                        {columns.includes("left_at") ? (
                          <td
                            className={[
                              "px-4 py-3 font-mono text-xs",
                              absent
                                ? "text-[color-mix(in_srgb,var(--admin-on-surface-variant)_70%,transparent)]"
                                : "text-[var(--admin-on-surface-variant)]",
                            ].join(" ")}
                          >
                            {cancelled || absent ? "-" : formatDate(attendee.leftAt)}
                          </td>
                        ) : null}
                        {columns.includes("duration_seconds") ? (
                          <td className="px-4 py-3">
                            {cancelled || absent ? (
                              <span className="font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
                                -
                              </span>
                            ) : (
                              <div className="min-w-[96px]">
                                <p className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                                  {formatDuration(attendee.durationSeconds)}
                                </p>
                                {rowCoverage != null ? (
                                  <>
                                    <div className="mt-1">
                                      <MetricBar
                                        pct={rowCoverage}
                                        tone={metricBarTone(rowCoverage)}
                                      />
                                    </div>
                                    <p className="mt-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                      {formatPct(rowCoverage)}
                                    </p>
                                  </>
                                ) : null}
                              </div>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--admin-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            Showing {rangeStart.toLocaleString()}-{rangeEnd.toLocaleString()} of{" "}
            {totalCount.toLocaleString()} · Attendance rate is attendees divided by registrations.
          </p>
          {totalPages > 1 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={ghostButtonClassName}
                disabled={page <= 1 || attendeesLoading}
                onClick={() => {
                  setPage((current) => Math.max(1, current - 1));
                }}
              >
                Previous
              </button>
              <span className="text-sm text-[var(--admin-on-surface-variant)]">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className={ghostButtonClassName}
                disabled={page >= totalPages || attendeesLoading}
                onClick={() => {
                  setPage((current) => current + 1);
                }}
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <MessageDrawer
        open={messageOpen}
        audience={messageAudience}
        count={messageCount}
        sessionTitle={detail.title}
        subject={messageSubject}
        body={messageBody}
        channelEmail={channelEmail}
        channelInApp={channelInApp}
        busy={messageBusy}
        error={messageError}
        onSubjectChange={setMessageSubject}
        onBodyChange={setMessageBody}
        onChannelEmailChange={setChannelEmail}
        onChannelInAppChange={setChannelInApp}
        onClose={() => {
          if (!messageBusy) {
            setMessageOpen(false);
            setMessageError(null);
          }
        }}
        onSend={() => {
          void handleSendMessage();
        }}
        onTestSend={() => {
          void handleSendMessage({ sendTestToSelf: true });
        }}
      />
    </div>
  );
}
