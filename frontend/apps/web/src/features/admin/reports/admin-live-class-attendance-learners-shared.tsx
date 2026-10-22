"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Send, X } from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { memberInitials } from "../../studio/courses/admin-form-dropdown-shared";
import {
  LIVE_LEARNER_ATTENDANCE_COLUMN_OPTIONS,
  LIVE_LEARNERS_DEFAULTS,
  type LiveLearnerAttendanceColumnKey,
  type LiveLearnerAttendanceRateBand,
  type LiveLearnerLastAttendedFilter,
  type LiveLearnerListItem,
  type LiveLearnerSessionsRegisteredBand,
  type LiveLearnerSortBy,
  type LiveLearnersListSummary,
  type LiveLearnersMatrix,
  type LiveLearnersMatrixCell,
} from "./admin-live-class-attendance-roster-api";
import { useViewerLocale, withViewer, type ViewerLocale } from "./viewer-time";
import { csvEscape } from "@/lib/export/csv";

export type ModuleTab = "sessions" | "learners" | "series" | "exports";

export type DatePreset = "7d" | "30d" | "90d" | "custom";

export type ViewMode = "list" | "matrix";

export const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-transparent px-4 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-low)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

export const fieldClassName =
  "h-9 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

export const DEFAULT_COLUMNS: LiveLearnerAttendanceColumnKey[] = [
  ...LIVE_LEARNERS_DEFAULTS.columns,
];

export const EMPTY_SUMMARY: LiveLearnersListSummary = {
  learnersRegistered: 0,
  avgAttendanceRatePct: null,
  neverAttendedCount: 0,
  perfectAttendanceCount: 0,
  avgCoveragePct: null,
};

export const ATTENDANCE_RATE_OPTIONS: Array<{
  value: LiveLearnerAttendanceRateBand | "";
  label: string;
}> = [
  { value: "", label: "Any" },
  { value: "below_40", label: "Below 40%" },
  { value: "mid_40_75", label: "40–75%" },
  { value: "above_75", label: "Above 75%" },
  { value: "never_attended", label: "Never attended" },
  { value: "perfect", label: "Perfect attendance" },
];

export const SESSIONS_REGISTERED_OPTIONS: Array<{
  value: LiveLearnerSessionsRegisteredBand | "";
  label: string;
}> = [
  { value: "", label: "Any" },
  { value: "1", label: "1 session" },
  { value: "2_5", label: "2–5 sessions" },
  { value: "gt_5", label: "More than 5" },
];

export const LAST_ATTENDED_OPTIONS: Array<{
  value: LiveLearnerLastAttendedFilter | "";
  label: string;
}> = [
  { value: "", label: "Any" },
  { value: "last_7d", label: "Last 7 days" },
  { value: "last_30d", label: "Last 30 days" },
  { value: "never", label: "Never" },
  { value: "not_in_30d", label: "Not in 30 days" },
];

export const SORT_OPTIONS: Array<{
  sortBy: LiveLearnerSortBy;
  sortDir: "asc" | "desc";
  label: string;
}> = [
  { sortBy: "attendance_rate", sortDir: "asc", label: "Attendance rate ↑" },
  { sortBy: "attendance_rate", sortDir: "desc", label: "Attendance rate ↓" },
  { sortBy: "sessions_attended", sortDir: "desc", label: "Sessions attended ↓" },
  { sortBy: "total_time", sortDir: "desc", label: "Total time ↓" },
  { sortBy: "last_attended", sortDir: "asc", label: "Last attended ↑" },
  { sortBy: "last_attended", sortDir: "desc", label: "Last attended ↓" },
  { sortBy: "learner_name", sortDir: "asc", label: "Learner name A–Z" },
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

export function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)}%`;
}

export function formatCountFor(value: number, viewer: ViewerLocale): string {
  return value.toLocaleString(viewer.locale);
}

export function formatDateFor(value: string | null, viewer: ViewerLocale): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(viewer.locale, {
    timeZone: viewer.timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "-";
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${String(hours)}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${String(minutes)}m`;
  return `${String(total)}s`;
}

