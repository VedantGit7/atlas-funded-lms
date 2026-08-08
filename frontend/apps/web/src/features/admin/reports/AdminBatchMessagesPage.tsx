"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  Mail,
  MessageSquare,
  Plus,
  RefreshCw,
  Users,
  X,
} from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  fetchBatchMessageAudiences,
  fetchBatchMessageNudges,
  fetchBatchMessages,
  retryBatchMessage,
  sendBatchMessage,
  updateBatchMessageNudges,
  type BatchMessageAudience,
  type BatchMessageHistoryItem,
  type BatchMessageNudge,
  type BatchMessagesListData,
} from "./admin-batches-roster-api";

type Channel = "email" | "in_app";
type TimingMode = "now" | "schedule";

type ComposerState = {
  membershipIds: string[] | null;
  audienceLabel: string;
  subject: string;
  message: string;
};

const fieldClassName =
  "h-9 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-xs text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";
const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const SUB_TABS = [
  { key: "overview", label: "Overview", path: "" },
  { key: "learners", label: "Learners", path: "?tab=learners" },
  { key: "live_sessions", label: "Live sessions", path: "/live-sessions" },
  { key: "exams", label: "Exams", path: "/exams" },
  { key: "content", label: "Content", path: "/content" },
  { key: "messages", label: "Messages", path: "/messages" },
] as const;

const MERGE_TAGS = [
  { key: "{{Learner Name}}", label: "Learner Name" },
  { key: "{{Batch Name}}", label: "Batch Name" },
  { key: "{{Course Title}}", label: "Course Title" },
  { key: "{{Completion %}}", label: "Completion %" },
  { key: "{{Next Session Date}}", label: "Next Session Date" },
] as const;

const PAGE_SIZE = 20;

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

function formatCount(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "-";
  return new Intl.NumberFormat().format(n);
}

function errMsg(e: unknown, fallback: string) {
  if (e instanceof ClientApiError || e instanceof Error) return e.message;
  return fallback;
}

function slugifyTrigger(label: string) {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return slug || `nudge_${Date.now()}`;
}

function statusBadge(status: BatchMessageHistoryItem["status"]) {
  if (status === "sent") {
    return {
      label: "Sent",
      className:
        "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]",
    };
  }
  if (status === "partially_failed") {
    return {
      label: "Partially failed",
      className:
        "border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]",
    };
  }
  if (status === "failed") {
    return {
      label: "Failed",
      className:
        "border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]",
    };
  }
  return {
    label: "Scheduled",
    className:
      "border-[var(--admin-outline)] bg-[var(--admin-surface)] text-[var(--admin-on-surface-variant)]",
  };
}

function messageFooter(item: BatchMessageHistoryItem) {
  if (item.status === "scheduled" && item.scheduledAt) {
    return `Scheduled for ${formatDateTime(item.scheduledAt)}`;
  }
  if (item.isAutomated) {
    return "System automated nudge";
  }
  if (item.sentByLabel && item.sentAt) {
    return `Sent by ${item.sentByLabel} on ${formatDateTime(item.sentAt)}`;
  }
  if (item.sentAt) {
    return `Sent on ${formatDateTime(item.sentAt)}`;
  }
  return "-";
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-16 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)]">
        <MessageSquare
          className="h-8 w-8 text-[var(--admin-outline)]"
          aria-hidden="true"
          strokeWidth={1.5}
        />
      </div>
      <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
        {description}
      </p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

