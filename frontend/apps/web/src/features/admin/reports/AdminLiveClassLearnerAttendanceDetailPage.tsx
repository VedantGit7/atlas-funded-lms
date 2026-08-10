"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  FileText,
  MessageSquare,
  RefreshCw,
  Send,
  TrendingUp,
  User,
  Video,
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
  fetchLiveClassLearnerAttendanceDetail,
  sendLiveClassAttendanceMessage,
  type LiveLearnerDetail,
  type LiveLearnerDetailSessionStatus,
} from "./admin-live-class-attendance-roster-api";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-transparent px-4 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-low)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const fieldClassName =
  "h-9 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

type SessionFilter = "all" | LiveLearnerDetailSessionStatus;

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

function defined<T>(value: T, message = "Expected value to be defined"): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

function initials(name: string | null, email: string | null): string {
  const source = (name ?? email ?? "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${defined(parts[0])[0] ?? ""}${defined(parts[1])[0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase() || "?";
}

function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${String(hours)}h ${String(minutes)}m`;
  if (minutes > 0) return `${String(minutes)}m`;
  return `${String(total)}s`;
}

function formatScheduled(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatClock(value: string | null): string {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatRelative(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${String(days)} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${String(months)} months ago`;
}

function formatMinutesOffset(
  value: number | null,
  lateLabel = "late",
  earlyLabel = "early",
): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (Math.abs(value) < 0.5) return "On time";
  const abs = Math.abs(Math.round(value));
  const unit = abs === 1 ? "1m" : `${String(abs)}m`;
  return value > 0 ? `${unit} ${lateLabel}` : `${unit} ${earlyLabel}`;
}

function statusLabel(status: LiveLearnerDetailSessionStatus): string {
  if (status === "present") return "Present";
  if (status === "absent") return "Absent";
  if (status === "partial") return "Partial";
  return "Registered";
}

