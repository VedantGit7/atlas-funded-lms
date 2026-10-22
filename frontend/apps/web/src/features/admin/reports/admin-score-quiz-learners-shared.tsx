"use client";

import { useEffect, useId, useState } from "react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import {
  type ScoreAttemptsFilter,
  type ScoreLearnerResultStatus,
  type ScoreLearnerView,
  type ScoreProductType,
} from "./admin-progress-score-roster-api";
import { type ViewerLocale } from "./viewer-time";

export function defined<T>(value: T, message = "Expected value to be defined"): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

export type DetailTab = "learners" | "items" | "attempts";

export const VIEW_TABS: Array<{ value: ScoreLearnerView; label: string }> = [
  { value: "all", label: "All" },
  { value: "failed", label: "Failed" },
  { value: "ungraded", label: "Ungraded" },
  { value: "improved_on_retry", label: "Improved on retry" },
];

export const RESULT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Result: All" },
  { value: "pass", label: "Pass" },
  { value: "fail", label: "Fail" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In progress" },
];

export const ATTEMPTS_FILTER_OPTIONS: Array<{ value: ScoreAttemptsFilter; label: string }> = [
  { value: "any", label: "Attempts: All" },
  { value: "first_only", label: "First attempt only" },
  { value: "more_than_one", label: "More than one" },
];

export const selectClassName =
  "h-9 min-w-[140px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-medium text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

export const fieldClassName =
  "h-9 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-xs text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