function ErrorStrip({
  title,
  detail,
  onRetry,
  onDismiss,
}: {
  title: string;
  detail?: string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-4 sm:flex-row sm:items-center sm:justify-between"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-[var(--admin-danger)]">{title}</p>
          {detail ? (
            <p className="mt-0.5 text-xs text-[color-mix(in_srgb,var(--admin-danger)_70%,var(--admin-on-surface))]">
              {detail}
            </p>
          ) : null}
        </div>
      </div>
      {onRetry ? (
        <button
          type="button"
          className="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--admin-danger)] px-4 text-xs font-semibold text-white hover:opacity-90"
          onClick={onRetry}
        >
          <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </button>
      ) : null}
      {onDismiss ? (
        <button type="button" className={ghostButtonClassName} onClick={onDismiss}>
          Dismiss
        </button>
      ) : null}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Shimmer className="h-3 w-72 max-w-full" />
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
        <div className="space-y-2">
          <Shimmer className="h-8 w-40" />
          <Shimmer className="h-4 w-96 max-w-full" />
        </div>
        <Shimmer className="h-9 w-36" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Shimmer key={i} className="h-8 w-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.38fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
            >
              <Shimmer className="mb-3 h-4 w-2/3 max-w-xs" />
              <Shimmer className="mb-2 h-3 w-40" />
              <div className="mt-4 grid grid-cols-4 gap-3">
                <Shimmer className="h-8 w-full" />
                <Shimmer className="h-8 w-full" />
                <Shimmer className="h-8 w-full" />
                <Shimmer className="h-8 w-full" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <Shimmer className="mb-4 h-4 w-40" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Shimmer key={i} className="mb-3 h-10 w-full" />
            ))}
          </div>
          <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <Shimmer className="mb-4 h-4 w-36" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Shimmer key={i} className="mb-3 h-9 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
        >
          <Shimmer className="mb-3 h-4 w-2/3 max-w-xs" />
          <Shimmer className="mb-2 h-3 w-40" />
          <div className="mt-4 grid grid-cols-4 gap-3">
            <Shimmer className="h-8 w-full" />
            <Shimmer className="h-8 w-full" />
            <Shimmer className="h-8 w-full" />
            <Shimmer className="h-8 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ConfirmSendModal({
  open,
  count,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  count: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close confirm overlay"
        disabled={busy}
        onClick={() => {
          if (!busy) onCancel();
        }}
      />
      <div className="relative z-10 w-full max-w-md rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-xl">
        <h2 id={titleId} className="text-base font-semibold text-[var(--admin-on-surface)]">
          Confirm send to {formatCount(count)} learner{count === 1 ? "" : "s"}?
        </h2>
        <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
          This message cannot be recalled once it is queued. Review the audience and channels before
          sending.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className={ghostButtonClassName} disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={busy || count <= 0}
            onClick={onConfirm}
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            {busy ? "Sending…" : "Confirm send"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ComposerDrawer({
  open,
  batchId,
  rosterCount,
  composer,
  busy,
  onClose,
  onSubjectChange,
  onMessageChange,
  onSent,
  onError,
}: {
  open: boolean;
  batchId: string;
  rosterCount: number;
  composer: ComposerState;
  busy: boolean;
  onClose: () => void;
  onSubjectChange: (v: string) => void;
  onMessageChange: (v: string) => void;
  onSent: () => void;
  onError: (message: string) => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement | null>(null);
  const messageRef = useRef<HTMLTextAreaElement | null>(null);
  const [channelEmail, setChannelEmail] = useState(true);
  const [channelInApp, setChannelInApp] = useState(true);
  const [excludeRecent, setExcludeRecent] = useState(false);
  const [timing, setTiming] = useState<TimingMode>("now");
  const [scheduleLocal, setScheduleLocal] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const isWholeBatch = composer.membershipIds == null;
  const matchCount = isWholeBatch ? rosterCount : composer.membershipIds.length;
  const channels: Channel[] = [
    ...(channelEmail ? (["email"] as const) : []),
    ...(channelInApp ? (["in_app"] as const) : []),
  ];
  const canSubmit =
    matchCount > 0 &&
    composer.subject.trim().length > 0 &&
    composer.message.trim().length > 0 &&
    channels.length > 0 &&
    (timing === "now" || scheduleLocal.trim().length > 0);

  useEffect(() => {
    if (!open) return;
    setChannelEmail(true);
    setChannelInApp(true);
    setExcludeRecent(false);
    setTiming("now");
    setScheduleLocal("");
    setConfirmOpen(false);
    setSending(false);
  }, [open, composer.audienceLabel, composer.membershipIds]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = panel.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    (focusable ?? panel).focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy && !sending && !confirmOpen) {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, sending, confirmOpen, onClose]);

  function insertMergeTag(tag: string) {
    const el = messageRef.current;
    const current = composer.message;
    if (!el) {
      onMessageChange(`${current}${tag}`);
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${tag}${current.slice(end)}`;
    onMessageChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + tag.length;
      el.setSelectionRange(caret, caret);
    });
  }

  async function doSend() {
    if (!canSubmit) return;
    setSending(true);
    try {
      const body: Record<string, unknown> = {
        batchId,
        subject: composer.subject.trim(),
        message: composer.message.trim(),
        audienceLabel: composer.audienceLabel.trim() || undefined,
        channels,
      };
      if (!isWholeBatch && composer.membershipIds) {
        body.membershipIds = composer.membershipIds;
      }
      if (excludeRecent) {
        body.excludeMessagedWithinDays = 7;
      }
      if (timing === "schedule" && scheduleLocal) {
        const iso = new Date(scheduleLocal).toISOString();
        if (!Number.isNaN(new Date(iso).getTime())) {
          body.scheduleAt = iso;
        }
      }
      await sendBatchMessage(body);
      setConfirmOpen(false);
      onSent();
    } catch (e) {
      setConfirmOpen(false);
      onError(errMsg(e, "Couldn't send message."));
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)]">
        <button
          type="button"
          className="absolute inset-0 cursor-default"
          aria-label="Close message drawer overlay"
          onClick={() => {
            if (!busy && !sending) onClose();
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
                {formatCount(matchCount)} learner{matchCount === 1 ? "" : "s"} match
              </h2>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                {composer.audienceLabel || (isWholeBatch ? "Whole batch" : "Selected learners")}
                {excludeRecent
                  ? " · Exclude recent may reduce the final send count"
                  : ""}
              </p>
            </div>
            <button
              type="button"
              className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
              aria-label="Close"
              disabled={busy || sending}
              onClick={onClose}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <label className="grid gap-1.5 text-xs text-[var(--admin-on-surface-variant)]">
              Subject
              <input
                className={fieldClassName}
                value={composer.subject}
                onChange={(e) => onSubjectChange(e.target.value)}
                maxLength={200}
                placeholder="Announcement subject"
              />
            </label>

            <div className="grid gap-1.5">
              <span className="text-xs text-[var(--admin-on-surface-variant)]">Message</span>
              <div className="overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] focus-within:border-[var(--admin-primary)] focus-within:ring-2 focus-within:ring-[var(--admin-primary)]/30">
                <div className="flex flex-wrap gap-1.5 border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-2">
                  {MERGE_TAGS.map((tag) => (
                    <button
                      key={tag.key}
                      type="button"
                      className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-1 font-mono text-[10px] text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                      onClick={() => insertMergeTag(tag.key)}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
                <textarea
                  ref={messageRef}
                  className="min-h-[160px] w-full resize-y border-0 bg-transparent px-3 py-2 text-xs text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)]"
                  rows={8}
                  value={composer.message}
                  onChange={(e) => onMessageChange(e.target.value)}
                  maxLength={10000}
                  placeholder="Write your announcement or nudge…"
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 text-sm text-[var(--admin-on-surface)]">
              <input
                type="checkbox"
                className="mt-0.5 accent-[var(--admin-primary)]"
                checked={excludeRecent}
                onChange={(e) => setExcludeRecent(e.target.checked)}
              />
              <span>
                Exclude learners messaged in the last 7 days
                <span className="mt-0.5 block text-xs text-[var(--admin-on-surface-variant)]">
                  Send count still shows {formatCount(matchCount)} until the server applies the
                  filter.
                </span>
              </span>
            </label>

            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-[var(--admin-on-surface-variant)]">
                Channels
              </legend>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-[var(--admin-on-surface)]">
                  <input
                    type="checkbox"
                    className="accent-[var(--admin-primary)]"
                    checked={channelEmail}
                    onChange={(e) => setChannelEmail(e.target.checked)}
                  />
                  Email
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--admin-on-surface)]">
                  <input
                    type="checkbox"
                    className="accent-[var(--admin-primary)]"
                    checked={channelInApp}
                    onChange={(e) => setChannelInApp(e.target.checked)}
                  />
                  In-app
                </label>
              </div>
              {channels.length === 0 ? (
                <p className="text-xs text-[var(--admin-danger)]">Select at least one channel.</p>
              ) : null}
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-xs font-medium text-[var(--admin-on-surface-variant)]">
                Timing
              </legend>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-[var(--admin-on-surface)]">
                  <input
                    type="radio"
                    name="message-timing"
                    className="accent-[var(--admin-primary)]"
                    checked={timing === "now"}
                    onChange={() => setTiming("now")}
                  />
                  Now
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--admin-on-surface)]">
                  <input
                    type="radio"
                    name="message-timing"
                    className="accent-[var(--admin-primary)]"
                    checked={timing === "schedule"}
                    onChange={() => setTiming("schedule")}
                  />
                  Schedule
                </label>
              </div>
              {timing === "schedule" ? (
                <label className="grid gap-1.5 text-xs text-[var(--admin-on-surface-variant)]">
                  Schedule at
                  <input
                    type="datetime-local"
                    className={fieldClassName}
                    value={scheduleLocal}
                    onChange={(e) => setScheduleLocal(e.target.value)}
                  />
                </label>
              ) : null}
            </fieldset>
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--admin-border)] px-6 py-4">
            <button
              type="button"
              className={ghostButtonClassName}
              disabled={busy || sending}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className={primaryButtonClassName}
              disabled={busy || sending || !canSubmit}
              onClick={() => setConfirmOpen(true)}
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              Send to {formatCount(matchCount)} learners
            </button>
          </div>
        </aside>
      </div>

      <ConfirmSendModal
        open={confirmOpen}
        count={matchCount}
        busy={sending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void doSend()}
      />
    </>
  );
}

function MessageHistoryCard({
  item,
  retryingId,
  onRetry,
}: {
  item: BatchMessageHistoryItem;
  retryingId: string | null;
  onRetry: (sendGroupId: string) => void;
}) {
  const badge = statusBadge(item.status);
  const showRail = item.status === "partially_failed" || item.status === "failed";
  const canRetry = showRail;
  const skippedFailed =
    item.skippedCount + item.failedCount > 0
      ? `${formatCount(item.skippedCount)} / ${formatCount(item.failedCount)}`
      : formatCount(0);

  return (
    <article className="relative overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      {showRail ? (
        <span
          className="absolute inset-y-0 left-0 w-1 bg-[var(--admin-danger)]"
          aria-hidden="true"
        />
      ) : null}
      <div className={`p-4 ${showRail ? "pl-5" : ""}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-[var(--admin-on-surface)]">
              {item.subject || "Untitled message"}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
              {item.audienceLabel || "-"}
            </p>
          </div>
          <span
            className={`inline-flex shrink-0 items-center rounded-sm border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.channels.map((channel) => (
            <span
              key={channel}
              className="inline-flex items-center rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--admin-on-surface-variant)]"
            >
              {channel === "email" ? "Email" : "In-app"}
            </span>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Delivered", value: formatCount(item.deliveredCount) },
            { label: "Skipped / Failed", value: skippedFailed },
            {
              label: "Opened",
              value: item.openedCount == null ? "-" : formatCount(item.openedCount),
            },
            {
              label: "Clicked",
              value: item.clickedCount == null ? "-" : formatCount(item.clickedCount),
            },
          ].map((metric) => (
            <div key={metric.label}>
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                {metric.label}
              </p>
              <p className="mt-1 font-mono text-sm font-medium text-[var(--admin-on-surface)]">
                {metric.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--admin-border)] pt-3">
          <p className="text-xs text-[var(--admin-on-surface-variant)]">{messageFooter(item)}</p>
          {canRetry ? (
            <button
              type="button"
              className={secondaryButtonClassName}
              disabled={retryingId === item.sendGroupId}
              onClick={() => onRetry(item.sendGroupId)}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              {retryingId === item.sendGroupId ? "Retrying…" : "Retry failed"}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function AdminBatchMessagesPage({ batchId }: { batchId: string }) {
  const [data, setData] = useState<BatchMessagesListData | null>(null);
  const [audiences, setAudiences] = useState<BatchMessageAudience[]>([]);
  const [nudges, setNudges] = useState<BatchMessageNudge[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [nudgeBusy, setNudgeBusy] = useState(false);
  const [showNudgeForm, setShowNudgeForm] = useState(false);
  const [nudgeTitle, setNudgeTitle] = useState("");
  const [nudgeTriggerLabel, setNudgeTriggerLabel] = useState("");

  const [composerOpen, setComposerOpen] = useState(false);
  const [composer, setComposer] = useState<ComposerState>({
    membershipIds: null,
    audienceLabel: "Whole batch",
    subject: "",
    message: "",
  });

  const loadAll = useCallback(
    async (opts?: { page?: number; soft?: boolean }) => {
      const nextPage = opts?.page ?? page;
      if (opts?.soft) setHistoryLoading(true);
      else setLoading(true);
      setError(null);
      try {
        const [messagesRes, audiencesRes, nudgesRes] = await Promise.all([
          fetchBatchMessages(batchId, { page: nextPage, limit: PAGE_SIZE }),
          fetchBatchMessageAudiences(batchId),
          fetchBatchMessageNudges(batchId),
        ]);
        setData(messagesRes.data);
        setAudiences(audiencesRes.data.audiences);
        setNudges(nudgesRes.data.nudges);
        setPage(nextPage);
      } catch (e) {
        setError(errMsg(e, "Couldn't load batch messages."));
        if (!opts?.soft) {
          setData(null);
          setAudiences([]);
          setNudges([]);
        }
      } finally {
        setLoading(false);
        setHistoryLoading(false);
      }
    },
    [batchId, page],
  );

  const reloadHistory = useCallback(
    async (nextPage = page) => {
      setHistoryLoading(true);
      setActionError(null);
      try {
        const response = await fetchBatchMessages(batchId, {
          page: nextPage,
          limit: PAGE_SIZE,
        });
        setData(response.data);
        setPage(nextPage);
      } catch (e) {
        setActionError(errMsg(e, "Couldn't refresh message history."));
      } finally {
        setHistoryLoading(false);
      }
    },
    [batchId, page],
  );

  useEffect(() => {
    void loadAll({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, [batchId]);

  function openComposer(opts?: {
    membershipIds?: string[] | null;
    audienceLabel?: string;
    subject?: string;
    message?: string;
  }) {
    const whole = opts?.membershipIds === undefined || opts.membershipIds === null;
    setComposer({
      membershipIds: whole ? null : opts.membershipIds ?? [],
      audienceLabel: opts?.audienceLabel?.trim() || (whole ? "Whole batch" : "Selected learners"),
      subject: opts?.subject ?? "",
      message: opts?.message ?? "",
    });
    setComposerOpen(true);
    setActionError(null);
  }

  async function handleRetry(sendGroupId: string) {
    setRetryingId(sendGroupId);
    setActionError(null);
    try {
      await retryBatchMessage(batchId, sendGroupId);
      await reloadHistory(page);
    } catch (e) {
      setActionError(errMsg(e, "Couldn't retry failed deliveries."));
    } finally {
      setRetryingId(null);
    }
  }

  async function persistNudges(next: BatchMessageNudge[]) {
    setNudgeBusy(true);
    setActionError(null);
    const previous = nudges;
    setNudges(next);
    try {
      const response = await updateBatchMessageNudges(batchId, next);
      setNudges(response.data.nudges);
    } catch (e) {
      setNudges(previous);
      setActionError(errMsg(e, "Couldn't update automated nudges."));
    } finally {
      setNudgeBusy(false);
    }
  }

  async function toggleNudge(id: string, enabled: boolean) {
    const next = nudges.map((n) => (n.id === id ? { ...n, enabled } : n));
    await persistNudges(next);
  }

  async function addNudge() {
    const title = nudgeTitle.trim();
    const triggerLabel = nudgeTriggerLabel.trim();
    if (!title || !triggerLabel) return;
    const triggerKey = slugifyTrigger(triggerLabel);
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `nudge_${Date.now()}`;
    const next: BatchMessageNudge[] = [
      ...nudges,
      { id, title, triggerKey, triggerLabel, enabled: true },
    ];
    await persistNudges(next);
    setNudgeTitle("");
    setNudgeTriggerLabel("");
    setShowNudgeForm(false);
  }

  const batchName = data?.batchName ?? "Batch";
  const rosterCount = data?.rosterCount ?? 0;
  const items = data?.items ?? [];
  const pageInfo = data?.pageInfo ?? null;
  const totalPages = pageInfo?.totalPages ?? 0;

  if (loading && !data) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
        <PageSkeleton />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
        <ErrorStrip
          title="Couldn't load batch messages."
          detail={error}
          onRetry={() => void loadAll({ page: 1 })}
        />
        <div className="opacity-40">
          <PageSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
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
        <Link href={`/admin/reports/batches/${batchId}`} className="hover:text-[var(--admin-primary)]">
          {batchName}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium text-[var(--admin-on-surface)]">Messages</span>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
            Messages
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Announcements and nudges sent to learners in this batch.
          </p>
        </div>
        <button
          type="button"
          className={primaryButtonClassName}
          onClick={() => openComposer({ membershipIds: null, audienceLabel: "Whole batch" })}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New message
        </button>
      </div>

      <div className="border-b border-[var(--admin-border)]">
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Batch report tabs">
          {SUB_TABS.map((tab) => {
            const active = tab.key === "messages";
            return (
              <Link
                key={tab.key}
                href={`/admin/reports/batches/${batchId}${tab.path}`}
                role="tab"
                aria-selected={active}
                className={[
                  "inline-flex h-10 shrink-0 items-center px-4 text-xs font-semibold uppercase tracking-[0.06em] transition-colors",
                  active
                    ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
                    : "border-b-2 border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]",
                ].join(" ")}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {actionError ? (
        <ErrorStrip title={actionError} onDismiss={() => setActionError(null)} />
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.38fr)_minmax(0,1fr)]">
        <section aria-label="Message history" className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
              History
            </h2>
            {pageInfo ? (
              <p className="text-xs text-[var(--admin-on-surface-variant)]">
                {formatCount(pageInfo.totalCount)} message
                {pageInfo.totalCount === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>

          {historyLoading && items.length === 0 ? (
            <HistorySkeleton />
          ) : items.length === 0 ? (
            <EmptyState
              title="No messages sent to this batch yet"
              description="Send an announcement or nudge to learners in this cohort. History will appear here after the first send."
              action={
                <button
                  type="button"
                  className={primaryButtonClassName}
                  onClick={() =>
                    openComposer({ membershipIds: null, audienceLabel: "Whole batch" })
                  }
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  New message
                </button>
              }
            />
          ) : (
            <div className={`space-y-3 ${historyLoading ? "opacity-60" : ""}`}>
              {items.map((item) => (
                <MessageHistoryCard
                  key={item.sendGroupId}
                  item={item}
                  retryingId={retryingId}
                  onRetry={(id) => void handleRetry(id)}
                />
              ))}
            </div>
          )}

          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                className={ghostButtonClassName}
                disabled={!pageInfo?.hasPreviousPage || historyLoading}
                onClick={() => void reloadHistory(page - 1)}
              >
                Previous
              </button>
              <p className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                Page {page} of {totalPages}
              </p>
              <button
                type="button"
                className={ghostButtonClassName}
                disabled={!pageInfo?.hasNextPage || historyLoading}
                onClick={() => void reloadHistory(page + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
        </section>

        <aside className="flex min-w-0 flex-col gap-4" aria-label="Message tools">
          <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
                <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--admin-on-surface)]">
                  Automated nudges
                </h2>
              </div>
              <button
                type="button"
                className={ghostButtonClassName}
                disabled={nudgeBusy}
                onClick={() => setShowNudgeForm((v) => !v)}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                New nudge
              </button>
            </div>

            {showNudgeForm ? (
              <div className="mb-4 space-y-3 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-3">
                <label className="grid gap-1.5 text-xs text-[var(--admin-on-surface-variant)]">
                  Title
                  <input
                    className={fieldClassName}
                    value={nudgeTitle}
                    onChange={(e) => setNudgeTitle(e.target.value)}
                    maxLength={120}
                    placeholder="Missed session follow-up"
                  />
                </label>
                <label className="grid gap-1.5 text-xs text-[var(--admin-on-surface-variant)]">
                  Trigger label
                  <input
                    className={fieldClassName}
                    value={nudgeTriggerLabel}
                    onChange={(e) => setNudgeTriggerLabel(e.target.value)}
                    maxLength={120}
                    placeholder="After missed live session"
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className={ghostButtonClassName}
                    disabled={nudgeBusy}
                    onClick={() => {
                      setShowNudgeForm(false);
                      setNudgeTitle("");
                      setNudgeTriggerLabel("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    disabled={
                      nudgeBusy || !nudgeTitle.trim() || !nudgeTriggerLabel.trim()
                    }
                    onClick={() => void addNudge()}
                  >
                    Add nudge
                  </button>
                </div>
              </div>
            ) : null}

            {nudges.length === 0 ? (
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                No automated nudges configured for this batch yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {nudges.map((nudge) => (
                  <li
                    key={nudge.id}
                    className="flex items-start justify-between gap-3 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--admin-on-surface)]">
                        {nudge.title}
                      </p>
                      <span className="mt-1 inline-flex max-w-full truncate rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                        {nudge.triggerLabel || nudge.triggerKey}
                      </span>
                    </div>
                    <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]">
                      <span className="sr-only">Enable {nudge.title}</span>
                      <input
                        type="checkbox"
                        className="accent-[var(--admin-primary)]"
                        checked={nudge.enabled}
                        disabled={nudgeBusy}
                        onChange={(e) => void toggleNudge(nudge.id, e.target.checked)}
                      />
                      On
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
              <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--admin-on-surface)]">
                Audience shortcuts
              </h2>
            </div>
            {audiences.length === 0 ? (
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                No audience shortcuts available.
              </p>
            ) : (
              <ul className="space-y-2">
                {audiences.map((audience) => (
                  <li
                    key={audience.key}
                    className="flex items-center justify-between gap-3 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--admin-on-surface)]">
                        {audience.label}
                      </p>
                      <p className="text-xs text-[var(--admin-on-surface-variant)]">
                        {formatCount(audience.count)} learner
                        {audience.count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      disabled={audience.count === 0}
                      onClick={() =>
                        openComposer({
                          membershipIds:
                            audience.key === "whole_batch" ? null : audience.membershipIds,
                          audienceLabel: audience.label,
                          subject:
                            audience.key === "whole_batch"
                              ? "Update for your batch"
                              : "A quick note about your progress",
                          message:
                            audience.key === "whole_batch"
                              ? "Sharing an update for everyone in {{Batch Name}}."
                              : "We wanted to check in. Please continue with {{Course Title}} when you can.",
                        })
                      }
                    >
                      <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                      Message
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      <ComposerDrawer
        open={composerOpen}
        batchId={batchId}
        rosterCount={rosterCount}
        composer={composer}
        busy={false}
        onClose={() => setComposerOpen(false)}
        onSubjectChange={(v) => setComposer((c) => ({ ...c, subject: v }))}
        onMessageChange={(v) => setComposer((c) => ({ ...c, message: v }))}
        onSent={() => {
          setComposerOpen(false);
          setComposer({
            membershipIds: null,
            audienceLabel: "Whole batch",
            subject: "",
            message: "",
          });
          void reloadHistory(1);
        }}
        onError={(message) => setActionError(message)}
      />
    </div>
  );
}