function StatusPill({ status }: { status: LiveLearnerDetailSessionStatus }) {
  const tone =
    status === "present"
      ? "border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]"
      : status === "absent"
        ? "border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]"
        : status === "partial"
          ? "border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]"
          : "border-[var(--admin-outline)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]";
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider ${tone}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function stripTone(status: LiveLearnerDetailSessionStatus): string {
  if (status === "present") {
    return "border-[color-mix(in_srgb,var(--admin-success)_40%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_20%,transparent)]";
  }
  if (status === "absent") {
    return "border-[color-mix(in_srgb,var(--admin-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--admin-danger)_20%,transparent)]";
  }
  if (status === "partial") {
    return "border-[color-mix(in_srgb,var(--admin-warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--admin-warning)_20%,transparent)]";
  }
  return "border-[var(--admin-outline)] bg-[var(--admin-surface-high)]";
}

function CoverageBar({
  pct,
  tone = "primary",
}: {
  pct: number | null;
  tone?: "primary" | "success" | "warning" | "danger";
}) {
  const width = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  const color =
    tone === "success"
      ? "bg-[var(--admin-success)]"
      : tone === "warning"
        ? "bg-[var(--admin-warning)]"
        : tone === "danger"
          ? "bg-[var(--admin-danger)]"
          : "bg-[var(--admin-primary-strong)]";
  return (
    <div className="h-[3px] w-full overflow-hidden bg-[var(--admin-surface-variant)]">
      <div className={`h-full ${color}`} style={{ width: `${String(width)}%` }} />
    </div>
  );
}

function CompareToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="Compare with cohort average"
      className={[
        "relative h-4 w-8 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--admin-surface)]",
        checked ? "bg-[var(--admin-primary-strong)]" : "bg-[var(--admin-outline)]",
      ].join(" ")}
      onClick={() => {
        onChange(!checked);
      }}
    >
      <span
        className={[
          "absolute top-[2px] h-3 w-3 rounded-full bg-[var(--admin-on-primary)] transition-transform",
          checked ? "right-[2px]" : "left-[2px]",
        ].join(" ")}
      />
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading learner attendance">
      <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-4">
            <Shimmer className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Shimmer className="h-7 w-48" />
              <Shimmer className="h-4 w-56" />
            </div>
          </div>
          <div className="flex gap-2">
            <Shimmer className="h-9 w-36" />
            <Shimmer className="h-9 w-36" />
            <Shimmer className="h-9 w-9" />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Shimmer className="h-6 w-32" />
          <Shimmer className="h-6 w-40" />
        </div>
      </section>

      <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="grid gap-6 border-b border-[var(--admin-border)] p-6 lg:grid-cols-3">
          <div className="space-y-3">
            <Shimmer className="h-8 w-48" />
            <Shimmer className="h-[3px] w-full" />
            <Shimmer className="h-4 w-40" />
          </div>
          <div className="flex gap-6 lg:col-span-2">
            <Shimmer className="h-12 w-24" />
            <Shimmer className="h-12 w-24" />
            <Shimmer className="h-12 w-24" />
            <Shimmer className="h-12 w-28" />
          </div>
        </div>
        <div className="bg-[var(--admin-surface-low)] p-4">
          <div className="flex h-6 gap-1">
            {Array.from({ length: 12 }).map((_, index) => (
              <Shimmer key={index} className="h-full flex-1" />
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,68%)_minmax(0,32%)]">
        <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4">
            <Shimmer className="h-4 w-28" />
            <Shimmer className="ml-auto h-4 w-32" />
          </div>
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] px-4 last:border-b-0"
            >
              <Shimmer className="h-4 w-40" />
              <Shimmer className="h-5 w-16" />
              <Shimmer className="h-4 w-24" />
              <Shimmer className="h-4 w-16" />
              <Shimmer className="h-4 w-20" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
            <Shimmer className="mb-4 h-5 w-24" />
            <Shimmer className="h-32 w-full" />
          </div>
          <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
            <Shimmer className="mb-4 h-5 w-20" />
            <Shimmer className="mb-3 h-4 w-full" />
            <Shimmer className="h-4 w-3/4" />
          </div>
          <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
            <Shimmer className="mb-4 h-5 w-32" />
            <Shimmer className="mb-2 h-4 w-48" />
            <Shimmer className="mb-2 h-4 w-44" />
            <Shimmer className="h-4 w-40" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageModal({
  open,
  learnerName,
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
  learnerName: string;
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
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-[var(--admin-scrim)] p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close message dialog overlay"
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
              Message learner
            </h2>
            <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">{learnerName}</p>
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
              className={`${fieldClassName} h-32 resize-y py-2`}
              value={body}
              onChange={(e) => {
                onBodyChange(e.target.value);
              }}
              maxLength={10000}
            />
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[var(--admin-border)] px-5 py-4">
          <button type="button" className={ghostButtonClassName} disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={busy || !subject.trim() || !body.trim()}
            onClick={onSend}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {busy ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PatternChart({
  months,
  compareCohort,
}: {
  months: LiveLearnerDetail["monthlyPattern"];
  compareCohort: boolean;
}) {
  if (months.length === 0) {
    return (
      <p className="text-sm text-[var(--admin-on-surface-variant)]">
        Not enough history to chart a monthly pattern yet.
      </p>
    );
  }

  const maxRate = Math.max(
    100,
    ...months.map((month) => month.attendanceRatePct ?? 0),
    ...(compareCohort ? months.map((month) => month.cohortAvgRatePct ?? 0) : []),
  );
  const cohortAvg =
    compareCohort && months.some((month) => month.cohortAvgRatePct != null)
      ? months.reduce((sum, month) => sum + (month.cohortAvgRatePct ?? 0), 0) /
        months.filter((month) => month.cohortAvgRatePct != null).length
      : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative flex h-32 items-end gap-2 overflow-hidden rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 pb-1 pt-4">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 19px, color-mix(in srgb, var(--admin-outline) 55%, transparent) 20px)",
          }}
          aria-hidden="true"
        />
        {cohortAvg != null ? (
          <div
            className="absolute left-0 right-0 z-[1] border-t-2 border-dashed border-[var(--admin-outline)]"
            style={{ bottom: `${String((cohortAvg / maxRate) * 100)}%` }}
            aria-hidden="true"
          />
        ) : null}
        {months.map((month) => {
          const rate = month.attendanceRatePct ?? 0;
          const height = Math.max(4, (rate / maxRate) * 100);
          const danger = rate < 40;
          return (
            <div
              key={month.monthKey}
              className="relative z-[2] flex flex-1 flex-col items-center justify-end"
              title={`${month.label}: ${formatPct(month.attendanceRatePct)}`}
            >
              <div
                className={[
                  "w-full max-w-8 rounded-t-sm",
                  danger ? "bg-[var(--admin-danger)]" : "bg-[var(--admin-primary-strong)]",
                ].join(" ")}
                style={{ height: `${String(height)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-xs text-[var(--admin-on-surface-variant)]">
        <span>Monthly trend</span>
        {compareCohort ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-2 border-dashed border-[var(--admin-outline)]" />
            Cohort avg
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 text-[11px] text-[var(--admin-on-surface-variant)]">
        {months.map((month) => (
          <span key={month.monthKey} className="font-mono">
            {month.label.split(" ")[0]}
          </span>
        ))}
      </div>
    </div>
  );
}

function exportSessionsCsv(detail: LiveLearnerDetail) {
  const headers = [
    "Session",
    "Status",
    "Scheduled",
    "Joined",
    "Left",
    "DurationSeconds",
    "CoveragePct",
    "CohortAvgDurationSeconds",
    "Note",
  ];
  const rows = detail.sessions.map((session) => [
    session.title,
    statusLabel(session.status),
    session.scheduledAt ?? "",
    session.joinedAt ?? "",
    session.leftAt ?? "",
    session.durationSeconds == null ? "" : String(session.durationSeconds),
    session.coveragePct == null ? "" : String(session.coveragePct),
    session.cohortAvgDurationSeconds == null ? "" : String(session.cohortAvgDurationSeconds),
    session.note ?? "",
  ]);
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const safeName = (detail.learnerName ?? detail.email ?? "learner")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  anchor.href = url;
  anchor.download = `learner-attendance-${safeName || detail.membershipId}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AdminLiveClassLearnerAttendanceDetailPage({
  membershipId,
}: {
  membershipId: string;
}) {
  const [detail, setDetail] = useState<LiveLearnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [compareCohort, setCompareCohort] = useState(true);
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("all");
  const [sessionQuery, setSessionQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const sessionFilterLabelId = useId();
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageSubject, setMessageSubject] = useState("Quick check-in on live class attendance");
  const [messageBody, setMessageBody] = useState(
    "We noticed a few missed live sessions and wanted to check in. Let us know if anything is blocking you from joining.",
  );
  const [messageBusy, setMessageBusy] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchLiveClassLearnerAttendanceDetail(membershipId);
      setDetail(response.data);
    } catch (loadError) {
      setDetail(null);
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load learner attendance.",
      );
    } finally {
      setLoading(false);
    }
  }, [membershipId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredSessions = useMemo(() => {
    if (!detail) return [];
    const q = sessionQuery.trim().toLowerCase();
    return detail.sessions.filter((session) => {
      if (sessionFilter !== "all" && session.status !== sessionFilter) return false;
      if (!q) return true;
      return (
        session.title.toLowerCase().includes(q) ||
        (session.courseTitle ?? "").toLowerCase().includes(q) ||
        (session.batchName ?? "").toLowerCase().includes(q)
      );
    });
  }, [detail, sessionFilter, sessionQuery]);

  async function handleSendMessage() {
    if (!detail) return;
    if (!messageSubject.trim() || !messageBody.trim()) return;
    setMessageBusy(true);
    setMessageError(null);
    try {
      await sendLiveClassAttendanceMessage({
        audience: "selected",
        membershipIds: [detail.membershipId],
        subject: messageSubject.trim(),
        message: messageBody.trim(),
        channels: ["email", "in_app"],
      });
      setMessageOpen(false);
    } catch (sendError) {
      setMessageError(
        sendError instanceof ClientApiError
          ? sendError.message
          : sendError instanceof Error
            ? sendError.message
            : "Couldn't send message.",
      );
    } finally {
      setMessageBusy(false);
    }
  }

  const learnerLabel = detail?.learnerName ?? detail?.email ?? "Learner";

  let body: ReactNode;
  if (loading && !detail) {
    body = <LoadingSkeleton />;
  } else if (error && !detail) {
    body = (
      <div
        className="flex flex-col items-start gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-5"
        role="alert"
      >
        <div className="flex items-center gap-2 text-[var(--admin-danger)]">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
          <p className="text-sm font-semibold">{error}</p>
        </div>
        <button type="button" className={secondaryButtonClassName} onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  } else if (!detail) {
    body = null;
  } else {
    const rateTone =
      detail.neverAttended || (detail.attendanceRatePct != null && detail.attendanceRatePct < 40)
        ? "danger"
        : "primary";
    const streakTone =
      detail.streakKind === "attended"
        ? "text-[var(--admin-success)]"
        : detail.streakKind === "missed"
          ? "text-[var(--admin-danger)]"
          : "text-[var(--admin-on-surface)]";

    body = (
      <>
        {error ? (
          <div
            className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-3 py-2 text-sm text-[var(--admin-danger)]"
            role="alert"
          >
            <span>{error}</span>
            <button type="button" className={ghostButtonClassName} onClick={() => void load()}>
              Retry
            </button>
          </div>
        ) : null}

        <section className="flex flex-col gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-center gap-4">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-primary-container)] text-sm font-bold text-[var(--admin-on-primary-container)]"
                aria-hidden="true"
              >
                {initials(detail.learnerName, detail.email)}
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
                  {learnerLabel}
                </h1>
                {detail.email ? (
                  <p className="mt-1 font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
                    {detail.email}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="mr-1 flex items-center gap-2">
                <span className="text-xs text-[var(--admin-on-surface-variant)]">
                  Compare with cohort average
                </span>
                <CompareToggle checked={compareCohort} onChange={setCompareCohort} />
              </div>
              <Link
                href={`/admin/members/${detail.membershipId}`}
                className={secondaryButtonClassName}
              >
                <User className="h-4 w-4" aria-hidden="true" />
                Open member profile
              </Link>
              {detail.neverAttended ? (
                <button
                  type="button"
                  className={primaryButtonClassName}
                  onClick={() => {
                    setMessageError(null);
                    setMessageOpen(true);
                  }}
                >
                  <MessageSquare className="h-4 w-4" aria-hidden="true" />
                  Message learner
                </button>
              ) : (
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  onClick={() => {
                    setMessageError(null);
                    setMessageOpen(true);
                  }}
                >
                  <MessageSquare className="h-4 w-4" aria-hidden="true" />
                  Message learner
                </button>
              )}
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--admin-outline)] text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-low)] active:translate-y-px"
                aria-label="Export their attendance"
                onClick={() => {
                  exportSessionsCsv(detail);
                }}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {detail.batchName ? (
              <span className="rounded border border-[var(--admin-outline)] bg-[var(--admin-surface-variant)] px-2 py-1 text-xs text-[var(--admin-on-surface)]">
                {detail.batchName}
              </span>
            ) : null}
            <span className="rounded border border-[var(--admin-outline)] bg-[var(--admin-surface-variant)] px-2 py-1 text-xs text-[var(--admin-on-surface)]">
              Registered for {detail.registeredCount} session
              {detail.registeredCount === 1 ? "" : "s"}
            </span>
            {detail.atRisk ? (
              <span className="rounded border border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_10%,transparent)] px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-warning)]">
                At risk
              </span>
            ) : null}
            {detail.neverAttended ? (
              <span className="rounded border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)] px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-danger)]">
                Never attended
              </span>
            ) : null}
          </div>
        </section>

        <section className="mt-6 flex flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="flex flex-col gap-6 border-b border-[var(--admin-border)] p-6 lg:flex-row">
            <div className="flex flex-col justify-center border-[var(--admin-border)] lg:w-1/3 lg:border-r lg:pr-6">
              <div className="font-mono text-[32px] font-bold leading-tight text-[var(--admin-on-surface)]">
                Attended {detail.attendedCount} of {detail.registeredCount}
              </div>
              <div className="mt-3 mb-3">
                <CoverageBar
                  pct={detail.attendanceRatePct}
                  tone={rateTone === "danger" ? "danger" : "primary"}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span
                  className={[
                    "text-sm",
                    rateTone === "danger"
                      ? "font-semibold text-[var(--admin-danger)]"
                      : "text-[var(--admin-on-surface)]",
                  ].join(" ")}
                >
                  {formatPct(detail.attendanceRatePct)} attendance rate
                </span>
                {compareCohort && detail.cohortAvgAttendanceRatePct != null ? (
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                    <span className="inline-block h-2.5 w-0.5 bg-[var(--admin-outline)]" />
                    cohort {formatPct(detail.cohortAvgAttendanceRatePct)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-1 flex-wrap items-center gap-6 lg:px-6">
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Total time
                </span>
                <span className="font-mono text-lg font-bold text-[var(--admin-on-surface)]">
                  {formatDuration(detail.totalTimeSeconds)}
                </span>
              </div>
              <div className="hidden h-10 w-px bg-[var(--admin-border)] sm:block" />
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Average coverage
                </span>
                <span className="font-mono text-lg font-bold text-[var(--admin-on-surface)]">
                  {formatPct(detail.avgCoveragePct)}
                </span>
              </div>
              <div className="hidden h-10 w-px bg-[var(--admin-border)] sm:block" />
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Current streak
                </span>
                <span className={`font-mono text-lg font-bold ${streakTone}`}>
                  {detail.streakLabel}
                </span>
              </div>
              <div className="hidden h-10 w-px bg-[var(--admin-border)] sm:block" />
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Last attended
                </span>
                <span
                  className="text-lg font-semibold text-[var(--admin-on-surface)]"
                  title={detail.lastAttendedAt ?? undefined}
                >
                  {formatRelative(detail.lastAttendedAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-b-lg bg-[var(--admin-surface-low)] p-4">
            {detail.strip.length > 0 ? (
              <div className="flex h-6 w-full gap-1" role="list" aria-label="Attendance strip">
                {detail.strip.map((cell) => (
                  <div
                    key={cell.sessionId}
                    role="listitem"
                    className={`h-full flex-1 rounded-sm border ${stripTone(cell.status)}`}
                    title={`${cell.title}: ${statusLabel(cell.status)}`}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--admin-on-surface-variant)]">
                No registered live sessions in this range.
              </p>
            )}
            {detail.longestGap ? (
              <p className="text-xs text-[var(--admin-danger)]">{detail.longestGap.label}</p>
            ) : detail.neverAttended ? (
              <p className="text-xs text-[var(--admin-danger)]">
                Learner has not recorded any active time in scheduled sessions.
              </p>
            ) : null}
          </div>
        </section>

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,68%)_minmax(0,32%)]">
          <section className="flex min-h-[28rem] flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                Session log
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <input
                    className={`${fieldClassName} w-44 pl-3`}
                    placeholder="Filter sessions…"
                    value={sessionQuery}
                    onChange={(e) => {
                      setSessionQuery(e.target.value);
                    }}
                    aria-label="Filter sessions by title"
                  />
                </div>
                <div className="min-w-[180px]">
                  <DropdownField
                    label={<span className="sr-only">Session status filter</span>}
                    labelId={sessionFilterLabelId}
                    open={filterOpen}
                    onToggle={() => {
                      setFilterOpen((open) => !open);
                    }}
                    triggerContent={
                      <span className="flex w-full items-center gap-2 text-[13px] font-medium text-[var(--admin-on-surface)]">
                        <Filter
                          className="h-3.5 w-3.5 text-[var(--admin-on-surface-variant)]"
                          aria-hidden="true"
                        />
                        <span className="flex-1 text-left">
                          {sessionFilter === "all"
                            ? `All ${String(detail.sessions.length)} sessions`
                            : statusLabel(sessionFilter)}
                        </span>
                        <ChevronDown
                          className={`h-3.5 w-3.5 text-[var(--admin-on-surface-variant)] transition-transform duration-200 ${filterOpen ? "rotate-180" : ""}`}
                          aria-hidden="true"
                        />
                      </span>
                    }
                    panelAriaLabel="Filter sessions by status"
                  >
                    <div className="p-1.5" role="listbox">
                      {(
                        [
                          ["all", `All ${String(detail.sessions.length)} sessions`],
                          ["present", "Present"],
                          ["absent", "Absent"],
                          ["partial", "Partial"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          role="option"
                          aria-selected={sessionFilter === value}
                          className={dropdownItemClassName}
                          onClick={() => {
                            setSessionFilter(value);
                            setFilterOpen(false);
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </DropdownField>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                  <tr>
                    {[
                      "Session",
                      "Status",
                      "Scheduled",
                      "Joined",
                      "Left",
                      "Duration",
                      ...(compareCohort ? ["Cohort avg"] : []),
                      "Actions",
                    ].map((header) => (
                      <th
                        key={header}
                        className={`px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)] ${
                          header === "Actions" ? "text-right" : ""
                        }`}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={compareCohort ? 8 : 7}
                        className="px-4 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]"
                      >
                        No sessions match this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredSessions.map((session) => {
                      const absent = session.status === "absent";
                      const partial = session.status === "partial";
                      const barTone = absent
                        ? "danger"
                        : partial
                          ? "warning"
                          : session.status === "present"
                            ? "success"
                            : "primary";
                      return (
                        <tr
                          key={session.sessionId}
                          className={[
                            "group h-11 border-b border-[var(--admin-border)] transition-colors hover:bg-[var(--admin-surface-high)]",
                            absent
                              ? "border-l-[3px] border-l-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_5%,transparent)]"
                              : "",
                          ].join(" ")}
                        >
                          <td className={`px-4 py-2 ${absent ? "pl-3" : ""}`}>
                            <div className="max-w-[200px] truncate font-semibold text-[var(--admin-primary-strong)]">
                              {session.title}
                            </div>
                            <div className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                              {[session.courseTitle, session.batchName]
                                .filter(Boolean)
                                .join(" · ") || "Live class"}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <StatusPill status={session.status} />
                          </td>
                          <td className="px-4 py-2 font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
                            {formatScheduled(session.scheduledAt)}
                          </td>
                          <td
                            className={[
                              "px-4 py-2 font-mono text-[13px]",
                              partial
                                ? "text-[var(--admin-warning)]"
                                : "text-[var(--admin-on-surface)]",
                            ].join(" ")}
                          >
                            {formatClock(session.joinedAt)}
                          </td>
                          <td
                            className={[
                              "px-4 py-2 font-mono text-[13px]",
                              partial
                                ? "text-[var(--admin-warning)]"
                                : "text-[var(--admin-on-surface)]",
                            ].join(" ")}
                          >
                            {formatClock(session.leftAt)}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex min-w-[7.5rem] flex-col gap-1">
                              <span
                                className={[
                                  "font-mono text-[13px]",
                                  partial
                                    ? "text-[var(--admin-warning)]"
                                    : absent
                                      ? "text-[var(--admin-on-surface-variant)]"
                                      : "text-[var(--admin-on-surface)]",
                                ].join(" ")}
                              >
                                {formatDuration(session.durationSeconds ?? 0)}
                                {session.coveragePct != null
                                  ? ` (${formatPct(session.coveragePct)})`
                                  : ""}
                              </span>
                              <CoverageBar pct={session.coveragePct} tone={barTone} />
                              {session.note ? (
                                <span className="text-[10px] text-[var(--admin-warning)]">
                                  {session.note}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          {compareCohort ? (
                            <td className="px-4 py-2 font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
                              {formatDuration(session.cohortAvgDurationSeconds)}
                            </td>
                          ) : null}
                          <td className="px-4 py-2 text-right">
                            <Link
                              href={`/admin/reports/live-class-attendance/${session.sessionId}`}
                              className="text-sm font-semibold text-[var(--admin-primary-strong)] opacity-100 underline-offset-2 hover:underline lg:opacity-0 lg:group-hover:opacity-100"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">Pattern</h2>
              <PatternChart months={detail.monthlyPattern} compareCohort={compareCohort} />
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">Timing</h2>
              {detail.neverAttended ? (
                <div className="flex items-start gap-2 rounded border border-[color-mix(in_srgb,var(--admin-danger)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-3">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-danger)]"
                    aria-hidden="true"
                  />
                  <p className="text-xs leading-snug text-[var(--admin-on-surface-variant)]">
                    No join or leave timing yet. Message the learner to unblock attendance.
                  </p>
                </div>
              ) : (
                <div className="mt-1 flex flex-col gap-4">
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-sm text-[var(--admin-on-surface)]">
                        Average join time
                      </span>
                      <span
                        className={[
                          "font-mono text-[13px]",
                          (detail.timing.avgJoinDelayMinutes ?? 0) > 0
                            ? "text-[var(--admin-warning)]"
                            : "text-[var(--admin-on-surface)]",
                        ].join(" ")}
                      >
                        {formatMinutesOffset(detail.timing.avgJoinDelayMinutes)}
                      </span>
                    </div>
                    {compareCohort ? (
                      <div className="flex items-center justify-between text-xs text-[var(--admin-on-surface-variant)]">
                        <span>vs Cohort</span>
                        <span
                          className={
                            (detail.timing.cohortAvgJoinDelayMinutes ?? 0) <= 0
                              ? "text-[var(--admin-success)]"
                              : undefined
                          }
                        >
                          {formatMinutesOffset(detail.timing.cohortAvgJoinDelayMinutes)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <div className="h-px w-full bg-[var(--admin-border)]" />
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-sm text-[var(--admin-on-surface)]">
                        Average leave time
                      </span>
                      <span className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                        {formatMinutesOffset(
                          detail.timing.avgLeaveEarlyMinutes == null
                            ? null
                            : -Math.abs(detail.timing.avgLeaveEarlyMinutes),
                          "late",
                          "early",
                        )}
                      </span>
                    </div>
                    {compareCohort ? (
                      <div className="flex items-center justify-between text-xs text-[var(--admin-on-surface-variant)]">
                        <span>vs Cohort</span>
                        <span>
                          {formatMinutesOffset(
                            detail.timing.cohortAvgLeaveEarlyMinutes == null
                              ? null
                              : -Math.abs(detail.timing.cohortAvgLeaveEarlyMinutes),
                            "late",
                            "early",
                          )}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                Related reports
              </h2>
              <ul className="mt-1 flex flex-col gap-2">
                {detail.related.batchId ? (
                  <li>
                    <Link
                      href={`/admin/reports/batches/${detail.related.batchId}/live-sessions`}
                      className="inline-flex items-center gap-2 text-sm text-[var(--admin-primary-strong)] hover:underline"
                    >
                      <FileText className="h-4 w-4" aria-hidden="true" />
                      Batch attendance report
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </li>
                ) : null}
                {detail.related.courseId ? (
                  <li>
                    <Link
                      href={`/admin/reports/progress-score/progress/course/${detail.related.courseId}`}
                      className="inline-flex items-center gap-2 text-sm text-[var(--admin-primary-strong)] hover:underline"
                    >
                      <TrendingUp className="h-4 w-4" aria-hidden="true" />
                      Academic progress report
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </li>
                ) : null}
                <li>
                  <Link
                    href="/admin/reports/zoom-insights/participants"
                    className="inline-flex items-center gap-2 text-sm text-[var(--admin-primary-strong)] hover:underline"
                  >
                    <Video className="h-4 w-4" aria-hidden="true" />
                    Zoom participation logs
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </li>
              </ul>
            </div>
          </aside>
        </div>

        <p className="pb-8 pt-6 text-center text-xs text-[var(--admin-on-surface-variant)]">
          Attendance rate is attendees divided by registrations.
        </p>

        <MessageModal
          open={messageOpen}
          learnerName={learnerLabel}
          subject={messageSubject}
          body={messageBody}
          busy={messageBusy}
          error={messageError}
          onSubjectChange={setMessageSubject}
          onBodyChange={setMessageBody}
          onClose={() => {
            if (!messageBusy) setMessageOpen(false);
          }}
          onSend={() => void handleSendMessage()}
        />
      </>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-6 py-6">
      <nav
        className="flex flex-wrap items-center gap-1 text-xs text-[var(--admin-on-surface-variant)]"
        aria-label="Breadcrumb"
      >
        <Link
          href="/admin/reports/live-class-attendance"
          className="hover:text-[var(--admin-primary-strong)]"
        >
          Live Class Attendance
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link
          href="/admin/reports/live-class-attendance/learners"
          className="hover:text-[var(--admin-primary-strong)]"
        >
          Learners
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-semibold text-[var(--admin-on-surface)]">{learnerLabel}</span>
      </nav>

      <div>
        <Link
          href="/admin/reports/live-class-attendance/learners"
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--admin-primary-strong)] hover:underline"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          All learners
        </Link>
      </div>

      {body}
    </div>
  );
}
