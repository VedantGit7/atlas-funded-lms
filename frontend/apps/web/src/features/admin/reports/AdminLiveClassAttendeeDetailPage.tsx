"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Info,
  Layers,
  Mail,
  MessageSquare,
  RefreshCw,
  Send,
  User,
  UserCheck,
  X,
} from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  fetchLiveClassAttendeeDetail,
  sendLiveClassAttendanceMessage,
  updateLiveClassAttendeeStatus,
  type LiveAttendeeDetail,
} from "./admin-live-class-attendance-roster-api";

type AttendanceStatus = LiveAttendeeDetail["status"];

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-transparent px-4 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-low)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const dangerOutlineButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-danger)] bg-transparent px-4 text-[13px] font-semibold text-[var(--admin-danger)] transition-all hover:bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-danger)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const fieldClassName =
  "h-9 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

function formatDateShort(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const today = new Date();
  if (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  ) {
    return "Today";
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatRegisteredChip(value: string | null | undefined): string {
  if (!value) return "Registered date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Registered date unavailable";
  return `Registered ${date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
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

function errMsg(error: unknown, fallback: string): string {
  if (error instanceof ClientApiError || error instanceof Error) return error.message;
  return fallback;
}

function defined<T>(value: T, message = "Expected value to be defined"): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

function learnerInitials(name: string | null, email: string | null): string {
  const source = (name?.trim() || email?.trim() || "?").replace(/\s+/g, " ");
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${defined(parts[0])[0] ?? ""}${defined(parts[1])[0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function statusTone(status: string): "success" | "danger" | "muted" {
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

function coverageBarTone(pct: number | null): "primary" | "success" | "warning" | "danger" {
  if (pct == null) return "danger";
  if (pct <= 0) return "danger";
  if (pct >= 75) return "success";
  if (pct >= 40) return "warning";
  return "danger";
}

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1,
  );
}

function presenceSegments(detail: LiveAttendeeDetail): Array<{
  id: string;
  leftPct: number;
  widthPct: number;
  label: string;
}> {
  const sessionStartMs = detail.sessionStartedAt
    ? new Date(detail.sessionStartedAt).getTime()
    : null;
  const sessionDurationMs =
    detail.sessionDurationSeconds != null && detail.sessionDurationSeconds > 0
      ? detail.sessionDurationSeconds * 1000
      : detail.sessionStartedAt && detail.sessionEndedAt
        ? Math.max(
            new Date(detail.sessionEndedAt).getTime() - new Date(detail.sessionStartedAt).getTime(),
            1,
          )
        : null;

  if (sessionStartMs == null || sessionDurationMs == null || sessionDurationMs <= 0) {
    return [];
  }

  return detail.segments
    .filter((segment): segment is typeof segment & { joinedAt: string } =>
      Boolean(segment.joinedAt),
    )
    .map((segment) => {
      const joinMs = new Date(segment.joinedAt).getTime();
      const leaveMs = segment.leftAt
        ? new Date(segment.leftAt).getTime()
        : detail.sessionEndedAt
          ? new Date(detail.sessionEndedAt).getTime()
          : joinMs + Math.max((segment.durationSeconds ?? 0) * 1000, 1000);
      const leftPct = ((joinMs - sessionStartMs) / sessionDurationMs) * 100;
      const widthPct = ((leaveMs - joinMs) / sessionDurationMs) * 100;
      return {
        id: segment.id,
        leftPct: Math.max(0, Math.min(100, leftPct)),
        widthPct: Math.max(0.4, Math.min(100, widthPct)),
        label: `${formatTimeOnly(segment.joinedAt)} to ${formatTimeOnly(segment.leftAt)} (${formatDuration(segment.durationSeconds)})`,
      };
    })
    .filter((segment) => segment.widthPct > 0);
}

function DetailLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading attendee detail">
      <div className="space-y-2">
        <Shimmer className="h-3 w-96 max-w-full" />
        <Shimmer className="h-4 w-40" />
      </div>
      <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
        <div className="flex items-start gap-4">
          <Shimmer className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Shimmer className="h-7 w-56" />
            <Shimmer className="h-4 w-48" />
            <div className="flex gap-2 pt-1">
              <Shimmer className="h-7 w-24 rounded-md" />
              <Shimmer className="h-7 w-40 rounded-md" />
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
        <Shimmer className="mb-3 h-3 w-28" />
        <Shimmer className="mb-2 h-8 w-40" />
        <Shimmer className="mb-5 h-[3px] w-full rounded-full" />
        <div className="grid grid-cols-2 gap-4 border-t border-[var(--admin-border)] pt-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Shimmer className="h-3 w-16" />
              <Shimmer className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
        <Shimmer className="mb-4 h-5 w-40" />
        <Shimmer className="mb-6 h-8 w-full rounded" />
        <div className="space-y-2">
          <Shimmer className="h-10 w-full" />
          <Shimmer className="h-10 w-full" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Shimmer className="h-48 w-full rounded-lg" />
        <Shimmer className="h-48 w-full rounded-lg" />
      </div>
    </div>
  );
}

function PresenceTimeline({ detail }: { detail: LiveAttendeeDetail }) {
  const segments = useMemo(() => presenceSegments(detail), [detail]);
  const empty =
    detail.status === "absent" ||
    segments.length === 0 ||
    (detail.durationSeconds == null && detail.segments.length === 0);

  if (empty) {
    return (
      <div className="space-y-2">
        <div
          className="relative h-8 w-full rounded border border-dashed border-[var(--admin-outline)] bg-[color-mix(in_srgb,var(--admin-outline)_12%,transparent)]"
          role="img"
          aria-label="No join recorded"
        />
        <div className="flex items-center justify-between font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
          <span>No join recorded</span>
          <span>0m</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        className="relative h-8 w-full overflow-visible rounded border border-[var(--admin-outline)] bg-[var(--admin-surface-high)]"
        role="img"
        aria-label={`Presence timeline with ${String(segments.length)} segment${segments.length === 1 ? "" : "s"}`}
      >
        {segments.map((segment) => (
          <div
            key={segment.id}
            className="absolute inset-y-0 rounded-sm border border-[var(--admin-primary-strong)] bg-[var(--admin-primary)] motion-safe:transition-transform motion-safe:hover:scale-y-110"
            style={{
              left: `${String(segment.leftPct)}%`,
              width: `${String(segment.widthPct)}%`,
            }}
            title={segment.label}
          />
        ))}
      </div>
      <div className="flex justify-between font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
        <span>
          {formatTimeOnly(detail.sessionStartedAt)}
          {detail.sessionStartedAt ? " (Start)" : ""}
        </span>
        <span>
          {formatTimeOnly(detail.sessionEndedAt)}
          {detail.sessionEndedAt ? " (End)" : ""}
        </span>
      </div>
    </div>
  );
}

function StandingHistogram({ standing }: { standing: LiveAttendeeDetail["standing"] }) {
  const max = Math.max(1, ...standing.histogram);
  const hasData = standing.histogram.length > 0 && standing.band !== "unavailable";

  if (!hasData) {
    return (
      <p className="text-sm text-[var(--admin-on-surface-variant)]">
        Cohort standing is unavailable for this session.
      </p>
    );
  }

  return (
    <div className="relative h-12 w-full rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 pb-1 pt-1">
      <div className="flex h-8 items-end gap-px opacity-40">
        {standing.histogram.map((count, index) => {
          const heightPct = Math.max(6, (count / max) * 100);
          const isLearner = standing.learnerBucketIndex === index;
          return (
            <div
              key={`bucket-${String(index)}`}
              className={`w-full rounded-sm ${
                isLearner ? "bg-[var(--admin-primary)] opacity-100" : "bg-[var(--admin-outline)]"
              }`}
              style={{ height: `${String(heightPct)}%` }}
              title={`${String(count)} learner${count === 1 ? "" : "s"}`}
            />
          );
        })}
      </div>

      {standing.medianBucketIndex != null && standing.histogram.length > 0 ? (
        <div
          className="pointer-events-none absolute inset-y-0 z-10 border-l border-dashed border-[var(--admin-on-surface-variant)]"
          style={{
            left: `${String(
              ((standing.medianBucketIndex + 0.5) / standing.histogram.length) * 100,
            )}%`,
          }}
        >
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
            Median {formatDuration(standing.medianDurationSeconds)}
          </span>
        </div>
      ) : null}

      {standing.learnerBucketIndex != null &&
      standing.histogram.length > 0 &&
      standing.band !== "absent" ? (
        <div
          className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-[var(--admin-primary-strong)]"
          style={{
            left: `${String(
              ((standing.learnerBucketIndex + 0.5) / standing.histogram.length) * 100,
            )}%`,
          }}
        >
          <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--admin-primary-strong)] shadow-[0_0_0_2px_var(--admin-surface)]" />
          <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] font-semibold text-[var(--admin-primary-strong)]">
            {formatDuration(standing.learnerDurationSeconds)}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function ChangeStatusModal({
  open,
  currentStatus,
  systemInferredStatus,
  busy,
  error,
  onClose,
  onSave,
}: {
  open: boolean;
  currentStatus: AttendanceStatus;
  systemInferredStatus: AttendanceStatus;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (status: AttendanceStatus, reason?: string) => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<AttendanceStatus>(currentStatus);
  const [reason, setReason] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setSelected(currentStatus);
    setReason("");
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel) {
      const focusables = getFocusable(panel);
      (focusables[0] ?? panel).focus();
    }
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
    };
  }, [open, currentStatus]);

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

  if (!open || !mounted) return null;

  const contradicts = selected !== systemInferredStatus;
  const canSave = !busy && selected !== currentStatus && (!contradicts || reason.trim().length > 0);

  const options: AttendanceStatus[] = ["attended", "absent", "registered"];

  const dialog = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close change status dialog"
        tabIndex={-1}
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--admin-on-surface)_20%,transparent)] backdrop-blur-[1px] motion-safe:animate-[admin-fade-in_0.15s_ease-out]"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="admin-theme relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl motion-safe:animate-[admin-dialog-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <div className="flex items-start justify-between border-b border-[var(--admin-border)] px-6 py-5">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-[var(--admin-on-surface)]">
              Change status
            </h2>
            <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
              System inferred: {titleCase(systemInferredStatus)}
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

        <div className="space-y-4 px-6 py-5">
          {error ? (
            <div
              className="rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-3 py-2.5 text-sm text-[var(--admin-danger)]"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <div className="space-y-1" role="radiogroup" aria-label="Attendance status">
            {options.map((option) => {
              const selectedOption = selected === option;
              const optionContradicts = option !== systemInferredStatus;
              return (
                <label
                  key={option}
                  className={[
                    "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 transition-colors",
                    selectedOption
                      ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                      : "border-transparent hover:bg-[var(--admin-surface-low)]",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    name="attendee-status"
                    value={option}
                    checked={selectedOption}
                    onChange={() => {
                      setSelected(option);
                    }}
                  />
                  <span
                    className={[
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all",
                      selectedOption
                        ? "border-[5px] border-[var(--admin-primary-strong)]"
                        : "border-[var(--admin-outline)]",
                    ].join(" ")}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-semibold text-[var(--admin-on-surface)]">
                    {titleCase(option)}
                  </span>
                  {selectedOption && optionContradicts ? (
                    <span className="ml-auto inline-flex items-center gap-1 rounded border border-[color-mix(in_srgb,var(--admin-danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)] px-2 py-0.5 text-[12px] text-[var(--admin-danger)]">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      Contradicts system data
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>

          {contradicts ? (
            <div className="space-y-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
              <label
                htmlFor="override-reason"
                className="flex items-center justify-between font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface)]"
              >
                Reason for manual override
                <span className="normal-case tracking-normal text-[var(--admin-danger)]">
                  *Required
                </span>
              </label>
              <p className="text-xs text-[var(--admin-on-surface-variant)]">
                System telemetry does not match this selection. Document why you are overriding.
              </p>
              <textarea
                id="override-reason"
                className="min-h-[72px] w-full resize-none rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]"
                rows={2}
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                }}
                placeholder="Enter reason (e.g. joined by mistake, left immediately)"
                maxLength={500}
              />
            </div>
          ) : null}

          <div className="flex items-start gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-warning)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] p-3">
            <Info
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-warning)]"
              aria-hidden="true"
            />
            <p className="text-xs leading-snug text-[var(--admin-on-surface)]">
              This overrides the recorded attendance and is included in the audit log.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4">
          <button type="button" className={ghostButtonClassName} disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={!canSave}
            onClick={() => {
              onSave(selected, contradicts ? reason.trim() : undefined);
            }}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}

function MessageModal({
  open,
  learnerName,
  busy,
  error,
  onClose,
  onSend,
}: {
  open: boolean;
  learnerName: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSend: (payload: {
    subject: string;
    message: string;
    channels: Array<"email" | "in_app">;
    sendTestToSelf?: boolean;
  }) => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [channelEmail, setChannelEmail] = useState(true);
  const [channelInApp, setChannelInApp] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setSubject(`Follow-up: {{session_title}}`);
    setBody(
      `Hi {{learner_name}},\n\nFollowing up about {{session_title}}.\n\nIf you need help, reply to this message.`,
    );
    setChannelEmail(true);
    setChannelInApp(true);
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel) {
      const focusables = getFocusable(panel);
      (focusables[0] ?? panel).focus();
    }
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, busy, onClose]);

  if (!open || !mounted) return null;

  const channels: Array<"email" | "in_app"> = [];
  if (channelEmail) channels.push("email");
  if (channelInApp) channels.push("in_app");
  const canSend = !busy && subject.trim() && body.trim() && channels.length > 0;

  const dialog = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close message dialog"
        tabIndex={-1}
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--admin-on-surface)_20%,transparent)] backdrop-blur-[1px] motion-safe:animate-[admin-fade-in_0.15s_ease-out]"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="admin-theme relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl motion-safe:animate-[admin-dialog-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <div className="flex items-start justify-between border-b border-[var(--admin-border)] px-6 py-5">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-[var(--admin-on-surface)]">
              Message learner
            </h2>
            <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
              Sending to {learnerName}
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

        <div className="space-y-4 px-6 py-5">
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
                setSubject(event.target.value);
              }}
              maxLength={200}
            />
          </label>

          <label className="grid gap-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
              Message
            </span>
            <textarea
              className="min-h-[140px] w-full resize-none rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]"
              value={body}
              onChange={(event) => {
                setBody(event.target.value);
              }}
              maxLength={10000}
            />
          </label>

          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-[var(--admin-on-surface)]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--admin-primary)]"
                checked={channelEmail}
                onChange={(event) => {
                  setChannelEmail(event.target.checked);
                }}
              />
              Email
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-[var(--admin-on-surface)]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--admin-primary)]"
                checked={channelInApp}
                onChange={(event) => {
                  setChannelInApp(event.target.checked);
                }}
              />
              In-app
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--admin-primary)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
            disabled={!canSend}
            onClick={() => {
              onSend({
                subject: subject.trim(),
                message: body.trim(),
                channels,
                sendTestToSelf: true,
              });
            }}
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            Send test to myself
          </button>
          <div className="flex gap-3">
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
              disabled={!canSend}
              onClick={() => {
                onSend({
                  subject: subject.trim(),
                  message: body.trim(),
                  channels,
                });
              }}
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              {busy ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}

export function AdminLiveClassAttendeeDetailPage({
  sessionId,
  attendeeId,
}: {
  sessionId: string;
  attendeeId: string;
}) {
  const [detail, setDetail] = useState<LiveAttendeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [statusOpen, setStatusOpen] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [messageOpen, setMessageOpen] = useState(false);
  const [messageBusy, setMessageBusy] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  const sessionHref = `/admin/reports/live-class-attendance/${sessionId}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchLiveClassAttendeeDetail(sessionId, attendeeId);
      setDetail(response.data);
    } catch (loadError) {
      setDetail(null);
      setError(errMsg(loadError, "Couldn't load attendee details."));
    } finally {
      setLoading(false);
    }
  }, [attendeeId, sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleStatusSave(status: AttendanceStatus, reason?: string) {
    setStatusBusy(true);
    setStatusError(null);
    setActionError(null);
    try {
      await updateLiveClassAttendeeStatus(sessionId, attendeeId, {
        status,
        ...(reason?.trim() ? { reason: reason.trim() } : {}),
      });
      setStatusOpen(false);
      await load();
    } catch (saveError) {
      setStatusError(errMsg(saveError, "Couldn't update attendance status."));
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleMarkAttended() {
    setActionError(null);
    setStatusBusy(true);
    try {
      const contradicts = detail?.systemInferredStatus !== "attended";
      await updateLiveClassAttendeeStatus(sessionId, attendeeId, {
        status: "attended",
        ...(contradicts ? { reason: "Marked as attended by operator." } : {}),
      });
      await load();
    } catch (saveError) {
      setActionError(errMsg(saveError, "Couldn't mark as attended."));
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleSendMessage(payload: {
    subject: string;
    message: string;
    channels: Array<"email" | "in_app">;
    sendTestToSelf?: boolean;
  }) {
    if (!detail) return;
    setMessageBusy(true);
    setMessageError(null);
    try {
      await sendLiveClassAttendanceMessage({
        sessionId,
        audience: "selected",
        membershipIds: [detail.membershipId],
        subject: payload.subject,
        message: payload.message,
        channels: payload.channels,
        ...(payload.sendTestToSelf ? { sendTestToSelf: true } : {}),
      });
      if (!payload.sendTestToSelf) {
        setMessageOpen(false);
      }
    } catch (sendError) {
      setMessageError(errMsg(sendError, "Couldn't send message."));
    } finally {
      setMessageBusy(false);
    }
  }

  const learnerName = detail?.learnerName?.trim() || detail?.email || "Learner";
  const historyCaption = detail
    ? `Attended ${String(detail.historySummary.attendedCount)} of ${String(detail.historySummary.totalSessions)} sessions${
        detail.historySummary.attendanceRatePct != null
          ? ` · ${formatPct(detail.historySummary.attendanceRatePct)}`
          : ""
      }`
    : null;

  if (loading && !detail) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-24">
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
          <span className="text-[var(--admin-on-surface)]">Attendee</span>
        </nav>
        <DetailLoadingSkeleton />
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
        <Link
          href={sessionHref}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-[var(--admin-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Back to session
        </Link>
        <div className="flex items-start justify-between gap-4 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                Couldn&apos;t load this attendee
              </p>
              <p className="mt-0.5 text-xs text-[color-mix(in_srgb,var(--admin-danger)_70%,var(--admin-on-surface))]">
                {error}
              </p>
            </div>
          </div>
          <button type="button" className={secondaryButtonClassName} onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const joinWarn = (detail.joinDelayMinutes ?? 0) > 0;
  const gapWarn = detail.longestGapSeconds != null && detail.longestGapSeconds > 0;
  const segmentCount = detail.segments.length;
  const timelineCaption =
    segmentCount > 0
      ? `${String(segmentCount)} segment${segmentCount === 1 ? "" : "s"} totalling ${formatDuration(detail.durationSeconds)} across a ${formatDuration(detail.sessionDurationSeconds)} class`
      : "No presence segments recorded";

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-28">
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
        <Link href={sessionHref} className="hover:text-[var(--admin-primary-strong)]">
          {detail.sessionTitle}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="text-[var(--admin-on-surface)]">{learnerName}</span>
      </nav>

      <Link
        href={sessionHref}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-[var(--admin-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to session
      </Link>

      {actionError ? (
        <div
          className="flex items-start justify-between gap-4 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
            <p className="text-sm text-[var(--admin-danger)]">{actionError}</p>
          </div>
          <button
            type="button"
            className={ghostButtonClassName}
            onClick={() => {
              setActionError(null);
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Header */}
      <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--admin-primary)_25%,var(--admin-outline))] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] font-mono text-sm font-semibold text-[var(--admin-primary-strong)]">
            {learnerInitials(detail.learnerName, detail.email)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
                {learnerName}
              </h1>
              <StatusPill tone={statusTone(detail.status)}>{titleCase(detail.status)}</StatusPill>
              {detail.contradictsSystemData ? (
                <StatusPill tone="warning">Override</StatusPill>
              ) : null}
            </div>
            <p className="mt-1 font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
              {detail.email ?? "No email on file"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2.5 py-1 text-xs text-[var(--admin-on-surface)]">
                <Layers
                  className="h-3.5 w-3.5 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
                {detail.batchName ?? "No linked batch"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2.5 py-1 text-xs text-[var(--admin-on-surface)]">
                <UserCheck
                  className="h-3.5 w-3.5 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
                {formatRegisteredChip(detail.registeredAt)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Summary strip */}
      <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
        <p className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
          Time in session
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <p className="font-mono text-[28px] font-medium leading-none tracking-tight text-[var(--admin-on-surface)]">
            {formatDuration(detail.durationSeconds)}
          </p>
          <p className="mb-0.5 font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
            {formatPct(detail.coveragePct)} of {formatDuration(detail.sessionDurationSeconds)}
          </p>
        </div>
        <div className="mt-3">
          <MetricBar pct={detail.coveragePct} tone={metricBarTone(detail.coveragePct)} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[var(--admin-border)] pt-4 md:grid-cols-4">
          <div>
            <p className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">Joined</p>
            <p
              className={[
                "flex items-center gap-1.5 font-mono text-[13px]",
                joinWarn ? "text-[var(--admin-warning)]" : "text-[var(--admin-on-surface)]",
              ].join(" ")}
            >
              {formatTimeOnly(detail.joinedAt)}
              {joinWarn ? (
                <span title="Late join">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              ) : null}
            </p>
            {joinWarn ? (
              <p className="mt-0.5 text-[10px] leading-tight text-[var(--admin-warning)]">
                {String(detail.joinDelayMinutes)}m after start
              </p>
            ) : null}
          </div>
          <div>
            <p className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">Left</p>
            <p className="font-mono text-[13px] text-[var(--admin-on-surface)]">
              {formatTimeOnly(detail.leftAt)}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">Rejoins</p>
            <p className="font-mono text-[13px] text-[var(--admin-on-surface)]">
              {String(detail.rejoinCount)}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">Longest gap</p>
            <p
              className={[
                "font-mono text-[13px]",
                gapWarn
                  ? "font-medium text-[var(--admin-warning)]"
                  : "text-[var(--admin-on-surface)]",
              ].join(" ")}
            >
              {formatDuration(detail.longestGapSeconds)}
            </p>
          </div>
        </div>
      </section>

      {/* Presence + segments */}
      <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex flex-col gap-1 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
            Presence Timeline
          </h2>
          <p className="text-xs text-[var(--admin-on-surface-variant)]">{timelineCaption}</p>
        </div>
        <div className="border-b border-[var(--admin-border)] px-5 py-5">
          <PresenceTimeline detail={detail} />
          {detail.status === "attended" &&
          detail.segments.length === 1 &&
          detail.rejoinCount === 0 ? (
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
              <Info
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                  Continuous presence
                </p>
                <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                  This learner stayed for a single uninterrupted interval. No rejoin gaps were
                  recorded for this session.
                </p>
              </div>
            </div>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-[var(--admin-surface-low)]">
              <tr className="border-b border-[var(--admin-border)]">
                <th className="px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                  #
                </th>
                <th className="px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                  Joined
                </th>
                <th className="px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                  Left
                </th>
                <th className="px-4 py-2.5 text-right font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                  Duration
                </th>
                <th className="px-4 py-2.5 text-right font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                  %
                </th>
                <th className="px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                  Client
                </th>
              </tr>
            </thead>
            <tbody>
              {detail.segments.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-[var(--admin-on-surface-variant)]"
                  >
                    No join recorded
                  </td>
                </tr>
              ) : (
                detail.segments.map((segment) => (
                  <tr
                    key={segment.id}
                    className="h-11 border-b border-[var(--admin-border)] font-mono text-[13px] transition-colors hover:bg-[var(--admin-surface-high)]"
                  >
                    <td className="px-4 py-3 text-[var(--admin-on-surface-variant)]">
                      {String(segment.index)}
                    </td>
                    <td className="px-4 py-3 text-[var(--admin-on-surface)]">
                      {formatTimeOnly(segment.joinedAt)}
                    </td>
                    <td className="px-4 py-3 text-[var(--admin-on-surface)]">
                      {formatTimeOnly(segment.leftAt)}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--admin-on-surface)]">
                      {formatDuration(segment.durationSeconds)}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--admin-on-surface-variant)]">
                      {formatPct(segment.shareOfSessionPct)}
                    </td>
                    <td
                      className="max-w-[140px] truncate px-4 py-3 text-[12px] text-[var(--admin-on-surface-variant)]"
                      title={segment.clientLabel ?? undefined}
                    >
                      {segment.clientLabel ?? "Not recorded"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Standing + History */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--admin-border)] px-4 py-4">
            <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
              Standing in Cohort
            </h2>
            <StatusPill tone="primary">{detail.standing.label}</StatusPill>
          </div>
          <div className="space-y-4 p-5 pb-8">
            <p className="text-xs text-[var(--admin-on-surface-variant)]">
              Learner attendance duration vs. cohort distribution for this session
              {detail.standing.medianDurationSeconds != null
                ? `. Median is ${formatDuration(detail.standing.medianDurationSeconds)}.`
                : "."}{" "}
              Cohort size: {String(detail.standing.cohortSize)}.
            </p>
            <StandingHistogram standing={detail.standing} />
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="flex flex-col gap-1 border-b border-[var(--admin-border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
              Recent History
            </h2>
            <p className="text-xs text-[var(--admin-on-surface-variant)]">{historyCaption}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-left text-sm">
              <thead className="bg-[var(--admin-surface-low)]">
                <tr className="border-b border-[var(--admin-border)]">
                  <th className="px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    Session
                  </th>
                  <th className="w-24 px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    Date
                  </th>
                  <th className="w-24 px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    Status
                  </th>
                  <th className="w-28 px-4 py-2.5 text-right font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    Coverage
                  </th>
                </tr>
              </thead>
              <tbody>
                {detail.history.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-[var(--admin-on-surface-variant)]"
                    >
                      No prior session history.
                    </td>
                  </tr>
                ) : (
                  detail.history.map((row) => (
                    <tr
                      key={`${row.sessionId}:${row.attendeeId ?? "none"}`}
                      className={[
                        "h-11 border-b border-[var(--admin-border)] transition-colors",
                        row.isCurrent
                          ? "border-l-2 border-l-[var(--admin-primary-strong)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                          : "hover:bg-[var(--admin-surface-high)]",
                      ].join(" ")}
                    >
                      <td className="max-w-[180px] truncate px-4 py-3 font-medium text-[var(--admin-on-surface)]">
                        {row.isCurrent || !row.attendeeId ? (
                          row.title
                        ) : (
                          <Link
                            href={`/admin/reports/live-class-attendance/${row.sessionId}/attendees/${row.attendeeId}`}
                            className="hover:text-[var(--admin-primary)] hover:underline"
                          >
                            {row.title}
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
                        {formatDateShort(row.scheduledAt)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={statusTone(row.status)}>
                          {titleCase(row.status)}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-mono text-[11px] text-[var(--admin-on-surface)]">
                            {formatPct(row.coveragePct)}
                          </span>
                          <div className="w-8">
                            <MetricBar
                              pct={row.coveragePct}
                              tone={coverageBarTone(row.coveragePct)}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {detail.overrideReason ? (
        <section className="rounded-lg border border-[color-mix(in_srgb,var(--admin-warning)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-warning)]">
            Override reason
          </p>
          <p className="mt-1 text-sm text-[var(--admin-on-surface)]">{detail.overrideReason}</p>
          {detail.overriddenAt ? (
            <p className="mt-1 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
              {formatDate(detail.overriddenAt)}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Sticky footer */}
      <div className="sticky bottom-0 z-20 -mx-1 border-t border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface)_92%,transparent)] px-1 py-4 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/members/${detail.membershipId}`} className={primaryButtonClassName}>
              <User className="h-4 w-4" aria-hidden="true" />
              Profile
            </Link>
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={() => {
                setMessageError(null);
                setMessageOpen(true);
              }}
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              Message
            </button>
            {detail.status === "absent" ? (
              <button
                type="button"
                className={secondaryButtonClassName}
                disabled={statusBusy}
                onClick={() => {
                  void handleMarkAttended();
                }}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Mark as attended
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className={dangerOutlineButtonClassName}
            disabled={statusBusy}
            onClick={() => {
              setStatusError(null);
              setStatusOpen(true);
            }}
          >
            Change status
          </button>
        </div>
      </div>

      <ChangeStatusModal
        open={statusOpen}
        currentStatus={detail.status}
        systemInferredStatus={detail.systemInferredStatus}
        busy={statusBusy}
        error={statusError}
        onClose={() => {
          if (!statusBusy) {
            setStatusOpen(false);
            setStatusError(null);
          }
        }}
        onSave={(status, reason) => {
          void handleStatusSave(status, reason);
        }}
      />

      <MessageModal
        open={messageOpen}
        learnerName={learnerName}
        busy={messageBusy}
        error={messageError}
        onClose={() => {
          if (!messageBusy) {
            setMessageOpen(false);
            setMessageError(null);
          }
        }}
        onSend={(payload) => {
          void handleSendMessage(payload);
        }}
      />
    </div>
  );
}
