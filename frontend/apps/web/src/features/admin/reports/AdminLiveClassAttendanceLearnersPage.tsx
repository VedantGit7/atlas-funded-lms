"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronRight,
  Columns3,
  Download,
  Mail,
  MoreVertical,
  Presentation,
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
  memberInitials,
} from "../../studio/courses/admin-form-dropdown-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  dateInputToEndIso,
  dateInputToStartIso,
  fetchLiveClassAttendanceLearners,
  fetchLiveClassAttendanceLearnersMatrix,
  LIVE_LEARNER_ATTENDANCE_COLUMN_OPTIONS,
  sendLiveClassAttendanceMessage,
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

type ModuleTab = "sessions" | "learners" | "series" | "exports";
type DatePreset = "7d" | "30d" | "90d" | "custom";
type ViewMode = "list" | "matrix";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-transparent px-4 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-low)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const fieldClassName =
  "h-9 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

const DEFAULT_COLUMNS: LiveLearnerAttendanceColumnKey[] = [
  "learner_name",
  "batch",
  "registered_count",
  "attendance_rate",
  "absent_count",
  "avg_coverage",
  "last_attended",
  "streak",
];

const EMPTY_SUMMARY: LiveLearnersListSummary = {
  learnersRegistered: 0,
  avgAttendanceRatePct: null,
  neverAttendedCount: 0,
  perfectAttendanceCount: 0,
  avgCoveragePct: null,
};

const ATTENDANCE_RATE_OPTIONS: Array<{ value: LiveLearnerAttendanceRateBand | ""; label: string }> =
  [
    { value: "", label: "Any" },
    { value: "below_40", label: "Below 40%" },
    { value: "mid_40_75", label: "40–75%" },
    { value: "above_75", label: "Above 75%" },
    { value: "never_attended", label: "Never attended" },
    { value: "perfect", label: "Perfect attendance" },
  ];

const SESSIONS_REGISTERED_OPTIONS: Array<{
  value: LiveLearnerSessionsRegisteredBand | "";
  label: string;
}> = [
  { value: "", label: "Any" },
  { value: "1", label: "1 session" },
  { value: "2_5", label: "2–5 sessions" },
  { value: "gt_5", label: "More than 5" },
];

const LAST_ATTENDED_OPTIONS: Array<{ value: LiveLearnerLastAttendedFilter | ""; label: string }> = [
  { value: "", label: "Any" },
  { value: "last_7d", label: "Last 7 days" },
  { value: "last_30d", label: "Last 30 days" },
  { value: "never", label: "Never" },
  { value: "not_in_30d", label: "Not in 30 days" },
];

