"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Download,
  Filter,
  Info,
  Laptop,
  Mail,
  Monitor,
  MoreVertical,
  PlayCircle,
  RefreshCw,
  Search,
  Send,
  Smartphone,
  X,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  exportBatchReport,
  fetchBatchLiveSessionAttendees,
  fetchBatchLiveSessionDetail,
  sendBatchMessage,
  type BatchLiveSessionAttendanceKind,
  type BatchLiveSessionAttendeeItem,
  type BatchLiveSessionDetailData,
} from "./admin-batches-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

type SortBy = "learner_name" | "joined_at" | "left_at" | "watch_pct" | "status" | "rejoins";
type SortDir = "asc" | "desc";
type KindFilter = "any" | BatchLiveSessionAttendanceKind;
type MessageMode = "absentees" | "selected";

const PAGE_SIZE = 25;
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const thClass =
  "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]";
const fieldClassName =
  "h-9 w-full rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-xs text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";
const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";
const selectClassName =
  "h-9 min-w-[140px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-medium text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

const MERGE_TAGS = [
  { tag: "{{Learner name}}", label: "Learner name" },
  { tag: "{{Session title}}", label: "Session title" },
  { tag: "{{Recording link}}", label: "Recording link" },
  { tag: "{{Next session date}}", label: "Next session date" },
] as const;

const KIND_OPTIONS: Array<{ value: KindFilter; label: string }> = [
  { value: "any", label: "All statuses" },
  { value: "attended", label: "Attended" },
  { value: "partial", label: "Partial" },
  { value: "absent", label: "Absent" },
  { value: "excused", label: "Excused" },
  { value: "upcoming", label: "Upcoming" },
];

const SORT_OPTIONS: Array<{ value: SortBy; label: string }> = [
  { value: "status", label: "Status" },
  { value: "learner_name", label: "Name" },
  { value: "joined_at", label: "Joined at" },
  { value: "left_at", label: "Left at" },
  { value: "watch_pct", label: "Watch time" },
  { value: "rejoins", label: "Rejoins" },
];

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

function formatPct(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "-";
  return `${Number(v).toFixed(v % 1 === 0 ? 0 : 1)}%`;
}

function formatDateTime(v: string | null | undefined) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeOnly(v: string | null | undefined) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatMinutes(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "-";
  return `${Math.round(v)}m`;
}

function formatWatchPair(actual: number | null | undefined, planned: number | null | undefined) {
  if (actual == null && planned == null) return "-";
  if (actual != null && planned != null) return `${Math.round(actual)}m of ${Math.round(planned)}m`;
  if (actual != null) return `${Math.round(actual)}m`;
  return `of ${Math.round(planned!)}m`;
}

