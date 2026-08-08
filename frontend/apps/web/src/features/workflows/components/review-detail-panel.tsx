"use client";

import Link from "next/link";
import { ExternalLink, Eye, Quote } from "lucide-react";
import type { WorkflowQueueItem } from "../api";
import {
  REVIEW_STATE_BADGE,
  TARGET_TYPE_CONFIG,
  badgeClassName,
  formatLifecycleState,
  formatSubmittedAt,
  formatTargetType,
  learnerAvatarClassName,
  learnerInitials,
  quoteBlockClassName,
  secondaryButtonClassName,
  studioHrefForTarget,
  submitterLabel,
} from "../review-studio-shared";

type ReviewDetailPanelProps = {
  item: WorkflowQueueItem | null;
};

export function ReviewDetailPanel({ item }: ReviewDetailPanelProps) {
  if (!item) {
    return (
      <section
        className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center"
        aria-label="Review detail"
      >
        <Eye className="mb-3 h-10 w-10 text-[var(--admin-on-surface-variant)] opacity-50" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">Select a pending item</h2>
        <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
          Choose a submission from the queue to inspect its details, workflow history, and decision
          controls.
        </p>
      </section>
    );
  }

  const typeConfig = TARGET_TYPE_CONFIG[item.target.type];
  const submitterName = submitterLabel(item.submittedByMembershipId);

  return (
    <section aria-label="Review detail">
      <header className="border-b border-[var(--admin-border)] px-4 py-5 sm:px-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
            {item.target.title}
          </h2>
          <span
            className={`${badgeClassName} ${typeConfig.className} px-2 py-0.5 text-[10px] uppercase`}
          >
            {typeConfig.shortLabel}
          </span>
          <span
            className={`${badgeClassName} ${REVIEW_STATE_BADGE} inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase`}
          >
            <Eye className="h-3 w-3" aria-hidden="true" />
            In review
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold ${learnerAvatarClassName(submitterName)}`}
            aria-hidden="true"
          >
            {learnerInitials(submitterName)}
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--admin-on-surface)]">{submitterName}</p>
            <p className="text-xs text-[var(--admin-on-surface-variant)]">
              Submitted {formatSubmittedAt(item.submittedAt)}
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-6 px-4 py-6 sm:px-6">
        {item.comment ? (
          <blockquote className={quoteBlockClassName}>
            <Quote
              className="absolute -top-3 left-4 bg-[var(--admin-surface-low)] px-1 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            <p className="text-base italic leading-relaxed text-[var(--admin-on-surface)]">
              &ldquo;{item.comment}&rdquo;
            </p>
          </blockquote>
        ) : (
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            No submission comment was provided.
          </p>
        )}

        <div className="overflow-hidden rounded-xl border border-[var(--admin-border)]">
          <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface)]">
              Review summary
            </span>
            <Link
              href={studioHrefForTarget(item)}
              className={`${secondaryButtonClassName} inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px]`}
            >
              Open in Studio
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          <dl className="divide-y divide-[var(--admin-border)] text-sm">
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-[var(--admin-on-surface-variant)]">Content type</dt>
              <dd className="font-medium text-[var(--admin-on-surface)]">
                {formatTargetType(item.target.type)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-[var(--admin-on-surface-variant)]">Current status</dt>
              <dd className="font-medium text-[var(--admin-on-surface)]">{item.target.status}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-[var(--admin-on-surface-variant)]">Requested transition</dt>
              <dd className="font-medium text-[var(--admin-on-surface)]">
                {formatLifecycleState(item.fromState)} → {formatLifecycleState(item.toState)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