const SORT_OPTIONS: Array<{
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

function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "-";
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${String(hours)}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${String(minutes)}m`;
  return `${String(total)}s`;
}

function presetToRange(preset: DatePreset): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (preset === "7d") from.setDate(from.getDate() - 7);
  else if (preset === "30d") from.setDate(from.getDate() - 30);
  else if (preset === "90d") from.setDate(from.getDate() - 90);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function MetricBar({
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

function healthRailClass(health: LiveLearnerListItem["health"]): string {
  if (health === "danger") return "border-l-2 border-l-[var(--admin-danger)]";
  if (health === "warning") return "border-l-2 border-l-[var(--admin-warning)]";
  return "border-l-2 border-l-transparent";
}

function streakTone(kind: LiveLearnerListItem["streakKind"]): "success" | "warning" | "muted" {
  if (kind === "attended") return "success";
  if (kind === "missed") return "warning";
  return "muted";
}

function StreakPill({ learner }: { learner: LiveLearnerListItem }) {
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

function matrixCellClass(cell: LiveLearnersMatrixCell): string {
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

function matrixCellLabel(cell: LiveLearnersMatrixCell): string {
  if (cell === "attended") return "Attended";
  if (cell === "absent") return "Absent";
  if (cell === "registered") return "Registered";
  return "Not registered";
}

function LearnersLoadingSkeleton() {
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

function ModuleTabs({ active }: { active: ModuleTab }) {
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

function exportLearnersCsv(
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

  const escape = (value: string) => {
    if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  };

  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "live-class-attendance-learners.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function SortHeader({
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

function MatrixLegend() {
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

function AttendanceMatrix({
  matrix,
  loading,
}: {
  matrix: LiveLearnersMatrix | null;
  loading: boolean;
}) {
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

export function AdminLiveClassAttendanceLearnersPage() {
  const router = useRouter();
  const datePresetLabelId = useId();
  const columnsLabelId = useId();
  const attendanceRateLabelId = useId();
  const sessionsRegisteredLabelId = useId();
  const lastAttendedLabelId = useId();
  const sortLabelId = useId();

  const [loading, setLoading] = useState(true);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [learners, setLearners] = useState<LiveLearnerListItem[]>([]);
  const [summary, setSummary] = useState<LiveLearnersListSummary>(EMPTY_SUMMARY);
  const [matrix, setMatrix] = useState<LiveLearnersMatrix | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [menuLearnerId, setMenuLearnerId] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const initialRange = presetToRange("30d");
  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [scheduledFrom, setScheduledFrom] = useState(initialRange.from);
  const [scheduledTo, setScheduledTo] = useState(initialRange.to);

  const [searchQ, setSearchQ] = useState("");
  const [attendanceRateBand, setAttendanceRateBand] = useState<LiveLearnerAttendanceRateBand | "">(
    "",
  );
  const [sessionsRegisteredBand, setSessionsRegisteredBand] = useState<
    LiveLearnerSessionsRegisteredBand | ""
  >("");
  const [lastAttended, setLastAttended] = useState<LiveLearnerLastAttendedFilter | "">("");
  const [sortBy, setSortBy] = useState<LiveLearnerSortBy>("attendance_rate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [columns, setColumns] = useState<LiveLearnerAttendanceColumnKey[]>(DEFAULT_COLUMNS);

  const [columnsOpen, setColumnsOpen] = useState(false);
  const [attendanceRateOpen, setAttendanceRateOpen] = useState(false);
  const [sessionsRegisteredOpen, setSessionsRegisteredOpen] = useState(false);
  const [lastAttendedOpen, setLastAttendedOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const [remindOpen, setRemindOpen] = useState(false);
  const [remindAudience, setRemindAudience] = useState<"low_attendance" | "selected">(
    "low_attendance",
  );
  const [remindIds, setRemindIds] = useState<string[]>([]);
  const [remindSubject, setRemindSubject] = useState(
    "We noticed you've missed recent live sessions",
  );
  const [remindBody, setRemindBody] = useState(
    "Hi {{learner_name}},\n\nWe noticed your attendance on recent live sessions has been lower than expected. Please join the next scheduled session or reach out if you need support.",
  );
  const [remindBusy, setRemindBusy] = useState(false);
  const [remindError, setRemindError] = useState<string | null>(null);

  const datePresetLabel =
    datePreset === "7d"
      ? "Last 7 days"
      : datePreset === "90d"
        ? "Last 90 days"
        : datePreset === "custom"
          ? "Custom range"
          : "Last 30 days";

  const matrixFilterPayload = useMemo(() => {
    const payload: Parameters<typeof fetchLiveClassAttendanceLearnersMatrix>[0] = {};
    const trimmedQ = searchQ.trim();
    if (trimmedQ) payload.q = trimmedQ;
    const fromIso = dateInputToStartIso(scheduledFrom);
    if (fromIso) payload.scheduledFrom = fromIso;
    const toIso = dateInputToEndIso(scheduledTo);
    if (toIso) payload.scheduledTo = toIso;
    if (attendanceRateBand) payload.attendanceRateBand = attendanceRateBand;
    if (sessionsRegisteredBand) payload.sessionsRegisteredBand = sessionsRegisteredBand;
    if (lastAttended) payload.lastAttended = lastAttended;
    return payload;
  }, [
    attendanceRateBand,
    lastAttended,
    scheduledFrom,
    scheduledTo,
    searchQ,
    sessionsRegisteredBand,
  ]);
  const filterPayload = useMemo(() => {
    const payload: Parameters<typeof fetchLiveClassAttendanceLearners>[0] = {
      sortBy,
      sortDir,
      columns,
    };
    const trimmedQ = searchQ.trim();
    if (trimmedQ) payload.q = trimmedQ;
    const fromIso = dateInputToStartIso(scheduledFrom);
    if (fromIso) payload.scheduledFrom = fromIso;
    const toIso = dateInputToEndIso(scheduledTo);
    if (toIso) payload.scheduledTo = toIso;
    if (attendanceRateBand) payload.attendanceRateBand = attendanceRateBand;
    if (sessionsRegisteredBand) payload.sessionsRegisteredBand = sessionsRegisteredBand;
    if (lastAttended) payload.lastAttended = lastAttended;
    return payload;
  }, [
    attendanceRateBand,
    columns,
    lastAttended,
    scheduledFrom,
    scheduledTo,
    searchQ,
    sessionsRegisteredBand,
    sortBy,
    sortDir,
  ]);

  const hasActiveFilters =
    Boolean(searchQ.trim()) ||
    Boolean(attendanceRateBand) ||
    Boolean(sessionsRegisteredBand) ||
    Boolean(lastAttended);

  const sortLabel =
    SORT_OPTIONS.find((option) => option.sortBy === sortBy && option.sortDir === sortDir)?.label ??
    "Attendance rate ↑";

  const attendanceRateLabel =
    ATTENDANCE_RATE_OPTIONS.find((option) => option.value === attendanceRateBand)?.label ?? "Any";

  const sessionsRegisteredLabel =
    SESSIONS_REGISTERED_OPTIONS.find((option) => option.value === sessionsRegisteredBand)?.label ??
    "Any";

  const lastAttendedLabel =
    LAST_ATTENDED_OPTIONS.find((option) => option.value === lastAttended)?.label ?? "Any";

  const closeFilterMenus = useCallback(() => {
    setColumnsOpen(false);
    setAttendanceRateOpen(false);
    setSessionsRegisteredOpen(false);
    setLastAttendedOpen(false);
    setSortOpen(false);
  }, []);

  const applyDatePreset = useCallback((preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === "custom") return;
    const range = presetToRange(preset);
    setScheduledFrom(range.from);
    setScheduledTo(range.to);
    setPage(1);
  }, []);

  const loadLearners = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchLiveClassAttendanceLearners({
        ...filterPayload,
        page,
      });
      setLearners(response.data.items);
      setSummary(response.data.summary);
      setTotalPages(response.data.pageInfo.totalPages);
      setTotalCount(response.data.pageInfo.totalCount);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load learners.",
      );
      setLearners([]);
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [filterPayload, page]);

  const loadMatrix = useCallback(async () => {
    setMatrixLoading(true);
    try {
      const response = await fetchLiveClassAttendanceLearnersMatrix(matrixFilterPayload);
      setMatrix(response.data);
    } catch {
      setMatrix(null);
    } finally {
      setMatrixLoading(false);
    }
  }, [matrixFilterPayload]);

  useEffect(() => {
    void loadLearners();
  }, [loadLearners]);

  useEffect(() => {
    if (viewMode === "matrix") {
      void loadMatrix();
    }
  }, [viewMode, loadMatrix]);

  useEffect(() => {
    if (!menuLearnerId) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-learner-menu]")) {
        setMenuLearnerId(null);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [menuLearnerId]);

  function openLearner(learner: LiveLearnerListItem) {
    router.push(`/admin/reports/live-class-attendance/learners/${learner.membershipId}`);
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedIds((current) => {
      const visibleIds = learners.map((learner) => learner.membershipId);
      const allSelected = visibleIds.every((id) => current.has(id));
      if (allSelected) {
        const next = new Set(current);
        for (const id of visibleIds) next.delete(id);
        return next;
      }
      const next = new Set(current);
      for (const id of visibleIds) next.add(id);
      return next;
    });
  }

  function toggleColumn(key: LiveLearnerAttendanceColumnKey) {
    setColumns((current) => {
      if (current.includes(key)) {
        if (current.length === 1) return current;
        return current.filter((col) => col !== key);
      }
      return [...current, key];
    });
    setPage(1);
  }

  function clearFilters() {
    setSearchQ("");
    setAttendanceRateBand("");
    setSessionsRegisteredBand("");
    setLastAttended("");
    setPage(1);
  }

  function resetFiltersAndRange() {
    applyDatePreset("30d");
    clearFilters();
  }

  function handleSortHeader(nextSortBy: LiveLearnerSortBy) {
    if (sortBy === nextSortBy) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(nextSortBy);
      setSortDir(
        nextSortBy === "attendance_rate" || nextSortBy === "last_attended" ? "asc" : "desc",
      );
    }
    setPage(1);
  }

  function openLowAttendanceMessage() {
    setRemindAudience("low_attendance");
    setRemindIds([]);
    setRemindError(null);
    setRemindOpen(true);
  }

  function openSelectedMessage(ids: string[]) {
    setRemindAudience("selected");
    setRemindIds(ids);
    setRemindError(null);
    setRemindOpen(true);
  }

  async function handleSendMessage() {
    if (!remindSubject.trim() || !remindBody.trim()) return;
    if (remindAudience === "selected" && remindIds.length === 0) return;

    setRemindBusy(true);
    setRemindError(null);
    try {
      await sendLiveClassAttendanceMessage({
        audience: remindAudience,
        ...(remindAudience === "selected" ? { membershipIds: remindIds } : {}),
        subject: remindSubject.trim(),
        message: remindBody.trim(),
        channels: ["email", "in_app"],
      });
      setRemindOpen(false);
      setSelectedIds(new Set());
    } catch (sendError) {
      setRemindError(
        sendError instanceof ClientApiError
          ? sendError.message
          : sendError instanceof Error
            ? sendError.message
            : "Couldn't send reminder.",
      );
    } finally {
      setRemindBusy(false);
    }
  }

  const remindCount =
    remindAudience === "selected"
      ? remindIds.length
      : summary.learnersRegistered > 0
        ? Math.max(0, summary.learnersRegistered - summary.perfectAttendanceCount)
        : 0;

  const remindTitle =
    remindAudience === "low_attendance" ? "Low-attendance learners" : "Selected learners";

  function columnVisible(key: LiveLearnerAttendanceColumnKey): boolean {
    return columns.includes(key);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
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
        <span className="text-[var(--admin-on-surface)]">Learners</span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
            Learners
          </h1>
          <p className="mt-1 max-w-[65ch] text-sm text-[var(--admin-on-surface-variant)]">
            Attendance across every live session a learner was registered for.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[180px]">
            <DropdownField
              label={<span className="sr-only">Date range</span>}
              labelId={datePresetLabelId}
              open={dateMenuOpen}
              onToggle={() => {
                setDateMenuOpen((open) => !open);
                closeFilterMenus();
              }}
              triggerContent={
                <span className="flex w-full items-center gap-2 text-[13px] font-medium text-[var(--admin-on-surface)]">
                  <Calendar
                    className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
                    aria-hidden="true"
                  />
                  <span className="flex-1 text-left">{datePresetLabel}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-[var(--admin-on-surface-variant)] transition-transform duration-200 ${dateMenuOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </span>
              }
              panelAriaLabel="Date range presets"
            >
              <div className="p-1.5" role="listbox">
                {(
                  [
                    ["7d", "Last 7 days"],
                    ["30d", "Last 30 days"],
                    ["90d", "Last 90 days"],
                    ["custom", "Custom"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="option"
                    aria-selected={datePreset === value}
                    className={dropdownItemClassName}
                    onClick={() => {
                      applyDatePreset(value);
                      setDateMenuOpen(false);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </DropdownField>
          </div>

          <div className="min-w-[140px]">
            <DropdownField
              label={<span className="sr-only">Columns</span>}
              labelId={columnsLabelId}
              open={columnsOpen}
              onToggle={() => {
                setColumnsOpen((open) => !open);
                setDateMenuOpen(false);
                setAttendanceRateOpen(false);
                setSessionsRegisteredOpen(false);
                setLastAttendedOpen(false);
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
                {LIVE_LEARNER_ATTENDANCE_COLUMN_OPTIONS.map((column) => {
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
            disabled={loading || learners.length === 0}
            onClick={() => {
              exportLearnersCsv(learners, columns);
            }}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </button>

          <button
            type="button"
            className={primaryButtonClassName}
            onClick={openLowAttendanceMessage}
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            Message low-attendance learners
          </button>
        </div>
      </div>

      {datePreset === "custom" ? (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
          <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
            From
            <input
              type="date"
              className={fieldClassName}
              value={scheduledFrom}
              onChange={(event) => {
                setScheduledFrom(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
            To
            <input
              type="date"
              className={fieldClassName}
              value={scheduledTo}
              onChange={(event) => {
                setScheduledTo(event.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
      ) : null}

      <ModuleTabs active="learners" />

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-danger)]">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error.includes("Couldn't load") ? "Couldn't load learners." : error}</span>
          </div>
          <button
            type="button"
            className="rounded-lg border border-[var(--admin-danger)] bg-transparent px-3 py-1 text-sm font-semibold text-[var(--admin-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)]"
            onClick={() => void loadLearners()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading && learners.length === 0 && !error ? (
        <LearnersLoadingSkeleton />
      ) : !loading && learners.length === 0 && !error ? (
        <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
              <Users className="h-7 w-7 text-[var(--admin-outline)]" aria-hidden="true" />
            </div>
            <h2 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
              No learners registered for sessions in this range
            </h2>
            <p className="mb-6 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
              Try widening the date range or clearing filters to see registered learners.
            </p>
            <button type="button" className={primaryButtonClassName} onClick={resetFiltersAndRange}>
              Reset filters
            </button>
          </div>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-12 gap-4 md:gap-8">
            <div className="relative col-span-12 flex flex-col justify-between overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:col-span-4">
              <div className="absolute bottom-0 left-0 top-0 w-1 bg-[var(--admin-primary-strong)]" />
              <div>
                <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Learners registered
                </h3>
                <div className="font-mono text-3xl font-semibold text-[var(--admin-on-surface)]">
                  {formatCount(summary.learnersRegistered)}
                </div>
              </div>
              <p className="mt-4 text-sm text-[var(--admin-on-surface-variant)]">
                for at least one session in range
              </p>
            </div>

            <div className="col-span-12 flex flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:col-span-6 md:col-span-2">
              <div>
                <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Average attendance rate
                </h3>
                <div className="font-mono text-2xl font-semibold text-[var(--admin-on-surface)]">
                  {formatPct(summary.avgAttendanceRatePct)}
                </div>
              </div>
              <div className="mt-3">
                <MetricBar pct={summary.avgAttendanceRatePct} />
              </div>
            </div>

            <button
              type="button"
              className="col-span-12 flex flex-col justify-between rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_5%,var(--admin-surface))] p-5 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] active:translate-y-px sm:col-span-6 md:col-span-2"
              onClick={() => {
                setAttendanceRateBand("never_attended");
                setPage(1);
              }}
            >
              <div>
                <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-danger)]">
                  Never attended
                </h3>
                <div className="font-mono text-2xl font-semibold text-[var(--admin-danger)]">
                  {formatCount(summary.neverAttendedCount)}
                </div>
              </div>
              <p className="mt-auto text-xs leading-tight text-[var(--admin-danger)]">
                registered but never joined
              </p>
            </button>

            <button
              type="button"
              className="col-span-12 flex flex-col justify-between rounded-lg border border-[color-mix(in_srgb,var(--admin-success)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_5%,var(--admin-surface))] p-5 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] active:translate-y-px sm:col-span-6 md:col-span-2"
              onClick={() => {
                setAttendanceRateBand("perfect");
                setPage(1);
              }}
            >
              <div>
                <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-success)]">
                  Perfect attendance
                </h3>
                <div className="font-mono text-2xl font-semibold text-[var(--admin-success)]">
                  {formatCount(summary.perfectAttendanceCount)}
                </div>
              </div>
            </button>

            <div className="col-span-12 flex flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:col-span-6 md:col-span-2">
              <div>
                <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Average coverage
                </h3>
                <div className="font-mono text-2xl font-semibold text-[var(--admin-on-surface)]">
                  {formatPct(summary.avgCoveragePct)}
                </div>
              </div>
              <div className="mt-3">
                <MetricBar pct={summary.avgCoveragePct} tone="success" />
              </div>
            </div>
          </div>

          <p className="text-xs italic text-[var(--admin-on-surface-variant)]">
            Attendance rate is sessions attended divided by sessions registered.
          </p>

          {selectedIds.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] px-4 py-3">
              <p className="text-sm text-[var(--admin-on-surface)]">
                <span className="font-semibold">{formatCount(selectedIds.size)}</span> learner
                {selectedIds.size === 1 ? "" : "s"} selected
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={primaryButtonClassName}
                  onClick={() => {
                    openSelectedMessage(Array.from(selectedIds));
                  }}
                >
                  Message selected
                </button>
                <button
                  type="button"
                  className={ghostButtonClassName}
                  onClick={() => {
                    setSelectedIds(new Set());
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className="inline-flex rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-0.5"
              role="tablist"
              aria-label="View mode"
            >
              {(
                [
                  ["list", "List"],
                  ["matrix", "Matrix"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={viewMode === mode}
                  className={[
                    "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                    viewMode === mode
                      ? "bg-[var(--admin-surface)] text-[var(--admin-primary)] shadow-sm"
                      : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                  ].join(" ")}
                  onClick={() => {
                    setViewMode(mode);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {viewMode === "matrix" ? (
              <p className="text-xs text-[var(--admin-on-surface-variant)] lg:hidden">
                Open on a larger screen to see the attendance matrix
              </p>
            ) : null}
          </div>

          {viewMode === "matrix" ? (
            <AttendanceMatrix matrix={matrix} loading={matrixLoading} />
          ) : null}

          {viewMode === "list" ? (
            <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
              <div className="flex flex-wrap items-end gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
                <label className="grid min-w-[200px] flex-1 gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                  Search
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                      aria-hidden="true"
                    />
                    <input
                      className={`${fieldClassName} w-full pl-9`}
                      value={searchQ}
                      onChange={(event) => {
                        setSearchQ(event.target.value);
                      }}
                      placeholder="Search learner name or email"
                    />
                  </div>
                </label>

                <div className="min-w-[160px]">
                  <DropdownField
                    label="Attendance rate"
                    labelId={attendanceRateLabelId}
                    open={attendanceRateOpen}
                    onToggle={() => {
                      setAttendanceRateOpen((open) => !open);
                      setColumnsOpen(false);
                      setSessionsRegisteredOpen(false);
                      setLastAttendedOpen(false);
                      setSortOpen(false);
                    }}
                    triggerContent={
                      <span className="flex w-full items-center gap-2 text-[13px] font-medium text-[var(--admin-on-surface)]">
                        <span className="flex-1 truncate text-left">{attendanceRateLabel}</span>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)] transition-transform duration-200 ${attendanceRateOpen ? "rotate-180" : ""}`}
                          aria-hidden="true"
                        />
                      </span>
                    }
                    panelAriaLabel="Attendance rate filter"
                  >
                    <div className="p-1.5" role="listbox">
                      {ATTENDANCE_RATE_OPTIONS.map((option) => (
                        <button
                          key={option.value || "all"}
                          type="button"
                          role="option"
                          aria-selected={attendanceRateBand === option.value}
                          className={dropdownItemClassName}
                          onClick={() => {
                            setAttendanceRateBand(option.value);
                            setAttendanceRateOpen(false);
                            setPage(1);
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </DropdownField>
                </div>

                <div className="min-w-[160px]">
                  <DropdownField
                    label="Sessions registered"
                    labelId={sessionsRegisteredLabelId}
                    open={sessionsRegisteredOpen}
                    onToggle={() => {
                      setSessionsRegisteredOpen((open) => !open);
                      setColumnsOpen(false);
                      setAttendanceRateOpen(false);
                      setLastAttendedOpen(false);
                      setSortOpen(false);
                    }}
                    triggerContent={
                      <span className="flex w-full items-center gap-2 text-[13px] font-medium text-[var(--admin-on-surface)]">
                        <span className="flex-1 truncate text-left">{sessionsRegisteredLabel}</span>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)] transition-transform duration-200 ${sessionsRegisteredOpen ? "rotate-180" : ""}`}
                          aria-hidden="true"
                        />
                      </span>
                    }
                    panelAriaLabel="Sessions registered filter"
                  >
                    <div className="p-1.5" role="listbox">
                      {SESSIONS_REGISTERED_OPTIONS.map((option) => (
                        <button
                          key={option.value || "all"}
                          type="button"
                          role="option"
                          aria-selected={sessionsRegisteredBand === option.value}
                          className={dropdownItemClassName}
                          onClick={() => {
                            setSessionsRegisteredBand(option.value);
                            setSessionsRegisteredOpen(false);
                            setPage(1);
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </DropdownField>
                </div>

                <div className="min-w-[160px]">
                  <DropdownField
                    label="Last attended"
                    labelId={lastAttendedLabelId}
                    open={lastAttendedOpen}
                    onToggle={() => {
                      setLastAttendedOpen((open) => !open);
                      setColumnsOpen(false);
                      setAttendanceRateOpen(false);
                      setSessionsRegisteredOpen(false);
                      setSortOpen(false);
                    }}
                    triggerContent={
                      <span className="flex w-full items-center gap-2 text-[13px] font-medium text-[var(--admin-on-surface)]">
                        <span className="flex-1 truncate text-left">{lastAttendedLabel}</span>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)] transition-transform duration-200 ${lastAttendedOpen ? "rotate-180" : ""}`}
                          aria-hidden="true"
                        />
                      </span>
                    }
                    panelAriaLabel="Last attended filter"
                  >
                    <div className="p-1.5" role="listbox">
                      {LAST_ATTENDED_OPTIONS.map((option) => (
                        <button
                          key={option.value || "all"}
                          type="button"
                          role="option"
                          aria-selected={lastAttended === option.value}
                          className={dropdownItemClassName}
                          onClick={() => {
                            setLastAttended(option.value);
                            setLastAttendedOpen(false);
                            setPage(1);
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </DropdownField>
                </div>

                <div className="min-w-[200px]">
                  <DropdownField
                    label="Sort"
                    labelId={sortLabelId}
                    open={sortOpen}
                    onToggle={() => {
                      setSortOpen((open) => !open);
                      setColumnsOpen(false);
                      setAttendanceRateOpen(false);
                      setSessionsRegisteredOpen(false);
                      setLastAttendedOpen(false);
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
                    panelAriaLabel="Sort learners"
                  >
                    <div className="p-1.5" role="listbox">
                      {SORT_OPTIONS.map((option) => (
                        <button
                          key={`${option.sortBy}-${option.sortDir}`}
                          type="button"
                          role="option"
                          aria-selected={sortBy === option.sortBy && sortDir === option.sortDir}
                          className={dropdownItemClassName}
                          onClick={() => {
                            setSortBy(option.sortBy);
                            setSortDir(option.sortDir);
                            setSortOpen(false);
                            setPage(1);
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
                    if (page !== 1) setPage(1);
                    else void loadLearners();
                  }}
                >
                  Search
                </button>
              </div>

              {hasActiveFilters ? (
                <div className="flex flex-wrap items-center gap-2 border-b border-[var(--admin-border)] px-4 py-3">
                  <button type="button" className={ghostButtonClassName} onClick={clearFilters}>
                    Clear filters
                  </button>
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead className="bg-[var(--admin-surface-low)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    <tr>
                      <th className="w-11 px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label="Select all visible learners"
                          checked={
                            learners.length > 0 &&
                            learners.every((learner) => selectedIds.has(learner.membershipId))
                          }
                          onChange={toggleSelectAllVisible}
                        />
                      </th>
                      {columnVisible("learner_name") ? (
                        <th className="px-4 py-3">Learner</th>
                      ) : null}
                      {columnVisible("batch") ? <th className="px-4 py-3">Batch</th> : null}
                      {columnVisible("registered_count") ? (
                        <th className="px-4 py-3">Registered</th>
                      ) : null}
                      {columnVisible("attendance_rate") || columnVisible("attended_count") ? (
                        <th className="px-4 py-3">
                          <SortHeader
                            label="Attended rate"
                            active={sortBy === "attendance_rate" || sortBy === "sessions_attended"}
                            dir={sortDir}
                            onClick={() => {
                              handleSortHeader(
                                sortBy === "sessions_attended"
                                  ? "sessions_attended"
                                  : "attendance_rate",
                              );
                            }}
                          />
                        </th>
                      ) : null}
                      {columnVisible("absent_count") ? <th className="px-4 py-3">Absent</th> : null}
                      {columnVisible("total_time") ? (
                        <th className="px-4 py-3">
                          <SortHeader
                            label="Total time"
                            active={sortBy === "total_time"}
                            dir={sortDir}
                            onClick={() => {
                              handleSortHeader("total_time");
                            }}
                          />
                        </th>
                      ) : null}
                      {columnVisible("avg_coverage") ? (
                        <th className="px-4 py-3">Avg coverage</th>
                      ) : null}
                      {columnVisible("last_attended") ? (
                        <th className="px-4 py-3">
                          <SortHeader
                            label="Last attended"
                            active={sortBy === "last_attended"}
                            dir={sortDir}
                            onClick={() => {
                              handleSortHeader("last_attended");
                            }}
                          />
                        </th>
                      ) : null}
                      {columnVisible("streak") ? <th className="px-4 py-3">Streak</th> : null}
                      <th className="w-11 px-4 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {learners.map((learner) => {
                      const selected = selectedIds.has(learner.membershipId);
                      return (
                        <tr
                          key={learner.membershipId}
                          className={[
                            "h-11 cursor-pointer border-b border-[var(--admin-border)] transition-colors",
                            healthRailClass(learner.health),
                            selected
                              ? "bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))]"
                              : "hover:bg-[var(--admin-surface-high)]",
                          ].join(" ")}
                          onClick={() => {
                            openLearner(learner);
                          }}
                        >
                          <td
                            className="px-4 py-3"
                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                          >
                            <input
                              type="checkbox"
                              aria-label={`Select ${learner.learnerName ?? learner.email ?? "learner"}`}
                              checked={selected}
                              onChange={() => {
                                toggleSelected(learner.membershipId);
                              }}
                            />
                          </td>
                          {columnVisible("learner_name") ? (
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] font-mono text-[11px] font-semibold text-[var(--admin-on-surface-variant)]">
                                  {memberInitials(learner.learnerName, learner.email)}
                                </span>
                                <div>
                                  <Link
                                    href={`/admin/reports/live-class-attendance/learners/${learner.membershipId}`}
                                    className="font-medium text-[var(--admin-primary)] hover:underline"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                    }}
                                  >
                                    {learner.learnerName ?? "Unknown learner"}
                                  </Link>
                                  {columnVisible("email") ? (
                                    <div className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                      {learner.email ?? "-"}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                          ) : null}
                          {columnVisible("batch") ? (
                            <td className="px-4 py-3">
                              <span className="rounded border border-[var(--admin-border)] px-1.5 py-0.5 text-[11px] text-[var(--admin-on-surface-variant)]">
                                {learner.batchName ?? "No batch"}
                              </span>
                            </td>
                          ) : null}
                          {columnVisible("registered_count") ? (
                            <td className="px-4 py-3 font-mono text-[13px]">
                              {formatCount(learner.registeredCount)}
                            </td>
                          ) : null}
                          {columnVisible("attendance_rate") || columnVisible("attended_count") ? (
                            <td className="px-4 py-3">
                              <div className="min-w-[120px]">
                                <div
                                  className={[
                                    "font-mono text-[13px]",
                                    learner.attendanceRatePct != null &&
                                    learner.attendanceRatePct < 40
                                      ? "text-[var(--admin-warning)]"
                                      : "text-[var(--admin-on-surface)]",
                                  ].join(" ")}
                                >
                                  {formatCount(learner.attendedCount)} of{" "}
                                  {formatCount(learner.registeredCount)}
                                  <span className="ml-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                                    {formatPct(learner.attendanceRatePct)}
                                  </span>
                                </div>
                                <div className="mt-1.5">
                                  <MetricBar
                                    pct={learner.attendanceRatePct}
                                    tone={
                                      learner.attendanceRatePct != null &&
                                      learner.attendanceRatePct < 40
                                        ? "warning"
                                        : "primary"
                                    }
                                  />
                                </div>
                              </div>
                            </td>
                          ) : null}
                          {columnVisible("absent_count") ? (
                            <td
                              className={[
                                "px-4 py-3 font-mono text-[13px]",
                                learner.absentCount > 0
                                  ? "text-[var(--admin-danger)]"
                                  : "text-[var(--admin-on-surface)]",
                              ].join(" ")}
                            >
                              {formatCount(learner.absentCount)}
                            </td>
                          ) : null}
                          {columnVisible("total_time") ? (
                            <td className="px-4 py-3 font-mono text-[13px]">
                              {formatDuration(learner.totalTimeSeconds)}
                            </td>
                          ) : null}
                          {columnVisible("avg_coverage") ? (
                            <td className="px-4 py-3">
                              <div className="min-w-[88px]">
                                <div
                                  className={[
                                    "font-mono text-[13px]",
                                    learner.avgCoveragePct != null && learner.avgCoveragePct < 40
                                      ? "text-[var(--admin-warning)]"
                                      : "text-[var(--admin-on-surface)]",
                                  ].join(" ")}
                                >
                                  {formatPct(learner.avgCoveragePct)}
                                </div>
                                <div className="mt-1.5">
                                  <MetricBar
                                    pct={learner.avgCoveragePct}
                                    tone={
                                      learner.avgCoveragePct != null && learner.avgCoveragePct < 40
                                        ? "warning"
                                        : "success"
                                    }
                                  />
                                </div>
                              </div>
                            </td>
                          ) : null}
                          {columnVisible("last_attended") ? (
                            <td className="px-4 py-3">
                              {learner.lastAttendedSessionId && learner.lastAttendedSessionTitle ? (
                                <div>
                                  <Link
                                    href={`/admin/reports/live-class-attendance/${learner.lastAttendedSessionId}`}
                                    className="font-medium text-[var(--admin-primary)] hover:underline"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                    }}
                                  >
                                    {learner.lastAttendedSessionTitle}
                                  </Link>
                                  <div className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                    {formatDate(learner.lastAttendedAt)}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs font-semibold text-[var(--admin-danger)]">
                                  Never attended
                                </span>
                              )}
                            </td>
                          ) : null}
                          {columnVisible("streak") ? (
                            <td className="px-4 py-3">
                              <StreakPill learner={learner} />
                            </td>
                          ) : null}
                          <td
                            className="relative px-4 py-3"
                            data-learner-menu
                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                          >
                            <button
                              type="button"
                              className="rounded-full p-1.5 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                              aria-label={`Actions for ${learner.learnerName ?? "learner"}`}
                              onClick={() => {
                                setMenuLearnerId((current) =>
                                  current === learner.membershipId ? null : learner.membershipId,
                                );
                              }}
                            >
                              <MoreVertical className="h-4 w-4" aria-hidden="true" />
                            </button>
                            {menuLearnerId === learner.membershipId ? (
                              <div className="absolute right-4 top-full z-30 min-w-[180px] rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 shadow-lg">
                                <button
                                  type="button"
                                  className={dropdownItemClassName}
                                  onClick={() => {
                                    openLearner(learner);
                                    setMenuLearnerId(null);
                                  }}
                                >
                                  View attendance
                                </button>
                                <Link
                                  href={`/admin/members/${learner.membershipId}`}
                                  className={dropdownItemClassName}
                                  onClick={() => {
                                    setMenuLearnerId(null);
                                  }}
                                >
                                  Open member profile
                                </Link>
                                <button
                                  type="button"
                                  className={dropdownItemClassName}
                                  onClick={() => {
                                    openSelectedMessage([learner.membershipId]);
                                    setMenuLearnerId(null);
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

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] px-4 py-3">
                <p className="text-xs text-[var(--admin-on-surface-variant)]">
                  Showing{" "}
                  <span className="font-mono">
                    {totalCount === 0
                      ? "0"
                      : `${String((page - 1) * 25 + 1)}-${String((page - 1) * 25 + learners.length)}`}
                  </span>{" "}
                  of <span className="font-mono">{formatCount(totalCount)}</span> learners
                </p>
                {totalPages > 1 ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={ghostButtonClassName}
                      disabled={page <= 1 || loading}
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
                      disabled={page >= totalPages || loading}
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
          ) : null}
        </>
      )}

      <section className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-8 text-center lg:hidden">
        <Presentation className="mb-2 h-6 w-6 text-[var(--admin-outline)]" aria-hidden="true" />
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          Open on a larger screen to see the attendance matrix
        </p>
      </section>

      <RemindModal
        open={remindOpen}
        title={remindTitle}
        count={remindCount}
        subject={remindSubject}
        body={remindBody}
        busy={remindBusy}
        error={remindError}
        onSubjectChange={setRemindSubject}
        onBodyChange={setRemindBody}
        onClose={() => {
          if (!remindBusy) setRemindOpen(false);
        }}
        onSend={() => void handleSendMessage()}
      />
    </div>
  );
}
