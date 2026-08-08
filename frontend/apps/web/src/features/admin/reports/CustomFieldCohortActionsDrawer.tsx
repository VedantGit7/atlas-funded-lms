"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, Code2, Send, Users, X } from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  createCustomFieldReportGroup,
  sendCustomFieldReportMessage,
} from "./admin-custom-field-roster-api";
import {
  createGroupFromSegment,
  fetchCustomFieldSegments,
  type CustomFieldSegmentItem,
} from "./admin-custom-field-segments-api";

const fieldClassName =
  "w-full rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-on-surface)] outline-none transition-colors placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)] dark:bg-[var(--admin-surface-low)]";

const labelClassName =
  "font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]";

export type CustomFieldCohortDrawerMode = "group" | "message";

type Props = {
  open: boolean;
  initialMode?: CustomFieldCohortDrawerMode;
  onClose: () => void;
  onSuccess?: () => void;
};

function formatCount(n: number) {
  return new Intl.NumberFormat().format(n);
}

export function CustomFieldCohortActionsDrawer({
  open,
  initialMode = "group",
  onClose,
  onSuccess,
}: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<CustomFieldCohortDrawerMode>(initialMode);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [segments, setSegments] = useState<CustomFieldSegmentItem[]>([]);
  const [segmentId, setSegmentId] = useState("");
  const [audienceKind, setAudienceKind] = useState<"segment" | "adhoc">("segment");

  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [syncType, setSyncType] = useState<"static" | "live">("static");

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [excludeRecent, setExcludeRecent] = useState(true);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setConfirming(false);
    setError(null);
    setBusy(false);
    void fetchCustomFieldSegments()
      .then((res) => {
        setSegments(res.data.items);
        if (res.data.items[0] && !segmentId) {
          setSegmentId(res.data.items[0].id);
        }
      })
      .catch(() => setSegments([]));
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const selectedSegment = useMemo(
    () => segments.find((s) => s.id === segmentId) ?? null,
    [segments, segmentId],
  );

  const matchCount =
    audienceKind === "segment" ? (selectedSegment?.matchedCount ?? 0) : 0;

  const filterChips = useMemo(() => {
    if (audienceKind === "segment" && selectedSegment) {
      return [
        { label: "Segment", value: selectedSegment.name },
        {
          label: "Refresh",
          value: selectedSegment.refreshMode === "live" ? "Live" : "Snapshot",
        },
      ];
    }
    return [{ label: "Audience", value: "Ad-hoc filters (all matching learners)" }];
  }, [audienceKind, selectedSegment]);

  const effectiveExclude = excludeRecent ? 7 : 0;
  const estimatedSendCount =
    excludeRecent && matchCount > 0 ? Math.max(0, matchCount) : matchCount;

  if (!open) return null;

  async function submitGroup() {
    if (!groupName.trim()) {
      setError("Group name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (audienceKind === "segment" && segmentId) {
        await createGroupFromSegment(segmentId, {
          title: groupName.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
        });
      } else {
        await createCustomFieldReportGroup({
          title: groupName.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          syncType,
          criteriaSummary: "Ad-hoc filters",
        });
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to create group.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitMessage() {
    if (!subject.trim() || !message.trim()) {
      setError("Subject and message are required.");
      return;
    }
    if (audienceKind === "segment" && !segmentId) {
      setError("Select a segment audience.");
      return;
    }
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendCustomFieldReportMessage({
        subject: subject.trim(),
        message: message.trim(),
        audienceCaption:
          audienceKind === "segment" && selectedSegment
            ? `${formatCount(matchCount)} learners in ${selectedSegment.name}`
            : `${formatCount(matchCount)} learners from custom field report`,
        ...(effectiveExclude > 0 ? { excludeMessagedWithinDays: effectiveExclude } : {}),
        ...(audienceKind === "segment" && segmentId
          ? {
              segmentId,
              segmentName: selectedSegment?.name,
            }
          : {}),
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to send message.",
      );
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--admin-on-surface)_30%,transparent)] backdrop-blur-[2px]"
        aria-label="Close drawer overlay"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex h-full w-full max-w-[560px] flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_4px_32px_-4px_color-mix(in_srgb,var(--admin-on-surface)_20%,transparent)] outline-none"
      >
        <header className="sticky top-0 z-20 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-8 pb-6 pt-8">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2
              id={titleId}
              className="font-mono text-[20px] font-medium leading-7 tracking-tight text-[var(--admin-on-surface)]"
            >
              {matchCount > 0
                ? `${formatCount(matchCount)} learners match the current filters`
                : "Choose an audience to continue"}
            </h2>
            <button
              type="button"
              className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
              aria-label="Close drawer"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <Link
            href={
              audienceKind === "segment" && segmentId
                ? `/admin/reports/custom-field/segments/${segmentId}`
                : "/admin/reports/custom-field"
            }
            className="mb-5 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[var(--admin-primary)] hover:underline"
          >
            View matched learners <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <div className="flex flex-wrap gap-2">
            {filterChips.map((chip) => (
              <div
                key={`${chip.label}-${chip.value}`}
                className="inline-flex items-center rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2.5 py-1 font-mono text-[10px]"
              >
                <span className="mr-1.5 font-medium text-[var(--admin-on-surface)]">
                  {chip.label}
                </span>
                <span className="text-[var(--admin-on-surface-variant)]">{chip.value}</span>
              </div>
            ))}
          </div>
        </header>

        <div className="px-8 pb-2 pt-6">
          <div className="relative flex rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-1">
            {(
              [
                { key: "group" as const, label: "Create group" },
                { key: "message" as const, label: "Send message" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={[
                  "flex-1 rounded-md px-3 py-1.5 text-center font-mono text-[10px] font-medium uppercase tracking-wider transition-all",
                  mode === tab.key
                    ? "border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)] shadow-sm"
                    : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                ].join(" ")}
                onClick={() => {
                  setMode(tab.key);
                  setConfirming(false);
                  setError(null);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 pb-8">
          <div className="flex flex-col gap-5 pt-4">
            <div className="flex flex-col gap-2">
              <span className={labelClassName}>Audience</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={[
                    "rounded-sm border px-3 py-2 text-left text-sm transition-colors",
                    audienceKind === "segment"
                      ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,transparent)]"
                      : "border-[var(--admin-border)] hover:bg-[var(--admin-surface-high)]",
                  ].join(" ")}
                  onClick={() => setAudienceKind("segment")}
                >
                  Segment
                </button>
                <button
                  type="button"
                  className={[
                    "rounded-sm border px-3 py-2 text-left text-sm transition-colors",
                    audienceKind === "adhoc"
                      ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,transparent)]"
                      : "border-[var(--admin-border)] hover:bg-[var(--admin-surface-high)]",
                  ].join(" ")}
                  onClick={() => setAudienceKind("adhoc")}
                >
                  Ad-hoc filters
                </button>
              </div>
              {audienceKind === "segment" ? (
                <select
                  className={fieldClassName}
                  value={segmentId}
                  onChange={(e) => setSegmentId(e.target.value)}
                >
                  {segments.length === 0 ? (
                    <option value="">No segments yet</option>
                  ) : (
                    segments.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({formatCount(s.matchedCount)})
                      </option>
                    ))
                  )}
                </select>
              ) : (
                <p className="text-xs text-[var(--admin-on-surface-variant)]">
                  Creates from the full learner roster (apply filters on Learners first for a
                  narrower ad-hoc set, or pick a segment).
                </p>
              )}
            </div>

            {mode === "group" ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className={labelClassName} htmlFor="cf-cohort-group-name">
                    Group name
                  </label>
                  <input
                    id="cf-cohort-group-name"
                    className={fieldClassName}
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g. Experienced traders"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelClassName} htmlFor="cf-cohort-group-desc">
                    Description <span className="normal-case opacity-60">optional</span>
                  </label>
                  <textarea
                    id="cf-cohort-group-desc"
                    className={`${fieldClassName} resize-none`}
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                {audienceKind === "adhoc" ? (
                  <div className="flex flex-col gap-3">
                    <span className={labelClassName}>Sync mechanism</span>
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="radio"
                        className="mt-1"
                        checked={syncType === "static"}
                        onChange={() => setSyncType("static")}
                      />
                      <span>
                        <span className="block text-sm text-[var(--admin-on-surface)]">
                          Static snapshot
                        </span>
                        <span className="text-xs text-[var(--admin-on-surface-variant)]">
                          Captures these learners right now.
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="radio"
                        className="mt-1"
                        checked={syncType === "live"}
                        onChange={() => setSyncType("live")}
                      />
                      <span>
                        <span className="block text-sm text-[var(--admin-on-surface)]">
                          Live group
                        </span>
                        <span className="text-xs text-[var(--admin-on-surface-variant)]">
                          Marked as live; membership is a snapshot until live sync jobs land.
                        </span>
                      </span>
                    </label>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className={labelClassName} htmlFor="cf-cohort-subject">
                    Subject
                  </label>
                  <input
                    id="cf-cohort-subject"
                    className={fieldClassName}
                    value={subject}
                    onChange={(e) => {
                      setSubject(e.target.value);
                      setConfirming(false);
                    }}
                    placeholder="e.g. Update on your trading account"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-end justify-between">
                    <label className={labelClassName} htmlFor="cf-cohort-body">
                      Message body
                    </label>
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[var(--admin-primary)]">
                      <Code2 className="h-3 w-3" /> Plain text
                    </span>
                  </div>
                  <textarea
                    id="cf-cohort-body"
                    className={`${fieldClassName} min-h-[128px] resize-y`}
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      setConfirming(false);
                    }}
                    placeholder="Write the message learners will receive…"
                  />
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={excludeRecent}
                    onChange={(e) => setExcludeRecent(e.target.checked)}
                  />
                  <span>
                    <span className="block text-sm font-medium text-[var(--admin-on-surface)]">
                      Exclude learners messaged in last 7 days
                    </span>
                    <span className="text-xs text-[var(--admin-on-surface-variant)]">
                      Reduces repeat emails for recently contacted learners.
                    </span>
                  </span>
                </label>

                {confirming ? (
                  <div className="rounded border border-[color-mix(in_srgb,var(--admin-warning)_40%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] p-4">
                    <p className="mb-3 text-sm text-[var(--admin-on-surface)]">
                      Confirm broadcast to about{" "}
                      <strong className="font-semibold">{formatCount(estimatedSendCount)}</strong>{" "}
                      learners. Once sent, messages cannot be recalled.
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className={labelClassName}>Channels</div>
                        <div className="mt-1 text-[var(--admin-on-surface)]">Email</div>
                      </div>
                      <div>
                        <div className={labelClassName}>Timing</div>
                        <div className="mt-1 text-[var(--admin-on-surface)]">Send now</div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            )}

            {error ? (
              <p className="rounded-sm border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,transparent)] px-3 py-2 text-sm text-[var(--admin-danger)]">
                {error}
              </p>
            ) : null}
          </div>
        </div>

        <footer className="sticky bottom-0 z-20 flex items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-8 py-5">
          <button
            type="button"
            className="font-mono text-[10px] uppercase tracking-wider text-[var(--admin-primary)] hover:underline disabled:opacity-40"
            disabled
            title="Coming soon"
          >
            Send test to myself
          </button>
          <div className="flex items-center gap-3">
            <button type="button" className={ghostButtonClassName} onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className={`${primaryButtonClassName} inline-flex items-center gap-2`}
              disabled={busy || (audienceKind === "segment" && !segmentId)}
              onClick={() => void (mode === "group" ? submitGroup() : submitMessage())}
            >
              {mode === "group" ? (
                <>
                  <Users className="h-4 w-4" />
                  {busy
                    ? "Creating…"
                    : `Create group${matchCount ? ` with ${formatCount(matchCount)}` : ""}`}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {busy
                    ? "Sending…"
                    : confirming
                      ? `Execute broadcast`
                      : `Send to ${formatCount(estimatedSendCount || matchCount)} learners`}
                </>
              )}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
