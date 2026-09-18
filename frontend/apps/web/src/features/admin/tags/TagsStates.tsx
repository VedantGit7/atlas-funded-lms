"use client";

import Link from "next/link";
import { CloudOff, Plus, RotateCcw, SearchX, Tags, X } from "lucide-react";
import { manageSecondaryButtonClassName } from "../manage/manage-ui-shared";
import { tagEmptyPanelClassName, tagTableShellClassName } from "./tags-shared";

/**
 * The four non-happy states of the tag list.
 *
 * They live together because the difference between them is the thing that
 * matters: "this academy has no tags" and "nothing matched your filters" are
 * the same empty table but need opposite recovery actions, and shipping only
 * one of them is the usual way a filtered list becomes a dead end.
 */

export function TagsSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className={tagTableShellClassName} aria-hidden="true">
      <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)]/60 px-4 py-3">
        <div className="h-3 w-32 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b border-[var(--admin-border)] px-4 py-3.5"
        >
          <div className="h-4 w-4 shrink-0 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          <div className="min-w-0 flex-1 space-y-2">
            <div
              className="h-3.5 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse"
              style={{ width: `${String(30 + ((index * 11) % 30))}%` }}
            />
            <div
              className="h-2.5 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse"
              style={{ width: `${String(18 + ((index * 7) % 14))}%` }}
            />
          </div>
          <div className="hidden h-3 w-40 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse lg:block" />
          <div className="hidden h-3 w-20 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse md:block" />
          <div className="h-5 w-16 rounded-md bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          <div className="h-7 w-14 rounded-lg bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/** No tags at all in this academy. */
export function TagsEmptyState({ createHref }: { createHref: string }) {
  return (
    <div className={tagEmptyPanelClassName}>
      <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] text-[var(--admin-primary)]">
        <Tags className="h-7 w-7" aria-hidden="true" />
      </span>
      <h3 className="text-lg font-bold text-[var(--admin-on-surface)]">No tags yet</h3>
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
        Tags are created here, or from a course or lesson editor. Whichever way one is created, it
        is the same shared record and appears in this list.
      </p>
      <Link href={createHref} className={`${manageSecondaryButtonClassName} mt-6`}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        New tag
      </Link>
    </div>
  );
}

/** Tags exist, but none survive the current search and visibility filter. */
export function TagsNoMatchState({
  query,
  matched,
  total,
  onClearFilters,
}: {
  query: string;
  matched: number;
  total: number;
  onClearFilters: () => void;
}) {
  return (
    <div className={tagEmptyPanelClassName}>
      <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]">
        <SearchX className="h-7 w-7" aria-hidden="true" />
      </span>
      <h3 className="text-lg font-bold text-[var(--admin-on-surface)]">
        {query.trim() ? `No tags match “${query.trim()}”` : "No tags match these filters"}
      </h3>
      <p className="font-data mt-3 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-3 py-1 text-xs tabular-nums text-[var(--admin-on-surface-variant)]">
        {String(matched)} of {String(total)} tags
      </p>
      <button
        type="button"
        onClick={onClearFilters}
        className={`${manageSecondaryButtonClassName} mt-6`}
      >
        <X className="h-4 w-4" aria-hidden="true" />
        Clear filters
      </button>
    </div>
  );
}

export function TagsErrorState({
  message,
  onRetry,
  retrying,
}: {
  message: string;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <div className="space-y-4">
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-4 py-3"
      >
        <span className="text-sm font-semibold text-[var(--admin-danger)]">{message}</span>
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className={manageSecondaryButtonClassName}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          {retrying ? "Retrying…" : "Retry"}
        </button>
      </div>
      <div className={`${tagEmptyPanelClassName} opacity-70`}>
        <CloudOff
          className="mb-4 h-10 w-10 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
        <p className="max-w-md text-sm text-[var(--admin-on-surface-variant)]">
          The tag list could not be retrieved, so nothing below is current. Retry, and contact
          support if it keeps failing.
        </p>
      </div>
    </div>
  );
}