function learnerInitials(name: string | null, email: string | null) {
  const source = (name?.trim() || email?.trim() || "?").replace(/\s+/g, " ");
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function errMsg(e: unknown, fallback: string) {
  if (e instanceof ClientApiError || e instanceof Error) return e.message;
  return fallback;
}

function statusKind(status: string) {
  const s = status.toLowerCase();
  if (s === "cancelled" || s === "canceled") return "cancelled" as const;
  if (s === "live" || s === "in_progress") return "live" as const;
  if (s === "ended" || s === "completed" || s === "held") return "held" as const;
  if (s === "scheduled" || s === "upcoming") return "upcoming" as const;
  return "other" as const;
}

function statusPillClass(status: string) {
  const k = statusKind(status);
  if (k === "held") {
    return "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]";
  }
  if (k === "cancelled") {
    return "border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]";
  }
  if (k === "live") {
    return "border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]";
  }
  return "border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

function statusLabel(status: string) {
  const k = statusKind(status);
  if (k === "held") return "Held";
  if (k === "cancelled") return "Cancelled";
  if (k === "live") return "Live";
  if (k === "upcoming") return "Upcoming";
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function attendanceKindLabel(kind: BatchLiveSessionAttendanceKind) {
  if (kind === "attended") return "Attended";
  if (kind === "partial") return "Partial";
  if (kind === "absent") return "Absent";
  if (kind === "excused") return "Excused";
  return "Upcoming";
}

function attendancePillClass(kind: BatchLiveSessionAttendanceKind) {
  if (kind === "attended") {
    return "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]";
  }
  if (kind === "partial") {
    return "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]";
  }
  if (kind === "absent") {
    return "border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]";
  }
  if (kind === "excused") {
    return "border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]";
  }
  return "border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

function railClass(item: BatchLiveSessionAttendeeItem) {
  if (item.healthRail === "danger" || item.attendanceKind === "absent") {
    return "bg-[var(--admin-danger)]";
  }
  if (
    item.healthRail === "warning" ||
    (item.watchPct != null && item.watchPct < 50 && item.attendanceKind !== "upcoming")
  ) {
    return "bg-[var(--admin-warning)]";
  }
  return "bg-transparent";
}

function barTone(v: number | null | undefined, pass = 50) {
  if (v == null) return "bg-[var(--admin-outline)]";
  if (v >= pass) return "bg-[var(--admin-success)]";
  if (v >= 40) return "bg-[var(--admin-warning)]";
  return "bg-[var(--admin-danger)]";
}

function MiniBar({ value, warningBelow50 }: { value: number | null | undefined; warningBelow50?: boolean }) {
  if (value == null) return null;
  const tone =
    warningBelow50 && value < 50
      ? "bg-[var(--admin-warning)]"
      : barTone(value);
  return (
    <div className="mt-1 h-[3px] w-full max-w-[72px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
      <div
        className={`h-full rounded-full ${tone}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function DeviceIcon({ label }: { label: string }) {
  const lower = label.toLowerCase();
  if (lower.includes("phone") || lower.includes("ios") || lower.includes("android") || lower.includes("mobile")) {
    return <Smartphone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
  }
  if (lower.includes("laptop") || lower.includes("mac") || lower.includes("desktop") || lower.includes("windows")) {
    return <Laptop className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
  }
  return <Monitor className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
}

function parseKind(raw: string | null): KindFilter {
  if (
    raw === "attended" ||
    raw === "partial" ||
    raw === "absent" ||
    raw === "excused" ||
    raw === "upcoming"
  ) {
    return raw;
  }
  return "any";
}

function parseSortBy(raw: string | null): SortBy {
  if (
    raw === "learner_name" ||
    raw === "joined_at" ||
    raw === "left_at" ||
    raw === "watch_pct" ||
    raw === "rejoins"
  ) {
    return raw;
  }
  return "status";
}

function defaultMessageBody(sessionTitle: string) {
  return `Hi {{Learner name}},

You missed {{Session title}} (${sessionTitle}). Catch up using the recording: {{Recording link}}.

Next session: {{Next session date}}.

If you need help, reply to this email.`;
}

function getFocusable(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
  );
}

function AttendanceTimelineChart({
  points,
  dropInsight,
  plannedMinutes,
}: {
  points: Array<{ offsetMinutes: number; concurrent: number }>;
  dropInsight: BatchLiveSessionDetailData["timeline"]["dropInsight"];
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
      ...points.map((p) => p.offsetMinutes),
      dropInsight?.toOffsetMinutes ?? 0,
      1,
    ) || 1;
  const maxY = Math.max(1, ...points.map((p) => p.concurrent));

  const xAt = (offset: number) => padL + (offset / maxX) * plotW;
  const yAt = (concurrent: number) => padT + plotH - (concurrent / maxY) * plotH;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(p.offsetMinutes).toFixed(1)} ${yAt(p.concurrent).toFixed(1)}`)
    .join(" ");

  const areaPath =
    points.length > 0
      ? `${linePath} L ${xAt(points[points.length - 1]!.offsetMinutes).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${xAt(points[0]!.offsetMinutes).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
      : "";

  const tickCount = Math.min(6, Math.max(2, Math.ceil(maxX / 10)));
  const xTicks = Array.from({ length: tickCount + 1 }, (_, i) => Math.round((maxX * i) / tickCount));
  const yTicks = [0, Math.round(maxY / 2), maxY].filter(
    (v, i, arr) => arr.indexOf(v) === i,
  );

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
          fill="color-mix(in srgb, var(--admin-warning) 18%, transparent)"
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
    <div className="flex flex-col gap-6" aria-hidden="true">
      <Shimmer className="h-4 w-28" />
      <Shimmer className="h-3 w-96 max-w-full" />
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
        <div className="space-y-2">
          <Shimmer className="h-8 w-64" />
          <Shimmer className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Shimmer className="h-9 w-36" />
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-40" />
        </div>
      </div>
      <div className="grid grid-cols-1 overflow-hidden rounded-sm border border-[var(--admin-border)] md:grid-cols-6 md:gap-px md:bg-[var(--admin-border)]">
        <div className="space-y-3 bg-[var(--admin-surface)] p-5 md:col-span-2">
          <Shimmer className="h-3 w-24" />
          <Shimmer className="h-8 w-16" />
          <Shimmer className="h-[3px] w-full" />
          <Shimmer className="h-3 w-32" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 bg-[var(--admin-surface)] p-5">
            <Shimmer className="h-3 w-28" />
            <Shimmer className="h-7 w-12" />
            <Shimmer className="h-3 w-20" />
          </div>
        ))}
      </div>
      <Shimmer className="h-52 w-full rounded-lg" />
      <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-[var(--admin-border)] px-4 py-3 last:border-0">
            <Shimmer className="h-4 w-4" />
            <Shimmer className="h-8 w-8 rounded-full" />
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
  mode,
  count,
  sessionTitle,
  subject,
  body,
  busy,
  onSubjectChange,
  onBodyChange,
  onClose,
  onSend,
}: {
  open: boolean;
  mode: MessageMode;
  count: number;
  sessionTitle: string;
  subject: string;
  body: string;
  busy: boolean;
  onSubjectChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onClose: () => void;
  onSend: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel) {
      const focusables = getFocusable(panel);
      (focusables[0] ?? panel).focus();
    }
    return () => {
      previouslyFocused.current?.focus?.();
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
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  function insertTag(tag: string) {
    const el = bodyRef.current;
    if (!el) {
      onBodyChange(`${body}${tag}`);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = `${body.slice(0, start)}${tag}${body.slice(end)}`;
    onBodyChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + tag.length;
      el.setSelectionRange(pos, pos);
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close message drawer overlay"
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <aside
        ref={(el) => {
          panelRef.current = el;
        }}
        className="relative z-10 flex h-full w-full max-w-[560px] flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="flex items-start justify-between border-b border-[var(--admin-border)] px-6 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-[var(--admin-on-surface)]">
              {mode === "absentees" ? "Message absentees" : "Message selected"}
            </h2>
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
              {mode === "absentees"
                ? `${count} learner${count === 1 ? "" : "s"} did not attend ${sessionTitle}`
                : `Sending to ${count} selected learner${count === 1 ? "" : "s"}`}
            </p>
          </div>
          <button
            type="button"
            className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <label className="grid gap-1.5 text-xs text-[var(--admin-on-surface-variant)]">
            Subject
            <input
              className={fieldClassName}
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              maxLength={200}
            />
          </label>

          <div className="space-y-2">
            <p className="text-xs text-[var(--admin-on-surface-variant)]">Merge tags</p>
            <div className="flex flex-wrap gap-2">
              {MERGE_TAGS.map((item) => (
                <button
                  key={item.tag}
                  type="button"
                  className="inline-flex h-7 items-center rounded-md border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] px-2.5 font-mono text-[11px] text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                  onClick={() => insertTag(item.tag)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <label className="grid gap-1.5 text-xs text-[var(--admin-on-surface-variant)]">
            Message
            <textarea
              ref={bodyRef}
              className={`${fieldClassName} h-auto min-h-[180px] py-2`}
              rows={8}
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              maxLength={10000}
            />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-xs text-[var(--admin-on-surface-variant)]">Delivery</legend>
            <label className="flex items-center gap-2 text-sm text-[var(--admin-on-surface)]">
              <input
                type="checkbox"
                checked
                readOnly
                className="h-4 w-4 accent-[var(--admin-primary)]"
              />
              Email
              <span className="text-xs text-[var(--admin-on-surface-variant)]">(queued via batch message)</span>
            </label>
          </fieldset>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--admin-border)] px-6 py-4">
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
            {busy ? "Sending…" : `Send to ${count} learner${count === 1 ? "" : "s"}`}
          </button>
        </div>
      </aside>
    </div>
  );
}

export function AdminBatchSessionAttendancePage({
  batchId,
  sessionId,
}: {
  batchId: string;
  sessionId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchId = useId();

  const q = searchParams.get("q") ?? "";
  const pageRaw = Number(searchParams.get("page"));
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const sortBy = parseSortBy(searchParams.get("sortBy"));
  const sortDir: SortDir = searchParams.get("sortDir") === "desc" ? "desc" : "asc";
  const kind = parseKind(searchParams.get("kind"));

  const [draftQ, setDraftQ] = useState(q);
  const [detail, setDetail] = useState<BatchLiveSessionDetailData | null>(null);
  const [items, setItems] = useState<BatchLiveSessionAttendeeItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);

  const [messageOpen, setMessageOpen] = useState(false);
  const [messageMode, setMessageMode] = useState<MessageMode>("absentees");
  const [messageIds, setMessageIds] = useState<string[]>([]);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [messageBusy, setMessageBusy] = useState(false);

  const basePath = `/admin/reports/batches/${batchId}/live-sessions/${sessionId}`;

  const replaceParams = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const query = params.toString();
      router.replace(query ? `${basePath}?${query}` : basePath);
    },
    [basePath, router, searchParams],
  );

  useEffect(() => setDraftQ(q), [q]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = draftQ.trim();
      if (next === q) return;
      replaceParams({ q: next || null, page: "1" });
    }, 300);
    return () => window.clearTimeout(t);
  }, [draftQ, q, replaceParams]);

  useEffect(() => {
    if (!rowMenuId) return;
    function onDoc(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-row-menu]")) return;
      setRowMenuId(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setRowMenuId(null);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [rowMenuId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detailRes, attendeesRes] = await Promise.all([
        fetchBatchLiveSessionDetail(batchId, sessionId),
        fetchBatchLiveSessionAttendees(batchId, sessionId, {
          ...(q.trim() ? { q: q.trim() } : {}),
          attendanceKind: kind,
          sortBy,
          sortDir,
          page,
          limit: PAGE_SIZE,
        }),
      ]);
      setDetail(detailRes.data);
      setItems(attendeesRes.data.items);
      setTotalCount(attendeesRes.data.pageInfo.totalCount);
      setTotalPages(attendeesRes.data.pageInfo.totalPages);
      setSelectedIds((current) =>
        current.filter((id) => attendeesRes.data.items.some((row) => row.membershipId === id)),
      );
    } catch (e) {
      setDetail(null);
      setItems([]);
      setError(errMsg(e, "Couldn't load session attendance."));
    } finally {
      setLoading(false);
    }
  }, [batchId, sessionId, q, kind, sortBy, sortDir, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const cancelled = detail ? statusKind(detail.session.status) === "cancelled" : false;
  const upcoming = detail ? statusKind(detail.session.status) === "upcoming" : false;
  const showTimeline =
    !!detail &&
    !cancelled &&
    !upcoming &&
    detail.timeline.points.length > 0;

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);

  const watchCoveragePct = useMemo(() => {
    if (!detail?.summary.avgWatchMinutes || !detail.summary.plannedWatchMinutes) return null;
    return Math.min(
      100,
      (detail.summary.avgWatchMinutes / detail.summary.plannedWatchMinutes) * 100,
    );
  }, [detail]);

  function toggleSelectAll() {
    if (items.length === 0) return;
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(items.map((row) => row.membershipId));
  }

  function toggleRow(membershipId: string) {
    setSelectedIds((current) =>
      current.includes(membershipId)
        ? current.filter((id) => id !== membershipId)
        : [...current, membershipId],
    );
  }

  async function handleExport(membershipIds?: string[]) {
    setBusy(true);
    setActionError(null);
    try {
      const response = await exportBatchReport({
        batchId,
        sessionId,
        ...(membershipIds && membershipIds.length > 0 ? { membershipIds } : {}),
        emailDownloadLink: true,
      });
      const completed = await pollReportRunUntilComplete(response.data.runId);
      if (completed.status === "failed") throw new Error(completed.errorMessage ?? "Export failed.");
      if (completed.status === "completed") await downloadReportExport(completed.id, "csv");
    } catch (e) {
      setActionError(errMsg(e, "Unable to export report."));
    } finally {
      setBusy(false);
    }
  }

  async function openMessageAbsentees() {
    if (!detail) return;
    setBusy(true);
    setActionError(null);
    try {
      const response = await fetchBatchLiveSessionAttendees(batchId, sessionId, {
        attendanceKind: "absent",
        page: 1,
        limit: 500,
        sortBy: "learner_name",
        sortDir: "asc",
      });
      const ids = response.data.items.map((row) => row.membershipId);
      if (ids.length === 0) {
        setActionError("No absentees to message for this session.");
        return;
      }
      setMessageMode("absentees");
      setMessageIds(ids);
      setMessageSubject(`You missed: ${detail.session.title}`);
      setMessageBody(defaultMessageBody(detail.session.title));
      setMessageOpen(true);
    } catch (e) {
      setActionError(errMsg(e, "Couldn't load absentees."));
    } finally {
      setBusy(false);
    }
  }

  function openMessageSelected() {
    if (!detail || selectedIds.length === 0) return;
    setMessageMode("selected");
    setMessageIds([...selectedIds]);
    setMessageSubject(`You missed: ${detail.session.title}`);
    setMessageBody(defaultMessageBody(detail.session.title));
    setMessageOpen(true);
  }

  async function handleSendMessage() {
    if (!messageSubject.trim() || !messageBody.trim() || messageIds.length === 0) return;
    setMessageBusy(true);
    setActionError(null);
    try {
      await sendBatchMessage({
        batchId,
        membershipIds: messageIds,
        subject: messageSubject.trim(),
        message: messageBody.trim(),
      });
      setMessageOpen(false);
      setMessageSubject("");
      setMessageBody("");
      setMessageIds([]);
      if (messageMode === "selected") setSelectedIds([]);
    } catch (e) {
      setActionError(errMsg(e, "Couldn't send message."));
    } finally {
      setMessageBusy(false);
    }
  }

  function onRowMenuKey(event: ReactKeyboardEvent) {
    if (event.key === "Escape") setRowMenuId(null);
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
            className="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--admin-danger)] px-4 text-xs font-semibold text-white hover:opacity-90"
            onClick={() => void load()}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
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

  const session = detail.session;
  const summary = detail.summary;
  const durationMinutes =
    session.actualDurationMinutes ?? session.plannedDurationMinutes ?? null;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
      <Link
        href={`/admin/reports/batches/${batchId}/live-sessions`}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All sessions
      </Link>

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
        <Link href="/admin/reports/batches" className="hover:text-[var(--admin-primary)]">
          Batches
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link
          href={`/admin/reports/batches/${batchId}`}
          className="hover:text-[var(--admin-primary)]"
        >
          {detail.batchName}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium text-[var(--admin-on-surface)]">{session.title}</span>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
              {session.title}
            </h1>
            <span
              className={`inline-flex rounded-md border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.06em] ${statusPillClass(session.status)}`}
            >
              {statusLabel(session.status)}
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Scheduled {formatDateTime(session.scheduledAt)}
            {durationMinutes != null ? (
              <>
                {" "}
                · {durationMinutes}m
              </>
            ) : null}
            {" "}
            · Hosted by {session.hostLabel ?? "-"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {session.recordingUrl ? (
            <a
              href={session.recordingUrl}
              target="_blank"
              rel="noreferrer"
              className={secondaryButtonClassName}
            >
              <PlayCircle className="h-4 w-4" aria-hidden="true" />
              Open recording
            </a>
          ) : null}
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={busy || cancelled}
            onClick={() => void handleExport()}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </button>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={busy || cancelled || upcoming}
            onClick={() => void openMessageAbsentees()}
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            Message absentees
          </button>
        </div>
      </div>

      {actionError ? (
        <div
          className="flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-4 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
            <p className="text-sm text-[var(--admin-danger)]">{actionError}</p>
          </div>
          <button type="button" className={ghostButtonClassName} onClick={() => setActionError(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      {cancelled ? (
        <div className="rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-16 text-center">
          <AlertTriangle
            className="mx-auto mb-4 h-10 w-10 text-[var(--admin-outline)]"
            aria-hidden="true"
            strokeWidth={1.5}
          />
          <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
            This session was cancelled
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
            No attendance was recorded for this session.
          </p>
          <Link
            href={`/admin/reports/batches/${batchId}/live-sessions`}
            className={`${secondaryButtonClassName} mt-6`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to all sessions
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-1 overflow-hidden rounded-sm border border-[var(--admin-border)] md:grid-cols-6 md:gap-px md:bg-[var(--admin-border)]">
        <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5 md:col-span-2">
          <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
            Attendance
          </p>
          <p className="font-mono text-[32px] font-medium leading-none text-[var(--admin-on-surface)]">
            {cancelled ? "-" : formatPct(summary.attendancePct)}
          </p>
          {!cancelled ? (
            <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
              <div
                className={`h-full rounded-full ${barTone(summary.attendancePct)}`}
                style={{
                  width: `${Math.max(0, Math.min(100, summary.attendancePct ?? 0))}%`,
                }}
              />
            </div>
          ) : null}
          <p className="mt-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
            {cancelled
              ? "-"
              : `${summary.attendedCount} of ${summary.rosterCount} learners`}
          </p>
        </div>
        <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5">
          <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
            Average watch time
          </p>
          <p className="font-mono text-2xl font-medium leading-none text-[var(--admin-on-surface)]">
            {cancelled ? "-" : formatMinutes(summary.avgWatchMinutes)}
          </p>
          {!cancelled && watchCoveragePct != null ? (
            <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
              <div
                className={`h-full rounded-full ${barTone(watchCoveragePct)}`}
                style={{ width: `${Math.max(0, Math.min(100, watchCoveragePct))}%` }}
              />
            </div>
          ) : null}
          <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
            {cancelled
              ? "-"
              : summary.plannedWatchMinutes != null
                ? `of ${Math.round(summary.plannedWatchMinutes)}m planned`
                : "vs planned"}
          </p>
        </div>
        <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5">
          <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-warning)]">
            Late joins
          </p>
          <p className="font-mono text-2xl font-medium leading-none text-[var(--admin-warning)]">
            {cancelled ? "-" : summary.lateJoinCount}
          </p>
          <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
            {cancelled ? "-" : `> ${detail.rules.lateJoinGraceMinutes}m after start`}
          </p>
        </div>
        <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5">
          <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
            Left early
          </p>
          <p className="font-mono text-2xl font-medium leading-none text-[var(--admin-on-surface)]">
            {cancelled ? "-" : summary.leftEarlyCount}
          </p>
        </div>
        <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5">
          <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
            Peak concurrent
          </p>
          <p className="font-mono text-2xl font-medium leading-none text-[var(--admin-on-surface)]">
            {cancelled ? "-" : summary.peakConcurrent ?? "-"}
          </p>
          <p className="mt-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
            {cancelled
              ? "-"
              : summary.peakConcurrentAt
                ? `at ${formatTimeOnly(summary.peakConcurrentAt)}`
                : ""}
          </p>
        </div>
      </div>

      {showTimeline ? (
        <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--admin-on-surface)]">
              Attendance timeline
            </h2>
            <p className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
              Concurrent viewers · {detail.timeline.bucketMinutes}m buckets
            </p>
          </div>
          {detail.timeline.dropInsight ? (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] px-3 py-2.5">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
                aria-hidden="true"
              />
              <p className="text-sm text-[var(--admin-on-surface)]">
                {detail.timeline.dropInsight.message}
              </p>
            </div>
          ) : null}
          <AttendanceTimelineChart
            points={detail.timeline.points}
            dropInsight={detail.timeline.dropInsight}
            plannedMinutes={session.plannedDurationMinutes}
          />
        </section>
      ) : !cancelled && upcoming ? (
        <section className="rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-10 text-center">
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Timeline will appear after this session is held.
          </p>
        </section>
      ) : null}

      {!cancelled ? (
        <>
          {selectedIds.length > 0 ? (
            <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-primary)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] px-4 py-3 shadow-sm">
              <p className="text-sm text-[var(--admin-on-surface)]">
                <span className="font-mono font-medium">{selectedIds.length}</span> learner
                {selectedIds.length === 1 ? "" : "s"} selected
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  onClick={openMessageSelected}
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  Message selected
                </button>
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  disabled={busy}
                  onClick={() => void handleExport(selectedIds)}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Export selection
                </button>
                <button
                  type="button"
                  className={ghostButtonClassName}
                  onClick={() => setSelectedIds([])}
                >
                  Clear
                </button>
              </div>
            </div>
          ) : null}

          <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                    aria-hidden="true"
                  />
                  <label htmlFor={searchId} className="sr-only">
                    Search learners
                  </label>
                  <input
                    id={searchId}
                    className={`${fieldClassName} pl-9`}
                    placeholder="Search name or email"
                    value={draftQ}
                    onChange={(e) => setDraftQ(e.target.value)}
                  />
                </div>
                <div className="inline-flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
                  <Select
                    className={selectClassName}
                    ariaLabel="Filter by attendance"
                    value={kind}
                    onValueChange={(value) =>
                      replaceParams({ kind: value === "any" ? null : value, page: "1" })
                    }
                    options={KIND_OPTIONS}
                  />
                </div>
                <Select
                  className={selectClassName}
                  ariaLabel="Sort by"
                  value={sortBy}
                  onValueChange={(value) =>
                    replaceParams({
                      sortBy: value === "status" ? null : value,
                      page: "1",
                    })
                  }
                  options={SORT_OPTIONS}
                />
                <button
                  type="button"
                  className={ghostButtonClassName}
                  onClick={() =>
                    replaceParams({ sortDir: sortDir === "asc" ? "desc" : "asc", page: "1" })
                  }
                >
                  {sortDir === "asc" ? "Asc" : "Desc"}
                </button>
              </div>
              <p className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                Showing {rangeStart}-{rangeEnd} of {totalCount}
              </p>
            </div>

            {loading && items.length === 0 ? (
              <div className="space-y-0">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 border-b border-[var(--admin-border)] px-4 py-3 last:border-b-0"
                  >
                    <Shimmer className="h-4 w-4" />
                    <Shimmer className="h-8 w-8 rounded-full" />
                    <Shimmer className="h-4 w-40" />
                    <Shimmer className="ml-auto h-4 w-24" />
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="text-sm font-medium text-[var(--admin-on-surface)]">No learners match</p>
                <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                  Try clearing search or changing the attendance filter.
                </p>
              </div>
            ) : (
              <div className={`overflow-x-auto ${loading ? "opacity-60" : ""}`}>
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                      <th className="w-11 px-3 py-2.5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--admin-primary)]"
                          checked={items.length > 0 && selectedIds.length === items.length}
                          onChange={toggleSelectAll}
                          aria-label="Select all learners on this page"
                        />
                      </th>
                      <th className={thClass}>Learner</th>
                      <th className={thClass}>Attendance</th>
                      <th className={thClass}>Joined at</th>
                      <th className={thClass}>Left at</th>
                      <th className={thClass}>Watch time</th>
                      <th className={thClass}>Rejoins</th>
                      <th className={thClass}>Device</th>
                      <th className={`${thClass} w-12`}>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => {
                      const name = row.learnerName?.trim() || row.email?.trim() || "Learner";
                      const dimWatch =
                        row.attendanceKind === "absent" ||
                        (row.watchPct != null && row.watchPct < 50);
                      return (
                        <tr
                          key={row.membershipId}
                          className="group relative border-b border-[var(--admin-border)] last:border-b-0 hover:bg-[var(--admin-surface-low)]"
                        >
                          <td className="relative px-3 py-3">
                            <span
                              className={`absolute inset-y-0 left-0 w-1 ${railClass(row)}`}
                              aria-hidden="true"
                            />
                            <input
                              type="checkbox"
                              className="ml-2 h-4 w-4 accent-[var(--admin-primary)]"
                              checked={selectedIds.includes(row.membershipId)}
                              onChange={() => toggleRow(row.membershipId)}
                              aria-label={`Select ${name}`}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface-high)] font-mono text-[11px] font-semibold text-[var(--admin-on-surface)]"
                                aria-hidden="true"
                              >
                                {learnerInitials(row.learnerName, row.email)}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-[var(--admin-on-surface)]">
                                  {name}
                                </p>
                                <p className="truncate font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                  {row.email ?? "-"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-md border px-2 py-0.5 font-mono text-[11px] ${attendancePillClass(row.attendanceKind)}`}
                            >
                              {attendanceKindLabel(row.attendanceKind)}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[var(--admin-on-surface)]">
                            {formatTimeOnly(row.joinedAt)}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[var(--admin-on-surface)]">
                            {formatTimeOnly(row.leftAt)}
                          </td>
                          <td className="px-4 py-3">
                            <p
                              className={[
                                "font-mono text-xs",
                                dimWatch
                                  ? "text-[var(--admin-on-surface-variant)]"
                                  : "text-[var(--admin-on-surface)]",
                              ].join(" ")}
                            >
                              {formatWatchPair(row.watchMinutes, row.plannedMinutes)}
                            </p>
                            <MiniBar value={row.watchPct} warningBelow50 />
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[var(--admin-on-surface)]">
                            {row.rejoins == null ? "-" : row.rejoins}
                          </td>
                          <td className="px-4 py-3">
                            {row.deviceLabel ? (
                              <span className="inline-flex items-center gap-1.5 text-xs text-[var(--admin-on-surface)]">
                                <DeviceIcon label={row.deviceLabel} />
                                {row.deviceLabel}
                              </span>
                            ) : (
                              <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                                -
                              </span>
                            )}
                          </td>
                          <td className="relative px-3 py-3" data-row-menu>
                            <button
                              type="button"
                              className="rounded p-1.5 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                              aria-label={`Actions for ${name}`}
                              aria-expanded={rowMenuId === row.membershipId}
                              onClick={() =>
                                setRowMenuId((c) =>
                                  c === row.membershipId ? null : row.membershipId,
                                )
                              }
                              onKeyDown={onRowMenuKey}
                            >
                              <MoreVertical className="h-4 w-4" aria-hidden="true" />
                            </button>
                            {rowMenuId === row.membershipId ? (
                              <div className="absolute right-3 top-9 z-30 min-w-[200px] rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 shadow-lg">
                                <Link
                                  href={`/admin/reports/batches/${batchId}/learners/${row.membershipId}`}
                                  className="block px-3 py-2 text-left text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                                  onClick={() => setRowMenuId(null)}
                                >
                                  View learner report
                                </Link>
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                                  onClick={() => {
                                    setRowMenuId(null);
                                    setSelectedIds([row.membershipId]);
                                    setMessageMode("selected");
                                    setMessageIds([row.membershipId]);
                                    setMessageSubject(`You missed: ${session.title}`);
                                    setMessageBody(defaultMessageBody(session.title));
                                    setMessageOpen(true);
                                  }}
                                >
                                  Message learner
                                </button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {totalPages > 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] px-4 py-3">
                <p className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    disabled={page <= 1}
                    onClick={() => replaceParams({ page: String(page - 1) })}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    disabled={page >= totalPages}
                    onClick={() => replaceParams({ page: String(page + 1) })}
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}

            <div className="flex items-start gap-2 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
              <Info
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <p className="text-[11px] leading-relaxed text-[var(--admin-on-surface-variant)]">
                Attended requires &gt;{detail.rules.attendedMinWatchPct}% watch time. Partial is
                above {detail.rules.partialMinWatchPct}%. Warning rail when watch is below{" "}
                {detail.rules.warningWatchPct}%. Late joins are &gt;
                {detail.rules.lateJoinGraceMinutes}m after start. Absent rows use a danger rail.
              </p>
            </div>
          </section>
        </>
      ) : null}

      <MessageDrawer
        open={messageOpen}
        mode={messageMode}
        count={messageIds.length}
        sessionTitle={session.title}
        subject={messageSubject}
        body={messageBody}
        busy={messageBusy}
        onSubjectChange={setMessageSubject}
        onBodyChange={setMessageBody}
        onClose={() => {
          if (!messageBusy) setMessageOpen(false);
        }}
        onSend={() => void handleSendMessage()}
      />
    </div>
  );
}
