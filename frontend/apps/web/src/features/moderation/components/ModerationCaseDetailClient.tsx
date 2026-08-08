"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Clock,
  Loader2,
  Shield,
  Tag,
  Trash2,
  User,
} from "lucide-react";
import { AdminConfirmDialog } from "../../../components/shells/admin/AdminConfirmDialog";
import { fieldClassName } from "../../../app/admin/branding/_components/branding-admin-shared";
import {
  alertErrorClassName,
  decisionLabel,
  formatModerationDateTime,
  formatModerationReason,
  moderationEvidenceCardClassName,
  moderationPageDescClassName,
  moderationPageEyebrowClassName,
  moderationPageTitleClassName,
  moderationStatusBadgeClassName,
  moderationStickyFooterClassName,
  moderationTimelineDotClassName,
  monoClassName,
  outlineButtonClassName,
  panelClassName,
  primaryButtonClassName,
  targetTypeMeta,
} from "../moderation-admin-shared";
import { ADMIN_MODERATION_CASES_PATH } from "../moderation-paths";
import {
  decideModerationCase,
  formatModerationError,
  getModerationCase,
  type ModerationCaseItem,
} from "../api";

type PendingDecision = {
  decisionKey: "actioned" | "rejected" | "closed";
  contentAction?: "delete";
  label: string;
};

type TimelineEntry = {
  id: string;
  title: string;
  occurredAt: string;
  detail?: string;
  tone: "primary" | "secondary" | "warning";
};

function buildTimeline(detail: ModerationCaseItem): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    {
      id: "opened",
      title: "Case opened",
      occurredAt: detail.createdAt,
      detail: formatModerationReason(detail.reasonKey),
      tone: "primary",
    },
  ];

  for (const decision of detail.decisions ?? []) {
    entries.push({
      id: decision.id,
      title: decisionLabel(decision.decisionKey),
      occurredAt: decision.occurredAt,
      tone: decision.decisionKey === "begin_review" ? "warning" : "secondary",
    });
  }

  return entries.sort(
    (left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime(),
  );
}

const TIMELINE_DOT: Record<TimelineEntry["tone"], string> = {
  primary: "border-[color-mix(in_srgb,var(--admin-primary)_30%,var(--admin-surface))] bg-[var(--admin-primary)]",
  secondary:
    "border-[color-mix(in_srgb,var(--admin-primary)_25%,var(--admin-surface))] bg-[var(--admin-surface-high)]",
  warning:
    "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-surface))] bg-[var(--admin-warning)]",
};

