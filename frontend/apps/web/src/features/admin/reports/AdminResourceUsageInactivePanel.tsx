"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Mail,
  RefreshCw,
  Settings2,
  UserX,
  X,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import { ClientApiError } from "../../../lib/client-api";
import { RoleToggle } from "../../studio/courses/admin-form-dropdown-shared";
import {
  deactivateResourceUsageInactive,
  exportResourceUsageReport,
  fetchResourceUsageInactive,
  messageResourceUsageInactive,
  type ResourceUsageInactiveActivityStatus,
  type ResourceUsageInactiveEnrolmentFilter,
  type ResourceUsageInactiveItem,
  type ResourceUsageInactivePaidFilter,
  type ResourceUsageInactiveResponse,
  type ResourceUsageInactiveSort,
  type ResourceUsageInactiveSummary,
  type ResourceUsageInactiveView,
} from "./admin-resource-usage-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

const SETTINGS_KEY = "atlas.resource-usage.inactivity-settings";

type InactivitySettings = {
  inactiveDays: number;
  includeInvitedNeverSignedIn: boolean;
  excludeActivePaidEnrolment: boolean;
};

type DeactivateReason =
  | "subscription_ended"
  | "course_completed"
  | "inactivity"
  | "violation"
  | "other";

const DEFAULT_SETTINGS: InactivitySettings = {
  inactiveDays: 90,
  includeInvitedNeverSignedIn: true,
  excludeActivePaidEnrolment: false,
};

const DEFAULT_MESSAGE_SUBJECT = "We saved your place";
const DEFAULT_MESSAGE_BODY = `Hi {{learner_name}},

We noticed you have not been active for {{days_inactive}} days. You still have {{enrolment_count}} enrolment(s) waiting for you.

Whenever you are ready, your progress is still here.

See you inside.`;

const selectClassName =
  "h-9 min-w-[130px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-medium text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";
const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";
const primaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 text-sm font-medium text-[var(--admin-on-primary)] transition-all hover:bg-[var(--admin-primary-strong)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";
const accentWashDisabledButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--admin-primary)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] px-4 text-sm font-medium text-[color-mix(in_srgb,var(--admin-primary)_55%,var(--admin-on-surface-variant))] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed";
const dangerButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-danger)] bg-[var(--admin-danger)] px-4 text-sm font-medium text-[var(--admin-on-danger)] transition-all hover:opacity-90 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-danger)]/30 disabled:cursor-not-allowed disabled:opacity-50";
const fieldClassName =
  "h-10 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 font-mono text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30";
const textareaClassName =
  "min-h-[160px] w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30";

const ACTIVITY_STATUS_OPTIONS: Array<{
  value: ResourceUsageInactiveActivityStatus;
  label: string;
}> = [
  { value: "any", label: "All statuses" },
  { value: "inactive", label: "Inactive" },
  { value: "dormant", label: "Dormant" },
  { value: "never_active", label: "Never active" },
];
const INACTIVE_FOR_OPTIONS = [
  { value: "", label: "Any inactive for" },
  { value: "90", label: "90+ days" },
  { value: "180", label: "180+ days" },
  { value: "365", label: "365+ days" },
];
const ENROLMENT_OPTIONS: Array<{ value: ResourceUsageInactiveEnrolmentFilter; label: string }> = [
  { value: "any", label: "Any enrolments" },
  { value: "has_enrolments", label: "Has enrolments" },
  { value: "zero_enrolments", label: "0 enrolments" },
];
const PAID_OPTIONS: Array<{ value: ResourceUsageInactivePaidFilter; label: string }> = [
  { value: "any", label: "Any paid" },
  { value: "has_paid", label: "Has paid" },
  { value: "never_paid", label: "Never paid" },
];
const SORT_OPTIONS: Array<{ value: ResourceUsageInactiveSort; label: string }> = [
  { value: "inactive_desc", label: "Inactive longest ↓" },
  { value: "inactive_asc", label: "Inactive shortest ↑" },
  { value: "activity_asc", label: "Least recent activity" },
  { value: "name_asc", label: "Name A-Z" },
  { value: "enrolments_desc", label: "Enrolments ↓" },
  { value: "signed_up_asc", label: "Signed up ↑" },
];
const REASON_OPTIONS = [
  { value: "", label: "Select a reason" },
  { value: "subscription_ended", label: "Subscription ended" },
  { value: "course_completed", label: "Course completed" },
  { value: "inactivity", label: "Inactivity" },
  { value: "violation", label: "Policy violation" },
  { value: "other", label: "Other" },
];
const VIEW_TABS: Array<{
  key: ResourceUsageInactiveView;
  label: string;
  countKey: keyof ResourceUsageInactiveSummary["viewCounts"];
}> = [
  { key: "all", label: "All inactive", countKey: "all" },
  { key: "never_active", label: "Never active", countKey: "neverActive" },
  { key: "paid_holding", label: "Paid holding", countKey: "paidHolding" },
];