export function MetricBar({
  pct,
  tone = "primary",
}: {
  pct: number | null;
  tone?: "primary" | "success" | "warning";
}) {
  const width = Math.max(0, Math.min(100, pct ?? 0));
  const fill =
    tone === "success"
      ? "bg-[var(--admin-success)]"
      : tone === "warning"
        ? "bg-[var(--admin-warning)]"
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

export function healthRailClass(health: LiveLearnerListItem["health"]): string {
  if (health === "danger") return "border-l-2 border-l-[var(--admin-danger)]";
  if (health === "warning") return "border-l-2 border-l-[var(--admin-warning)]";
  return "border-l-2 border-l-transparent";
}

export function streakTone(
  kind: LiveLearnerListItem["streakKind"],
): "success" | "warning" | "muted" {
  if (kind === "attended") return "success";
  if (kind === "missed") return "warning";
  return "muted";
}

export function StreakPill({ learner }: { learner: LiveLearnerListItem }) {
  const tone = streakTone(learner.streakKind);
  const tones = {
    success:
      "border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]",
    warning:
      "border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]",
    muted:
      "border-[var(--admin-outline)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-semibold ${tones[tone]}`}
    >
      {learner.streakLabel}
    </span>
  );
}

export function matrixCellClass(cell: LiveLearnersMatrixCell): string {
  if (cell === "attended") {
    return "bg-[var(--admin-success)]";
  }
  if (cell === "absent") {
    return "bg-[var(--admin-danger)]";
  }
  if (cell === "registered") {
    return "bg-[var(--admin-surface-high)]";
  }
  return "border border-[var(--admin-outline)] bg-transparent";
}

export function matrixCellLabel(cell: LiveLearnersMatrixCell): string {
  if (cell === "attended") return "Attended";
  if (cell === "absent") return "Absent";
  if (cell === "registered") return "Registered";
  return "Not registered";
}

export function LearnersLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading learners">
      <div className="grid grid-cols-12 gap-4 md:gap-8">
        <div className="relative col-span-12 overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:col-span-4">
          <div className="absolute bottom-0 left-0 top-0 w-1 bg-[var(--admin-primary-strong)]" />
          <Shimmer className="mb-2 h-3 w-28" />
          <Shimmer className="mb-4 h-9 w-16" />
          <Shimmer className="h-3 w-48" />
        </div>
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="col-span-12 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:col-span-6 md:col-span-2"
          >
            <Shimmer className="mb-2 h-3 w-20" />
            <Shimmer className="mb-3 h-8 w-14" />
            <Shimmer className="h-[3px] w-full" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex items-end gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
          <Shimmer className="h-8 w-48" />
          <Shimmer className="h-8 w-32" />
          <Shimmer className="h-8 w-32" />
        </div>
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] px-4 last:border-b-0"
          >
            <Shimmer className="h-4 w-[25%]" />
            <Shimmer className="h-4 w-[15%]" />
            <Shimmer className="h-4 w-[20%]" />
            <Shimmer className="h-4 w-[20%]" />
            <Shimmer className="h-4 w-[20%]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function RemindModal({
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

export function ModuleTabs({ active }: { active: ModuleTab }) {
  const tabs: Array<{ key: ModuleTab; label: string; href?: string }> = [
    { key: "sessions", label: "Sessions", href: "/admin/reports/live-class-attendance" },
    { key: "learners", label: "Learners", href: "/admin/reports/live-class-attendance/learners" },
    { key: "series", label: "Series", href: "/admin/reports/live-class-attendance/series" },
    { key: "exports", label: "Exports", href: "/admin/reports/live-class-attendance/exports" },
  ];

  return (
    <div className="flex gap-8 border-b border-[var(--admin-border)]">
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        const className = [
          "pb-3 text-sm transition-colors",
          isActive
            ? "border-b-2 border-[var(--admin-primary-strong)] font-semibold text-[var(--admin-primary-strong)]"
            : "border-b-2 border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
        ].join(" ");

        if (tab.href) {
          return (
            <Link key={tab.key} href={tab.href} className={className}>
              {tab.label}
            </Link>
          );
        }

        return (
          <span key={tab.key} className={className} aria-current={isActive ? "page" : undefined}>
            {tab.label}
          </span>
        );
      })}
    </div>
  );
}

export function exportLearnersCsv(
  items: LiveLearnerListItem[],
  columns: LiveLearnerAttendanceColumnKey[],
) {
  const columnLabels = new Map(
    LIVE_LEARNER_ATTENDANCE_COLUMN_OPTIONS.map((col) => [col.key, col.label]),
  );
  const headers = columns.map((key) => columnLabels.get(key) ?? key);
  const rows = items.map((learner) =>
    columns.map((key) => {
      switch (key) {
        case "learner_name":
          return learner.learnerName ?? "";
        case "email":
          return learner.email ?? "";
        case "batch":
          return learner.batchName ?? "";
        case "registered_count":
          return String(learner.registeredCount);
        case "attended_count":
          return String(learner.attendedCount);
        case "attendance_rate":
          return learner.attendanceRatePct == null ? "" : String(learner.attendanceRatePct);
        case "absent_count":
          return String(learner.absentCount);
        case "total_time":
          return String(learner.totalTimeSeconds);
        case "avg_coverage":
          return learner.avgCoveragePct == null ? "" : String(learner.avgCoveragePct);
        case "last_attended":
          return learner.lastAttendedAt ?? "";
        case "streak":
          return learner.streakLabel;
        default:
          return "";
      }
    }),
  );

  // Attendance rows include learner display names, so this needs the formula
  // guard in csvEscape and not just quoting (M1).
  const escape = (value: string) => csvEscape(value);

  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "live-class-attendance-learners.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={[
        "inline-flex items-center gap-1 font-semibold uppercase tracking-[0.06em]",
        active ? "text-[var(--admin-primary-strong)]" : "text-[var(--admin-on-surface-variant)]",
      ].join(" ")}
      onClick={onClick}
    >
      {label}
      {active ? <span className="font-mono text-[10px]">{dir === "asc" ? "↑" : "↓"}</span> : null}
    </button>
  );
}