export function ModerationCaseDetailClient({ caseId }: { caseId: string }) {
  const [detail, setDetail] = useState<ModerationCaseItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [pendingDecision, setPendingDecision] = useState<PendingDecision | null>(null);
  const [busy, setBusy] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await getModerationCase(caseId);
      setDetail(response.data.items[0] ?? null);
    } catch (error) {
      setErrorMessage(formatModerationError(error));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const timeline = useMemo(() => (detail ? buildTimeline(detail) : []), [detail]);

  async function handleDecide(args: PendingDecision) {
    setBusy(true);
    setErrorMessage(null);

    try {
      await decideModerationCase(caseId, {
        decisionKey: args.decisionKey,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        ...(args.contentAction ? { contentAction: args.contentAction } : {}),
      });
      setPendingDecision(null);
      setReason("");
      await loadDetail();
    } catch (error) {
      setErrorMessage(formatModerationError(error));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]" aria-live="polite">
        <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
        Loading case detail…
      </p>
    );
  }

  if (errorMessage && !detail) {
    return (
      <p className={alertErrorClassName} role="alert">
        {errorMessage}
      </p>
    );
  }

  if (!detail) {
    return (
      <p className="text-sm text-[var(--admin-on-surface-variant)]">Case not found.</p>
    );
  }

  const target = targetTypeMeta(detail.targetType);
  const TargetIcon = target.icon;
  const canDecide = detail.status === "REVIEWING";

  return (
    <div className={`space-y-6 ${canDecide ? "pb-4" : ""}`}>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--admin-border)] pb-5">
        <div className="space-y-3">
          <Link
            href={ADMIN_MODERATION_CASES_PATH}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--admin-primary)] transition-colors hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to queue
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <span className={moderationStatusBadgeClassName(detail.status)}>{detail.status}</span>
            <span className={`${monoClassName} text-[var(--admin-on-surface-variant)]`}>
              Case {detail.id.slice(0, 8)}
            </span>
          </div>
          <div>
            <p className={`${moderationPageEyebrowClassName} flex items-center gap-1.5`}>
              <Shield className="h-4 w-4" aria-hidden="true" />
              Violation: {formatModerationReason(detail.reasonKey)}
            </p>
            <h1 className={`${moderationPageTitleClassName} mt-1`}>
              {target.label} moderation case
            </h1>
            <p className={moderationPageDescClassName}>
              Review evidence and record a decision for this report.
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <section className={moderationEvidenceCardClassName} aria-labelledby="reported-evidence-heading">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] pb-3">
              <h2
                id="reported-evidence-heading"
                className="text-[13px] font-semibold uppercase tracking-[0.05em] text-[var(--admin-on-surface-variant)]"
              >
                Reported evidence
              </h2>
              {detail.target?.deleted ? (
                <span className="inline-flex items-center gap-1 rounded bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] px-2 py-0.5 text-[11px] font-bold uppercase text-[var(--admin-danger)]">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  Content deleted
                </span>
              ) : null}
            </div>

            <div className="relative rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-5">
              <div
                className="pointer-events-none absolute inset-0 flex select-none items-center justify-center overflow-hidden opacity-[0.03]"
                aria-hidden="true"
              >
                <span className="rotate-[-12deg] text-5xl font-bold uppercase tracking-widest">
                  Confidential
                </span>
              </div>
              {detail.target?.title ? (
                <p className="mb-3 text-sm font-semibold text-[var(--admin-on-surface)]">
                  {detail.target.title}
                </p>
              ) : null}
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--admin-on-surface)]">
                {detail.target?.previewText ?? "Content preview unavailable."}
              </p>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--admin-border)] pt-4">
                <span className="inline-flex items-center gap-1.5 rounded bg-[var(--admin-surface-high)] px-2 py-1 text-[12px] text-[var(--admin-on-surface-variant)]">
                  <TargetIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  {target.label}
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded bg-[var(--admin-surface-high)] px-2 py-1 text-[12px] ${monoClassName}`}>
                  ID {detail.targetId.slice(0, 10)}
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded bg-[var(--admin-surface-high)] px-2 py-1 text-[12px] text-[var(--admin-on-surface-variant)]">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Reported {formatModerationDateTime(detail.createdAt)}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded bg-[var(--admin-surface-high)] px-2 py-1 text-[12px] text-[var(--admin-on-surface-variant)]">
                <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                {formatModerationReason(detail.reasonKey)}
              </span>
            </div>
          </section>

          <section className={panelClassName} aria-labelledby="case-insights-heading">
            <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-3">
              <h2
                id="case-insights-heading"
                className="text-[13px] font-semibold uppercase tracking-[0.05em] text-[var(--admin-on-surface-variant)]"
              >
                Case insights
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
              <article className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] p-4">
                <p className="text-[13px] text-[var(--admin-on-surface-variant)]">Status</p>
                <p className={`${moderationPageTitleClassName} mt-1 text-lg`}>{detail.status}</p>
              </article>
              <article className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] p-4">
                <p className="text-[13px] text-[var(--admin-on-surface-variant)]">Decisions logged</p>
                <p className={`${moderationPageTitleClassName} mt-1 text-lg`}>
                  {detail.decisions?.length ?? 0}
                </p>
              </article>
              <article className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] p-4">
                <p className="text-[13px] text-[var(--admin-on-surface-variant)]">Appeals</p>
                <p className={`${moderationPageTitleClassName} mt-1 text-lg`}>
                  {detail.appeals?.length ?? 0}
                </p>
              </article>
            </div>
          </section>
        </div>

        <aside className="xl:col-span-4">
          <section
            className={`${panelClassName} xl:sticky xl:top-20`}
            aria-labelledby="case-lifecycle-heading"
          >
            <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-3">
              <h2
                id="case-lifecycle-heading"
                className="text-[13px] font-semibold uppercase tracking-[0.05em] text-[var(--admin-on-surface-variant)]"
              >
                Case lifecycle
              </h2>
            </div>
            <div className="space-y-0 p-5">
              {timeline.length === 0 ? (
                <p className="text-sm text-[var(--admin-on-surface-variant)]">
                  No lifecycle events recorded yet.
                </p>
              ) : (
                timeline.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="relative flex gap-3 pb-5 last:pb-0"
                  >
                    {index < timeline.length - 1 ? (
                      <span
                        className="absolute left-[7px] top-5 bottom-0 w-0.5 bg-[var(--admin-border)]"
                        aria-hidden="true"
                      />
                    ) : null}
                    <span
                      className={`${moderationTimelineDotClassName} ${TIMELINE_DOT[entry.tone]}`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 pt-0.5">
                      <p className="text-[13px] font-medium text-[var(--admin-on-surface)]">
                        {entry.title}
                      </p>
                      <p className="text-[13px] text-[var(--admin-on-surface-variant)]">
                        {formatModerationDateTime(entry.occurredAt)}
                      </p>
                      {entry.detail ? (
                        <p className="mt-1 text-[13px] text-[var(--admin-on-surface-variant)]">
                          {entry.detail}
                        </p>
                      ) : null}
                      {entry.id === "opened" ? (
                        <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--admin-on-surface-variant)]">
                          <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                          System intake
                        </div>
                      ) : null}
                      {entry.title.includes("review") ? (
                        <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--admin-primary)]">
                          <User className="h-3.5 w-3.5" aria-hidden="true" />
                          Moderator action
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-[var(--admin-border)] px-5 py-4">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[var(--admin-on-surface-variant)]">Content visibility</span>
                <span className="rounded bg-[var(--admin-surface-high)] px-2 py-0.5 text-[11px] font-bold uppercase text-[var(--admin-on-surface-variant)]">
                  {detail.target?.deleted ? "Removed" : "Active"}
                </span>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {errorMessage ? (
        <p className={alertErrorClassName} role="alert">
          {errorMessage}
        </p>
      ) : null}

      {canDecide ? (
        <footer className={moderationStickyFooterClassName} aria-label="Decision controls">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="flex-1">
              <label htmlFor="decision-reason" className="sr-only">
                Decision reason
              </label>
              <textarea
                id="decision-reason"
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                }}
                className={`${fieldClassName} min-h-20 resize-none`}
                placeholder="Enter resolution reasoning (recommended for audit logs)…"
              />
            </div>
            <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-[16rem]">
              <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                <button
                  type="button"
                  disabled={busy}
                  className={outlineButtonClassName}
                  onClick={() => {
                    setPendingDecision({ decisionKey: "rejected", label: "Reject case" });
                  }}
                >
                  Reject case
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-primary-container)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-primary-container)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => {
                    setPendingDecision({ decisionKey: "closed", label: "Close case" });
                  }}
                >
                  Close case (no action)
                </button>
              </div>
              <button
                type="button"
                disabled={busy || detail.target?.deleted}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--admin-danger)] px-4 py-2.5 text-sm font-bold text-[var(--admin-on-primary)] shadow-md transition-all hover:opacity-90 motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  setPendingDecision({
                    decisionKey: "actioned",
                    contentAction: "delete",
                    label: "Action and delete content",
                  });
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Action &amp; delete content
              </button>
            </div>
          </div>
        </footer>
      ) : null}

      <AdminConfirmDialog
        open={pendingDecision != null}
        title="Confirm decision"
        description={
          pendingDecision?.contentAction === "delete"
            ? "Confirm deleting the reported content and recording this decision. This cannot be undone."
            : `Confirm ${pendingDecision?.label.toLowerCase() ?? "this decision"}?`
        }
        confirmLabel="Confirm"
        busyLabel="Saving…"
        tone={pendingDecision?.contentAction === "delete" ? "danger" : "primary"}
        busy={busy}
        error={errorMessage}
        onConfirm={() => {
          if (pendingDecision) {
            void handleDecide(pendingDecision);
          }
        }}
        onCancel={() => {
          if (!busy) {
            setPendingDecision(null);
          }
        }}
      />
    </div>
  );
}