const MERGE_TAGS = [
  { tag: "{{learner_name}}", label: "Learner name" },
  { tag: "{{days_inactive}}", label: "Days inactive" },
  { tag: "{{enrolment_count}}", label: "Enrolment count" },
] as const;

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-sm bg-[var(--admin-surface-high)]",
        "motion-safe:after:absolute motion-safe:after:inset-0 motion-safe:after:-translate-x-full",
        "motion-safe:after:animate-[shimmer_1.8s_infinite] motion-safe:after:bg-gradient-to-r",
        "motion-safe:after:from-transparent motion-safe:after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] motion-safe:after:to-transparent",
        className,
      )}
    />
  );
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Never active";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${String(minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${String(hours)}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  if (days < 30) return `${String(days)} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatMonthYear(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function formatAbsoluteDate(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function learnerInitial(name: string | null, email: string | null): string {
  const source = (name ?? email ?? "?").trim();
  if (!source) return "?";
  return source.slice(0, 1).toUpperCase();
}

function learnerDisplayName(item: ResourceUsageInactiveItem): string {
  return item.learnerName?.trim() || item.email?.trim() || "Unknown learner";
}

function activityTone(
  label: ResourceUsageInactiveItem["activityLabel"],
): "warning" | "muted" | "primary" {
  if (label === "never_active") return "warning";
  if (label === "dormant") return "muted";
  return "primary";
}

function activityLabelText(label: ResourceUsageInactiveItem["activityLabel"]): string {
  if (label === "never_active") return "Never active";
  if (label === "dormant") return "Dormant";
  return "Inactive";
}

function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "warning" | "muted" | "primary";
  children: ReactNode;
}) {
  const tones = {
    success:
      "border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]",
    warning:
      "border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]",
    muted:
      "border-[var(--admin-outline)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
    primary:
      "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)] text-[var(--admin-primary)]",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ClientApiError || error instanceof Error) return error.message;
  return fallback;
}