export function Shimmer({ className }: { className?: string }) {
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

export function formatPctFor(value: number | null | undefined, viewer: ViewerLocale): string {
  if (value == null) return "—";
  return `${value.toLocaleString(viewer.locale, {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })}%`;
}

export function formatCountFor(value: number, viewer: ViewerLocale): string {
  return value.toLocaleString(viewer.locale);
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    return `${String(hours)}h ${String(mins % 60)}m`;
  }
  return `${String(mins).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;
}

export function formatSubmittedFor(
  iso: string | null,
  startedAt: string | null,
  viewer: ViewerLocale,
): string {
  if (iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString(viewer.locale, {
      timeZone: viewer.timeZone,
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (startedAt) {
    const date = new Date(startedAt);
    if (Number.isNaN(date.getTime())) return "—";
    return `Started ${date.toLocaleDateString(viewer.locale, { timeZone: viewer.timeZone, month: "short", day: "numeric" })}`;
  }
  return "—";
}

export function formatClockFor(iso: string | null, viewer: ViewerLocale): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(viewer.locale, {
    timeZone: viewer.timeZone,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function humanizeType(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function learnerInitials(learner: {
  learnerName: string | null;
  email: string | null;
}): string {
  const source = (learner.learnerName ?? learner.email ?? "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${defined(parts[0])[0] ?? ""}${defined(parts[1])[0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase() || "?";
}

export function resultChipClass(status: ScoreLearnerResultStatus): string {
  if (status === "pass") {
    return "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)] text-[var(--admin-primary)]";
  }
  if (status === "fail") {
    return "border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]";
  }
  if (status === "pending") {
    return "border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]";
  }
  return "border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

/** Fill for the score bar. */
export function scoreBarTone(status: ScoreLearnerResultStatus): string {
  if (status === "fail") return "bg-[var(--admin-danger)]";
  if (status === "pass") return "bg-[var(--admin-primary)]";
  return "bg-[var(--admin-outline)]";
}

/**
 * Colour for the score label beside the bar. Separate from the fill: they were
 * one string that callers split on spaces, which read as a text colour painted
 * on its own background.
 */
export function scoreTextTone(status: ScoreLearnerResultStatus): string {
  if (status === "fail") return "text-[var(--admin-danger)]";
  if (status === "pass") return "text-[var(--admin-on-surface)]";
  return "text-[var(--admin-on-surface-variant)]";
}

export function productScoresHref(
  productType: ScoreProductType | null,
  productId: string | null,
  courseId: string | null,
): string {
  if (productType && productId) {
    return `/admin/reports/progress-score/scores/${productType}/${productId}`;
  }
  if (courseId) return `/admin/reports/progress-score/scores/course/${courseId}`;
  return "/admin/reports/progress-score/scores";
}

export function ScoreBar({
  value,
  passMark,
  toneClass,
}: {
  value: number | null;
  passMark: number | null;
  toneClass: string;
}) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  const fill = toneClass.includes("danger")
    ? "bg-[var(--admin-danger)]"
    : "bg-[var(--admin-primary)]";
  return (
    <div className="relative h-1.5 w-20 overflow-hidden rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
      <div className={`absolute inset-y-0 left-0 ${fill}`} style={{ width: `${String(pct)}%` }} />
      {passMark != null ? (
        <span
          className="absolute inset-y-0 w-px bg-[var(--admin-on-surface)]/50"
          style={{ left: `${String(Math.max(0, Math.min(100, passMark)))}%` }}
        />
      ) : null}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-10" aria-busy="true" aria-label="Loading score roster">
      <div className="space-y-3">
        <Shimmer className="h-3 w-96 max-w-full" />
        <Shimmer className="h-9 w-[28rem] max-w-full" />
        <Shimmer className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <div className="space-y-4 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:col-span-2">
          <Shimmer className="h-3 w-24" />
          <Shimmer className="h-8 w-28" />
          <Shimmer className="h-4 w-full" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="space-y-4 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5"
          >
            <Shimmer className="h-3 w-20" />
            <Shimmer className="h-8 w-16" />
            <Shimmer className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
        <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3">
          <Shimmer className="h-8 w-full max-w-3xl" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-[var(--admin-border)] px-4 py-4 last:border-b-0"
          >
            <Shimmer className="h-8 w-8 shrink-0 rounded-full" />
            <Shimmer className="h-4 w-40" />
            <Shimmer className="h-4 w-16" />
            <Shimmer className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function RegradeModal({
  open,
  assessmentTitle,
  selectedCount,
  answerKeyVersion,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  assessmentTitle: string;
  selectedCount: number;
  answerKeyVersion: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (args: { scope: "selected" | "all"; notifyLearners: boolean }) => void;
}) {
  const titleId = useId();
  const [scope, setScope] = useState<"selected" | "all">("selected");
  const [notify, setNotify] = useState(false);

  useEffect(() => {
    if (open) {
      setScope(selectedCount > 0 ? "selected" : "all");
      setNotify(false);
    }
  }, [open, selectedCount]);

  if (!open) return null;

  const countLabel = scope === "selected" ? selectedCount : "all";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_55%,transparent)] p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-full max-w-xl flex-col border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="flex items-start justify-between border-b border-[var(--admin-border)] px-6 py-6">
          <div>
            <h2
              id={titleId}
              className="text-2xl font-semibold tracking-[-0.02em] text-[var(--admin-on-surface)]"
            >
              Regrade Assessment
            </h2>
            <p className="mt-1 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
              {assessmentTitle}
            </p>
          </div>
          <button
            type="button"
            className="text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)]"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col gap-6 p-6">
          <div className="flex items-start gap-3">
            <RefreshCw
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-primary)]"
              aria-hidden="true"
            />
            <p className="text-base leading-relaxed text-[var(--admin-on-surface)]">
              <strong className="text-[var(--admin-on-surface)]">
                {scope === "selected"
                  ? `${String(selectedCount)} attempt${selectedCount === 1 ? "" : "s"}`
                  : "All attempts"}
              </strong>{" "}
              will be regraded against{" "}
              <strong className="text-[var(--admin-on-surface)]">Version {answerKeyVersion}</strong>{" "}
              of the answer key.
            </p>
          </div>

          <hr className="border-[var(--admin-border)]" />

          <div className="flex flex-col gap-3">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="radio"
                name="regrade-scope"
                checked={scope === "selected"}
                disabled={selectedCount === 0}
                onChange={() => {
                  setScope("selected");
                }}
                className="accent-[var(--admin-primary)]"
              />
              <span className="text-sm text-[var(--admin-on-surface)]">
                Regrade selected attempts
                {selectedCount === 0 ? " (none selected)" : ` (${String(selectedCount)})`}
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="radio"
                name="regrade-scope"
                checked={scope === "all"}
                onChange={() => {
                  setScope("all");
                }}
                className="accent-[var(--admin-primary)]"
              />
              <span className="text-sm text-[var(--admin-on-surface)]">
                Regrade all attempts for this assessment
              </span>
            </label>
          </div>

          <div className="flex items-start gap-3 border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[var(--admin-surface-low)] p-4">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
              aria-hidden="true"
            />
            <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-[var(--admin-warning)]">
              Warning: Recorded results and pass/fail outcomes may change.
            </p>
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={notify}
              onChange={(event) => {
                setNotify(event.target.checked);
              }}
              className="accent-[var(--admin-primary)]"
            />
            <span className="text-sm text-[var(--admin-on-surface)]">Notify affected learners</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-[var(--admin-border)] px-6 py-4">
          <button
            type="button"
            className={`${ghostButtonClassName} border-2 border-[var(--admin-on-surface)] uppercase tracking-[0.1em]`}
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`${primaryButtonClassName} uppercase tracking-[0.1em]`}
            disabled={busy || (scope === "selected" && selectedCount === 0)}
            onClick={() => {
              onConfirm({ scope, notifyLearners: notify });
            }}
          >
            {busy ? "Regrading…" : `Regrade ${String(countLabel)} attempts`}
          </button>
        </div>
      </div>
    </div>
  );
}