export function MatrixLegend() {
  const items: Array<{ cell: LiveLearnersMatrixCell; label: string }> = [
    { cell: "attended", label: "Attended" },
    { cell: "absent", label: "Absent" },
    { cell: "registered", label: "Registered" },
    { cell: "not_registered", label: "Not registered" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--admin-on-surface-variant)]">
      {items.map((item) => (
        <span key={item.cell} className="inline-flex items-center gap-1.5">
          <span
            className={`inline-block h-3 w-3 rounded-sm ${matrixCellClass(item.cell)}`}
            aria-hidden="true"
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function AttendanceMatrix({
  matrix,
  loading,
}: {
  matrix: LiveLearnersMatrix | null;
  loading: boolean;
}) {
  const viewer = useViewerLocale();
  const formatDate = withViewer(formatDateFor, viewer);
  if (loading) {
    return (
      <div className="hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 lg:block">
        <Shimmer className="mb-4 h-4 w-48" />
        <Shimmer className="h-64 w-full" />
      </div>
    );
  }

  if (!matrix || matrix.learners.length === 0) {
    return null;
  }

  const cellMap = (learner: LiveLearnersMatrix["learners"][number]) => {
    const map = new Map<string, LiveLearnersMatrixCell>();
    for (const cell of learner.cells) {
      map.set(cell.sessionId, cell.cell);
    }
    return map;
  };

  return (
    <div className="hidden flex-col gap-3 lg:flex">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MatrixLegend />
        {matrix.attentionRequired ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] px-2 py-1 text-xs font-semibold text-[var(--admin-warning)]">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            Attention required
          </span>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-[var(--admin-surface-low)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                <th className="sticky left-0 z-20 min-w-[200px] border-b border-r border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
                  Learner
                </th>
                {matrix.sessions.map((session) => (
                  <th
                    key={session.sessionId}
                    className="min-w-[72px] border-b border-[var(--admin-border)] px-2 py-3 text-center"
                  >
                    <div className="max-w-[72px] truncate font-medium normal-case text-[var(--admin-on-surface)]">
                      {session.title}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] font-normal normal-case text-[var(--admin-on-surface-variant)]">
                      {formatDate(session.scheduledAt)}
                    </div>
                  </th>
                ))}
                <th className="sticky right-0 z-20 min-w-[100px] border-b border-l border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
                  Rate
                </th>
              </tr>
            </thead>
            <tbody>
              {matrix.learners.map((learner) => {
                const cells = cellMap(learner);
                return (
                  <tr
                    key={learner.membershipId}
                    className="border-b border-[var(--admin-border)] last:border-b-0"
                  >
                    <td className="sticky left-0 z-10 border-r border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] font-mono text-[10px] font-semibold text-[var(--admin-on-surface-variant)]">
                          {memberInitials(learner.learnerName, learner.email)}
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/admin/reports/live-class-attendance/learners/${learner.membershipId}`}
                            className="truncate font-medium text-[var(--admin-primary)] hover:underline"
                          >
                            {learner.learnerName ?? "Unknown learner"}
                          </Link>
                          <div className="truncate font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                            {learner.email ?? "-"}
                          </div>
                        </div>
                      </div>
                    </td>
                    {matrix.sessions.map((session) => {
                      const cell = cells.get(session.sessionId) ?? "not_registered";
                      return (
                        <td key={session.sessionId} className="px-2 py-2 text-center">
                          <span
                            className={`inline-block h-4 w-4 rounded-sm ${matrixCellClass(cell)}`}
                            title={matrixCellLabel(cell)}
                            aria-label={matrixCellLabel(cell)}
                          />
                        </td>
                      );
                    })}
                    <td className="sticky right-0 z-10 border-l border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2">
                      <div className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                        {formatPct(learner.attendanceRatePct)}
                      </div>
                      <div className="mt-1 min-w-[72px]">
                        <MetricBar
                          pct={learner.attendanceRatePct}
                          tone={
                            learner.attendanceRatePct != null && learner.attendanceRatePct < 40
                              ? "warning"
                              : "primary"
                          }
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-[var(--admin-surface-low)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                <td className="sticky left-0 z-10 border-r border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
                  Session turnout
                </td>
                {matrix.sessions.map((session) => (
                  <td
                    key={session.sessionId}
                    className="px-2 py-3 text-center font-mono text-[11px]"
                  >
                    {formatPct(session.turnoutRatePct)}
                  </td>
                ))}
                <td className="sticky right-0 z-10 border-l border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3" />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