function readSettings(): InactivitySettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(SETTINGS_KEY) ?? "null",
    ) as Partial<InactivitySettings> | null;
    if (!parsed) return DEFAULT_SETTINGS;
    return {
      inactiveDays:
        typeof parsed.inactiveDays === "number" && parsed.inactiveDays > 0
          ? Math.round(parsed.inactiveDays)
          : DEFAULT_SETTINGS.inactiveDays,
      includeInvitedNeverSignedIn:
        typeof parsed.includeInvitedNeverSignedIn === "boolean"
          ? parsed.includeInvitedNeverSignedIn
          : DEFAULT_SETTINGS.includeInvitedNeverSignedIn,
      excludeActivePaidEnrolment:
        typeof parsed.excludeActivePaidEnrolment === "boolean"
          ? parsed.excludeActivePaidEnrolment
          : DEFAULT_SETTINGS.excludeActivePaidEnrolment,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeSettings(settings: InactivitySettings) {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function HeadlineCard({
  label,
  value,
  unit,
  caption,
  tone = "default",
  barPct,
  icon,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  caption?: ReactNode;
  tone?: "default" | "warning" | "success";
  barPct?: number;
  icon?: ReactNode;
}) {
  const shell =
    tone === "warning"
      ? "border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_6%,var(--admin-surface))]"
      : tone === "success"
        ? "border-[color-mix(in_srgb,var(--admin-success)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_6%,var(--admin-surface))]"
        : "border-[var(--admin-border)] bg-[var(--admin-surface)]";
  const labelTone =
    tone === "warning"
      ? "text-[var(--admin-warning)]"
      : tone === "success"
        ? "text-[var(--admin-success)]"
        : "text-[var(--admin-on-surface-variant)]";
  const valueTone =
    tone === "warning"
      ? "text-[var(--admin-warning)]"
      : tone === "success"
        ? "text-[var(--admin-success)]"
        : "text-[var(--admin-on-surface)]";
  const barTone = tone === "warning" ? "bg-[var(--admin-warning)]" : "bg-[var(--admin-primary)]";

  return (
    <div
      className={cx(
        "relative flex h-32 flex-col justify-between overflow-hidden rounded-lg border p-4",
        shell,
      )}
    >
      <p className={cx("flex items-center gap-1 text-xs", labelTone)}>
        {icon}
        {label}
      </p>
      <div>
        <p className={cx("flex items-end gap-2 font-mono text-[28px] leading-none", valueTone)}>
          {value}
          {unit ? (
            <span className="mb-0.5 text-sm font-normal text-[var(--admin-on-surface-variant)]">
              {unit}
            </span>
          ) : null}
        </p>
        {caption ? (
          <div className="mt-1 text-[10px] text-[var(--admin-on-surface-variant)]">{caption}</div>
        ) : null}
      </div>
      {barPct != null ? (
        <div className="absolute right-0 bottom-0 left-0 h-[3px] bg-[var(--admin-surface-high)]">
          <div
            className={cx("h-full", barTone)}
            style={{ width: `${String(Math.min(100, Math.max(0, barPct)))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function InactiveLoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading inactive learners">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="space-y-2">
          <Shimmer className="h-8 w-48" />
          <Shimmer className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-40" />
          <Shimmer className="h-9 w-40" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex h-32 flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
          >
            <Shimmer className="h-3 w-24" />
            <div className="space-y-2">
              <Shimmer className="h-7 w-20" />
              <Shimmer className="h-3 w-28" />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex flex-wrap gap-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
          <Shimmer className="h-9 w-48" />
          <Shimmer className="h-9 w-32" />
          <Shimmer className="h-9 w-32" />
        </div>
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex h-11 items-center gap-3 border-b border-[var(--admin-border)] px-4 last:border-b-0"
          >
            <Shimmer className="h-4 w-4" />
            <Shimmer className="h-8 w-8 rounded-full" />
            <Shimmer className="h-4 w-1/3" />
            <Shimmer className="ml-auto h-4 w-16" />
            <Shimmer className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyInactive({
  inactiveDays,
  onOpenSettings,
}: {
  inactiveDays: number;
  onOpenSettings: () => void;
}) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
        <Info className="h-12 w-12 text-[var(--admin-outline)]" aria-hidden />
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-[var(--admin-on-surface)]">
        No inactive learners
      </h3>
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
        Every learner has recorded activity in the last {inactiveDays} days.
      </p>
      <button
        type="button"
        className={cx(secondaryButtonClassName, "mt-6")}
        onClick={onOpenSettings}
      >
        <Settings2 className="h-4 w-4" aria-hidden />
        Inactivity settings
      </button>
    </div>
  );
}

function InactiveErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]" aria-hidden />
        <div>
          <p className="text-sm font-medium text-[var(--admin-danger)]">Sync failed</p>
          <p className="mt-0.5 text-sm text-[var(--admin-on-surface)]">{message}</p>
        </div>
      </div>
      <button type="button" className={secondaryButtonClassName} onClick={onRetry}>
        <RefreshCw className="h-4 w-4" aria-hidden />
        Retry
      </button>
    </div>
  );
}

function DeactivateModal({
  items,
  busy,
  onClose,
  onConfirm,
}: {
  items: ResourceUsageInactiveItem[];
  busy: boolean;
  onClose: () => void;
  onConfirm: (input: { reason: DeactivateReason; excludePaid: boolean }) => void;
}) {
  const [reason, setReason] = useState("");
  const [excludePaid, setExcludePaid] = useState(true);
  const titleId = useId();
  const paidCount = useMemo(() => items.filter((item) => item.hasPaid).length, [items]);
  const effectiveCount = excludePaid ? items.length - paidCount : items.length;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_20%,transparent)] p-4 backdrop-blur-[1px]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close deactivate dialog overlay"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="admin-theme relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_12px_40px_color-mix(in_srgb,var(--admin-on-surface)_12%,transparent)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-[var(--admin-on-surface)]">
              Deactivate {formatCount(items.length)} learner{items.length === 1 ? "" : "s"}
            </h2>
            <p className="mt-1 font-mono text-xs text-[var(--admin-on-surface-variant)]">
              {formatCount(items.length)} selected · {formatCount(paidCount)} paid
            </p>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {paidCount > 0 ? (
            <div className="space-y-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] p-3">
              <p className="text-sm text-[var(--admin-warning)]">
                {formatCount(paidCount)} selected learner{paidCount === 1 ? " has" : "s have"} paid.
                Review carefully before deactivating.
              </p>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[var(--admin-warning)]"
                  checked={excludePaid}
                  onChange={(event) => {
                    setExcludePaid(event.target.checked);
                  }}
                />
                <span className="text-sm text-[var(--admin-on-surface)]">
                  Exclude the {formatCount(paidCount)} paid learner{paidCount === 1 ? "" : "s"}
                </span>
              </label>
            </div>
          ) : null}
          <ul className="space-y-2 text-sm text-[var(--admin-on-surface)]">
            <li>The learner cannot sign in.</li>
            <li>Enrolments, progress, and payment records are kept.</li>
            <li>The account can be reactivated later.</li>
          </ul>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-[var(--admin-on-surface-variant)]">
              Reason (required)
            </span>
            <Select
              ariaLabel="Deactivate reason"
              className={selectClassName}
              value={reason}
              onValueChange={setReason}
              options={REASON_OPTIONS}
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-4">
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={dangerButtonClassName}
            disabled={busy || !reason || effectiveCount <= 0}
            onClick={() => {
              if (
                reason !== "subscription_ended" &&
                reason !== "course_completed" &&
                reason !== "inactivity" &&
                reason !== "violation" &&
                reason !== "other"
              ) {
                return;
              }
              onConfirm({ reason, excludePaid });
            }}
          >
            <UserX className="h-4 w-4" aria-hidden />
            Deactivate {formatCount(Math.max(0, effectiveCount))} learner
            {effectiveCount === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function MessageDrawer({
  open,
  items,
  inactiveDays,
  busy,
  onClose,
  onSend,
}: {
  open: boolean;
  items: ResourceUsageInactiveItem[];
  inactiveDays: number;
  busy: boolean;
  onClose: () => void;
  onSend: (input: {
    subject: string;
    message: string;
    channels: Array<"email" | "in_app">;
    excludeMessagedWithinDays: number;
    sendTestToSelf: boolean;
  }) => void;
}) {
  const titleId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [subject, setSubject] = useState(DEFAULT_MESSAGE_SUBJECT);
  const [message, setMessage] = useState(DEFAULT_MESSAGE_BODY);
  const [excludeRecent, setExcludeRecent] = useState(true);
  const [channelEmail, setChannelEmail] = useState(true);
  const [channelInApp, setChannelInApp] = useState(true);

  useEffect(() => {
    if (!open) return;
    setSubject(DEFAULT_MESSAGE_SUBJECT);
    setMessage(DEFAULT_MESSAGE_BODY);
    setExcludeRecent(true);
    setChannelEmail(true);
    setChannelInApp(true);
  }, [open, items.length]);

  function insertMergeTag(tag: string) {
    const el = textareaRef.current;
    if (!el) {
      setMessage((current) => `${current}${tag}`);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = `${message.slice(0, start)}${tag}${message.slice(end)}`;
    setMessage(next);
    window.requestAnimationFrame(() => {
      el.focus();
      const cursor = start + tag.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  if (!open || typeof document === "undefined") return null;

  const channels: Array<"email" | "in_app"> = [
    ...(channelEmail ? (["email"] as const) : []),
    ...(channelInApp ? (["in_app"] as const) : []),
  ];
  const canSend = Boolean(
    subject.trim() && message.trim() && channels.length > 0 && items.length > 0,
  );

  return createPortal(
    <div className="fixed inset-0 z-[85] flex justify-end bg-[color-mix(in_srgb,var(--admin-on-surface)_20%,transparent)] backdrop-blur-[1px]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close message drawer overlay"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="admin-theme relative z-10 flex h-full w-full max-w-[560px] flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[-8px_0_24px_color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] motion-safe:animate-[admin-drawer-in_240ms_ease-out]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-[var(--admin-on-surface)]">
              Message learners
            </h2>
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
              {formatCount(items.length)} learner{items.length === 1 ? " has" : "s have"} been
              inactive for {inactiveDays} days or more.
            </p>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
            onClick={onClose}
            aria-label="Close message drawer"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-[var(--admin-on-surface-variant)]">
              Subject
            </span>
            <input
              type="text"
              className={fieldClassName}
              value={subject}
              onChange={(event) => {
                setSubject(event.target.value);
              }}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-[var(--admin-on-surface-variant)]">
              Message
            </span>
            <textarea
              ref={textareaRef}
              className={textareaClassName}
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
              }}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {MERGE_TAGS.map((entry) => (
              <button
                key={entry.tag}
                type="button"
                className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2.5 py-1 font-mono text-[11px] text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]"
                onClick={() => {
                  insertMergeTag(entry.tag);
                }}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[var(--admin-primary)]"
              checked={excludeRecent}
              onChange={(event) => {
                setExcludeRecent(event.target.checked);
              }}
            />
            <span className="text-sm text-[var(--admin-on-surface)]">
              Exclude learners messaged in the last 30 days
            </span>
          </label>
          <div className="space-y-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
            <p className="text-xs font-medium text-[var(--admin-on-surface-variant)]">Channels</p>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--admin-primary)]"
                checked={channelEmail}
                onChange={(event) => {
                  setChannelEmail(event.target.checked);
                }}
              />
              <span className="text-sm text-[var(--admin-on-surface)]">Email</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--admin-primary)]"
                checked={channelInApp}
                onChange={(event) => {
                  setChannelInApp(event.target.checked);
                }}
              />
              <span className="text-sm text-[var(--admin-on-surface)]">In-app</span>
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-4">
          <button
            type="button"
            className="text-sm font-medium text-[var(--admin-primary)] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy || !canSend}
            onClick={() => {
              onSend({
                subject: subject.trim(),
                message: message.trim(),
                channels,
                excludeMessagedWithinDays: excludeRecent ? 30 : 0,
                sendTestToSelf: true,
              });
            }}
          >
            Send test to myself
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={secondaryButtonClassName}
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className={primaryButtonClassName}
              disabled={busy || !canSend}
              onClick={() => {
                onSend({
                  subject: subject.trim(),
                  message: message.trim(),
                  channels,
                  excludeMessagedWithinDays: excludeRecent ? 30 : 0,
                  sendTestToSelf: false,
                });
              }}
            >
              <Mail className="h-4 w-4" aria-hidden />
              Send to {formatCount(items.length)}
            </button>
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

function SettingsDrawer({
  open,
  draft,
  liveCount,
  busy,
  onChange,
  onClose,
  onReset,
  onSave,
}: {
  open: boolean;
  draft: InactivitySettings;
  liveCount: number | null;
  busy: boolean;
  onChange: (next: InactivitySettings) => void;
  onClose: () => void;
  onReset: () => void;
  onSave: () => void;
}) {
  const titleId = useId();
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[85] flex justify-end bg-[color-mix(in_srgb,var(--admin-on-surface)_20%,transparent)] backdrop-blur-[1px]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close inactivity settings overlay"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="admin-theme relative z-10 flex h-full w-full max-w-[560px] flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[-8px_0_24px_color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] motion-safe:animate-[admin-drawer-in_240ms_ease-out]"
      >
        <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-[var(--admin-on-surface)]">
            Inactivity settings
          </h2>
          <button
            type="button"
            className="rounded-md p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-[var(--admin-on-surface)]">
              Consider a learner inactive after N days without recorded activity
            </span>
            <input
              type="number"
              min={1}
              max={730}
              className={fieldClassName}
              value={draft.inactiveDays}
              onChange={(event) => {
                const next = Number(event.target.value);
                onChange({
                  ...draft,
                  inactiveDays: Number.isFinite(next)
                    ? Math.max(1, Math.round(next))
                    : draft.inactiveDays,
                });
              }}
            />
            <p className="text-xs italic text-[var(--admin-on-surface-variant)]">
              {liveCount == null
                ? "Save to refresh the inactive learner count for this threshold."
                : `Matches ${formatCount(liveCount)} learners.`}
            </p>
          </label>
          <div className="space-y-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
            <RoleToggle
              label="Count invited-but-never-signed-in learners as inactive"
              checked={draft.includeInvitedNeverSignedIn}
              onChange={(checked) => {
                onChange({ ...draft, includeInvitedNeverSignedIn: checked });
              }}
            />
            <div className="space-y-1">
              <RoleToggle
                label="Exclude learners with an active paid enrolment"
                checked={draft.excludeActivePaidEnrolment}
                onChange={(checked) => {
                  onChange({ ...draft, excludeActivePaidEnrolment: checked });
                }}
              />
              <p className="px-1 text-xs text-[var(--admin-on-surface-variant)]">
                When on, paid learners with an active enrolment are omitted from the inactive count
                and roster.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-4">
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={busy}
            onClick={onReset}
          >
            Reset
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              className={secondaryButtonClassName}
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className={primaryButtonClassName}
              disabled={busy}
              onClick={onSave}
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

export function AdminResourceUsageInactivePanel() {
  const [settings, setSettings] = useState<InactivitySettings>(DEFAULT_SETTINGS);
  const [settingsDraft, setSettingsDraft] = useState<InactivitySettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [data, setData] = useState<ResourceUsageInactiveResponse | null>(null);
  const dataRef = useRef<ResourceUsageInactiveResponse | null>(null);

  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [view, setView] = useState<ResourceUsageInactiveView>("all");
  const [activityStatus, setActivityStatus] = useState<ResourceUsageInactiveActivityStatus>("any");
  const [inactiveForMin, setInactiveForMin] = useState("");
  const [enrolmentFilter, setEnrolmentFilter] =
    useState<ResourceUsageInactiveEnrolmentFilter>("any");
  const [paidFilter, setPaidFilter] = useState<ResourceUsageInactivePaidFilter>("any");
  const [sort, setSort] = useState<ResourceUsageInactiveSort>("inactive_desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deactivateTargets, setDeactivateTargets] = useState<ResourceUsageInactiveItem[] | null>(
    null,
  );

  useEffect(() => {
    const loaded = readSettings();
    setSettings(loaded);
    setSettingsDraft(loaded);
  }, []);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQDebounced(q.trim());
    }, 300);
    return () => {
      window.clearTimeout(timer);
    };
  }, [q]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast(null);
    }, 1800);
    return () => {
      window.clearTimeout(timer);
    };
  }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchResourceUsageInactive({
        page,
        view,
        activityStatus,
        sort,
        inactiveDays: settings.inactiveDays,
        includeInvitedNeverSignedIn: settings.includeInvitedNeverSignedIn,
        excludeActivePaidEnrolment: settings.excludeActivePaidEnrolment,
        enrolmentFilter,
        paidFilter,
        ...(qDebounced ? { q: qDebounced } : {}),
        ...(inactiveForMin ? { inactiveForMin: Number(inactiveForMin) } : {}),
      });
      setData(response.data);
      setSelectedIds((current) =>
        current.filter((id) =>
          response.data.items.some((item) => item.membershipId === id && item.selectable),
        ),
      );
    } catch (loadError) {
      setError(errorMessage(loadError, "Unable to load inactive learners."));
      if (!dataRef.current) setData(null);
    } finally {
      setLoading(false);
    }
  }, [
    activityStatus,
    enrolmentFilter,
    inactiveForMin,
    page,
    paidFilter,
    qDebounced,
    settings.excludeActivePaidEnrolment,
    settings.inactiveDays,
    settings.includeInvitedNeverSignedIn,
    sort,
    view,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = data?.summary ?? null;
  const items = data?.items ?? [];
  const pageInfo = data?.pageInfo;
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(item.membershipId)),
    [items, selectedIds],
  );
  const selectedPaidCount = useMemo(
    () => selectedItems.filter((item) => item.hasPaid).length,
    [selectedItems],
  );
  const selectableOnPage = items.filter((item) => item.selectable);
  const allPageSelected =
    selectableOnPage.length > 0 &&
    selectableOnPage.every((item) => selectedIds.includes(item.membershipId));
  const hasActiveFilters =
    Boolean(qDebounced) ||
    activityStatus !== "any" ||
    Boolean(inactiveForMin) ||
    enrolmentFilter !== "any" ||
    paidFilter !== "any" ||
    sort !== "inactive_desc" ||
    view !== "all";

  function openSettings() {
    setSettingsDraft(settings);
    setSettingsOpen(true);
  }

  function clearFilters() {
    setQ("");
    setQDebounced("");
    setActivityStatus("any");
    setInactiveForMin("");
    setEnrolmentFilter("any");
    setPaidFilter("any");
    setSort("inactive_desc");
    setView("all");
    setPage(1);
  }

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const response = await exportResourceUsageReport({
        reportTab: "inactive",
        ...(qDebounced ? { q: qDebounced } : {}),
        emailDownloadLink: true,
      });
      const completed = await pollReportRunUntilComplete(response.data.runId);
      if (completed.status === "failed")
        throw new Error(completed.errorMessage ?? "Export failed.");
      if (completed.status === "completed") await downloadReportExport(completed.id, "csv");
    } catch (exportError) {
      setError(errorMessage(exportError, "Unable to export inactive learners."));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeactivateConfirm(input: {
    reason: DeactivateReason;
    excludePaid: boolean;
  }) {
    if (!deactivateTargets?.length) return;
    setBusy(true);
    setError(null);
    try {
      await deactivateResourceUsageInactive({
        membershipIds: deactivateTargets.map((item) => item.membershipId),
        reason: input.reason,
        excludePaid: input.excludePaid,
      });
      setDeactivateTargets(null);
      setSelectedIds([]);
      setToast("Learners deactivated");
      await load();
    } catch (deactivateError) {
      setError(errorMessage(deactivateError, "Unable to deactivate learners."));
    } finally {
      setBusy(false);
    }
  }

  async function handleMessageSend(input: {
    subject: string;
    message: string;
    channels: Array<"email" | "in_app">;
    excludeMessagedWithinDays: number;
    sendTestToSelf: boolean;
  }) {
    if (!selectedItems.length) return;
    setBusy(true);
    setError(null);
    try {
      await messageResourceUsageInactive({
        membershipIds: selectedItems.map((item) => item.membershipId),
        subject: input.subject,
        message: input.message,
        channels: input.channels,
        excludeMessagedWithinDays: input.excludeMessagedWithinDays,
        sendTestToSelf: input.sendTestToSelf,
      });
      if (!input.sendTestToSelf) {
        setMessageOpen(false);
        setToast("Message queued");
      } else {
        setToast("Test message sent");
      }
    } catch (messageError) {
      setError(errorMessage(messageError, "Unable to message learners."));
    } finally {
      setBusy(false);
    }
  }

  function saveSettings() {
    writeSettings(settingsDraft);
    setSettings(settingsDraft);
    setSettingsOpen(false);
    setPage(1);
  }

  if (loading && !data) return <InactiveLoadingSkeleton />;

  if (!data && error) {
    return (
      <div className="space-y-4">
        <InactiveErrorBanner
          message={error}
          onRetry={() => {
            void load();
          }}
        />
      </div>
    );
  }

  if (data?.isEmpty) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-[var(--admin-on-surface)]">
              Inactive learners
            </h1>
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
              Accounts with no activity for an extended period, still counted in your learner total.
            </p>
          </div>
          <button type="button" className={secondaryButtonClassName} onClick={openSettings}>
            <Settings2 className="h-4 w-4" aria-hidden />
            Inactivity settings
          </button>
        </div>
        <EmptyInactive inactiveDays={settings.inactiveDays} onOpenSettings={openSettings} />
        <SettingsDrawer
          open={settingsOpen}
          draft={settingsDraft}
          liveCount={null}
          busy={busy}
          onChange={setSettingsDraft}
          onClose={() => {
            setSettingsOpen(false);
          }}
          onReset={() => {
            setSettingsDraft(DEFAULT_SETTINGS);
          }}
          onSave={saveSettings}
        />
      </div>
    );
  }

  if (!data || !summary) return null;

  const messageDisabled = selectedItems.length === 0 || busy;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--admin-on-surface)]">
            Inactive learners
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Accounts with no activity for an extended period, still counted in your learner total.
          </p>
          {toast ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-[var(--admin-success)]">
              <Check className="h-3.5 w-3.5" aria-hidden />
              {toast}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={busy}
            onClick={() => {
              void handleExport();
            }}
          >
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </button>
          <button type="button" className={secondaryButtonClassName} onClick={openSettings}>
            <Settings2 className="h-4 w-4" aria-hidden />
            Inactivity settings
          </button>
          <button
            type="button"
            className={messageDisabled ? accentWashDisabledButtonClassName : primaryButtonClassName}
            disabled={messageDisabled}
            onClick={() => {
              setMessageOpen(true);
            }}
          >
            <Mail className="h-4 w-4" aria-hidden />
            Message selected
          </button>
        </div>
      </div>

      {error ? (
        <InactiveErrorBanner
          message={error}
          onRetry={() => {
            void load();
          }}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <HeadlineCard
          label="Inactive learners"
          tone="warning"
          icon={<UserX className="h-3.5 w-3.5" aria-hidden />}
          value={formatCount(summary.inactiveLearnerCount)}
          caption={`of ${formatCount(summary.totalLearnerCount)} total · ${summary.inactiveLearnerPct.toFixed(1)}%`}
          barPct={summary.inactiveLearnerPct}
        />
        <HeadlineCard
          label="Never active"
          value={formatCount(summary.neverActiveCount)}
          caption="signed up, never opened anything"
        />
        <HeadlineCard
          label="Inactive over a year"
          value={formatCount(summary.inactiveOverYearCount)}
        />
        <HeadlineCard label="Enrolments held" value={formatCount(summary.enrolmentsHeld)} />
        <HeadlineCard
          label="Paid learners among them"
          value={formatCount(summary.paidAmongThem)}
          caption={
            <span className="font-medium tracking-wide text-[var(--admin-warning)] uppercase">
              check before deactivating
            </span>
          }
        />
      </div>

      <p className="text-xs italic text-[var(--admin-on-surface-variant)]">
        Inactive means no recorded activity in {settings.inactiveDays} days. Change the window in
        inactivity settings.
      </p>

      <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="space-y-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
          <div className="flex flex-wrap gap-1 border-b border-[var(--admin-border)] pb-3">
            {VIEW_TABS.map((tab) => {
              const active = view === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={cx(
                    "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]"
                      : "text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]",
                  )}
                  onClick={() => {
                    setView(tab.key);
                    setPage(1);
                  }}
                >
                  {tab.label}
                  <span className="font-mono text-[10px] opacity-80">
                    {formatCount(summary.viewCounts[tab.countKey])}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              placeholder="Search learner name or email"
              aria-label="Search learner name or email"
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
              className="h-9 min-w-[180px] flex-1 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
            />
            <Select
              ariaLabel="Status filter"
              className={selectClassName}
              value={activityStatus}
              onValueChange={(value) => {
                setActivityStatus(value as ResourceUsageInactiveActivityStatus);
                setPage(1);
              }}
              options={ACTIVITY_STATUS_OPTIONS}
            />
            <Select
              ariaLabel="Inactive for filter"
              className={selectClassName}
              value={inactiveForMin}
              onValueChange={(value) => {
                setInactiveForMin(value);
                setPage(1);
              }}
              options={INACTIVE_FOR_OPTIONS}
            />
            <Select
              ariaLabel="Enrolment filter"
              className={selectClassName}
              value={enrolmentFilter}
              onValueChange={(value) => {
                setEnrolmentFilter(value as ResourceUsageInactiveEnrolmentFilter);
                setPage(1);
              }}
              options={ENROLMENT_OPTIONS}
            />
            <Select
              ariaLabel="Paid filter"
              className={selectClassName}
              value={paidFilter}
              onValueChange={(value) => {
                setPaidFilter(value as ResourceUsageInactivePaidFilter);
                setPage(1);
              }}
              options={PAID_OPTIONS}
            />
            <Select
              ariaLabel="Sort inactive learners"
              className={selectClassName}
              value={sort}
              onValueChange={(value) => {
                setSort(value as ResourceUsageInactiveSort);
                setPage(1);
              }}
              options={SORT_OPTIONS}
            />
            {hasActiveFilters ? (
              <button
                type="button"
                className="text-xs font-medium text-[var(--admin-primary)] hover:underline"
                onClick={clearFilters}
              >
                Clear all
              </button>
            ) : null}
          </div>
        </div>

        {selectedItems.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color-mix(in_srgb,var(--admin-primary)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] px-4 py-3">
            <p className="text-sm text-[var(--admin-on-surface)]">
              <span className="font-mono font-medium">{formatCount(selectedItems.length)}</span>{" "}
              selected
              {selectedPaidCount > 0 ? (
                <>
                  {" · "}
                  <span className="font-mono font-medium text-[var(--admin-warning)]">
                    {formatCount(selectedPaidCount)} have paid
                  </span>
                </>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={secondaryButtonClassName}
                disabled={busy}
                onClick={() => {
                  setMessageOpen(true);
                }}
              >
                Message
              </button>
              <button
                type="button"
                className={dangerButtonClassName}
                disabled={busy}
                onClick={() => {
                  setDeactivateTargets(selectedItems);
                }}
              >
                Deactivate
              </button>
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => {
                  setSelectedIds([]);
                }}
              >
                Close
              </button>
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="bg-[var(--admin-surface)] text-[11px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
              <tr>
                <th className="w-11 px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--admin-primary)]"
                    checked={allPageSelected}
                    onChange={() => {
                      if (allPageSelected) {
                        setSelectedIds((current) =>
                          current.filter(
                            (id) => !selectableOnPage.some((row) => row.membershipId === id),
                          ),
                        );
                      } else {
                        setSelectedIds((current) => [
                          ...new Set([
                            ...current,
                            ...selectableOnPage.map((row) => row.membershipId),
                          ]),
                        ]);
                      }
                    }}
                    aria-label="Select all selectable learners on this page"
                  />
                </th>
                <th className="px-4 py-2.5 font-semibold">Learner</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Enrolments</th>
                <th className="px-4 py-2.5 font-semibold">Last active</th>
                <th className="px-4 py-2.5 font-semibold">Inactive for</th>
                <th className="px-4 py-2.5 font-semibold">Signed up</th>
                <th className="px-4 py-2.5 font-semibold">Paid</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6">
                    <div className="space-y-2" aria-busy="true">
                      <Shimmer className="h-8 w-full" />
                      <Shimmer className="h-8 w-full" />
                      <Shimmer className="h-8 w-full" />
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-[var(--admin-on-surface-variant)]"
                  >
                    No learners match these filters.
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const selected = selectedIds.includes(row.membershipId);
                  const neverActive = row.activityLabel === "never_active" || !row.lastActiveAt;
                  const name = learnerDisplayName(row);
                  return (
                    <tr
                      key={row.membershipId}
                      className={cx(
                        "border-t border-[var(--admin-border)]",
                        selected
                          ? "border-l-2 border-l-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                          : "hover:bg-[var(--admin-surface-low)]",
                        neverActive && !selected && "border-l-2 border-l-[var(--admin-warning)]",
                      )}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--admin-primary)]"
                          disabled={!row.selectable}
                          checked={selected}
                          onChange={() => {
                            if (!row.selectable) return;
                            setSelectedIds((current) =>
                              current.includes(row.membershipId)
                                ? current.filter((id) => id !== row.membershipId)
                                : [...current, row.membershipId],
                            );
                          }}
                          aria-label={`Select ${name}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] font-mono text-xs font-semibold text-[var(--admin-on-surface)]">
                            {learnerInitial(row.learnerName, row.email)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[var(--admin-on-surface)]">
                              {name}
                            </p>
                            <p className="mt-0.5 truncate font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                              {row.email ?? "-"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={activityTone(row.activityLabel)}>
                          {activityLabelText(row.activityLabel)}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-3 font-mono text-[var(--admin-on-surface)]">
                        {formatCount(row.enrolmentCount)}
                      </td>
                      <td className="px-4 py-3">
                        <p
                          className={
                            neverActive
                              ? "text-sm font-medium text-[var(--admin-warning)]"
                              : "text-sm text-[var(--admin-on-surface)]"
                          }
                        >
                          {formatRelative(row.lastActiveAt)}
                        </p>
                        {row.lastActiveAt ? (
                          <p className="mt-0.5 text-[10px] text-[var(--admin-on-surface-variant)]">
                            {formatAbsoluteDate(row.lastActiveAt)}
                          </p>
                        ) : null}
                      </td>
                      <td
                        className={cx(
                          "px-4 py-3 font-mono",
                          row.inactiveDays >= 90
                            ? "text-[var(--admin-warning)]"
                            : "text-[var(--admin-on-surface)]",
                        )}
                      >
                        {formatCount(row.inactiveDays)}d
                      </td>
                      <td className="px-4 py-3 text-[var(--admin-on-surface-variant)]">
                        {formatMonthYear(row.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        {row.hasPaid ? (
                          <StatusPill tone="success">Paid</StatusPill>
                        ) : (
                          <span className="text-[var(--admin-on-surface-variant)]">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {pageInfo && pageInfo.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-[var(--admin-border)] px-4 py-3">
            <p className="text-xs text-[var(--admin-on-surface-variant)]">
              Page {pageInfo.page} of {pageInfo.totalPages} · {formatCount(pageInfo.totalCount)}{" "}
              learners
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className={secondaryButtonClassName}
                disabled={!pageInfo.hasPreviousPage || loading}
                onClick={() => {
                  setPage((current) => Math.max(1, current - 1));
                }}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Prev
              </button>
              <button
                type="button"
                className={secondaryButtonClassName}
                disabled={!pageInfo.hasNextPage || loading}
                onClick={() => {
                  setPage((current) => current + 1);
                }}
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {deactivateTargets ? (
        <DeactivateModal
          items={deactivateTargets}
          busy={busy}
          onClose={() => {
            setDeactivateTargets(null);
          }}
          onConfirm={(input) => {
            void handleDeactivateConfirm(input);
          }}
        />
      ) : null}

      <MessageDrawer
        open={messageOpen}
        items={selectedItems}
        inactiveDays={settings.inactiveDays}
        busy={busy}
        onClose={() => {
          setMessageOpen(false);
        }}
        onSend={(input) => {
          void handleMessageSend(input);
        }}
      />

      <SettingsDrawer
        open={settingsOpen}
        draft={settingsDraft}
        liveCount={summary.inactiveLearnerCount}
        busy={busy}
        onChange={setSettingsDraft}
        onClose={() => {
          setSettingsOpen(false);
        }}
        onReset={() => {
          setSettingsDraft(DEFAULT_SETTINGS);
        }}
        onSave={saveSettings}
      />
    </div>
  );
}
