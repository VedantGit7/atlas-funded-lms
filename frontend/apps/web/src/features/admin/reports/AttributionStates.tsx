"use client";

import Link from "next/link";
import { CloudOff, FilterX, RotateCcw, Signpost, TrendingUp } from "lucide-react";
import { manageSecondaryButtonClassName } from "../manage/manage-ui-shared";
import { attributionTableShellClassName } from "./attribution-shared";

/**
 * The non-happy states of the attribution log.
 *
 * "Nothing has ever been tracked" and "nothing matches these filters" are the
 * same empty table and need opposite recovery actions — telling an operator
 * their tracking is dead when it is merely filtered is how a working
 * integration gets torn out and rebuilt.
 */

const emptyPanelClassName =
  "admin-glass flex flex-col items-center rounded-xl border border-dashed border-[var(--admin-outline)] px-6 py-16 text-center motion-safe:animate-[admin-fade-in_0.2s_ease-out]";

export function AttributionSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className={attributionTableShellClassName} aria-hidden="true">
      <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-3">
        <div className="h-3 w-40 rounded bg-[var(--admin-surface)] motion-safe:animate-pulse" />
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b border-[var(--admin-border)] px-4 py-3"
        >
          <div
            className="h-3.5 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse"
            style={{ width: `${String(15 + ((index * 5) % 8))}%` }}
          />
          <div className="h-5 w-20 rounded-md bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          <div
            className="hidden h-3.5 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse md:block"
            style={{ width: `${String(14 + ((index * 7) % 10))}%` }}
          />
          <div className="hidden h-3.5 w-28 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse lg:block" />
          <div className="ml-auto h-3.5 w-20 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/** Nothing has ever been tracked. */
export function AttributionEmptyState({ insightHref }: { insightHref: string }) {
  return (
    <div className={emptyPanelClassName}>
      <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] text-[var(--admin-primary)]">
        <Signpost className="h-7 w-7" aria-hidden="true" />
      </span>
      <h3 className="text-lg font-bold text-[var(--admin-on-surface)]">
        No attribution events yet
      </h3>
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
        Events are recorded when the marketing integrations or the sales beacon post them. Until one
        does, there is nothing here to read — this log cannot be written to by hand.
      </p>
      <Link href={insightHref} className={`${manageSecondaryButtonClassName} mt-6`}>
        <TrendingUp className="h-4 w-4" aria-hidden="true" />
        Open Marketing Insight
      </Link>
    </div>
  );
}

/** Events exist; none survive the current filters. */
export function AttributionNoMatchState({ onClearFilters }: { onClearFilters: () => void }) {
  return (
    <div className={emptyPanelClassName}>
      <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]">
        <FilterX className="h-7 w-7" aria-hidden="true" />
      </span>
      <h3 className="text-lg font-bold text-[var(--admin-on-surface)]">
        No events match these filters
      </h3>
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
        The log is not empty — these filters simply exclude everything in it.
      </p>
      <button
        type="button"
        onClick={onClearFilters}
        className={`${manageSecondaryButtonClassName} mt-6`}
      >
        <FilterX className="h-4 w-4" aria-hidden="true" />
        Clear filters
      </button>
    </div>
  );
}

export function AttributionErrorState({
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
      <div className={`${emptyPanelClassName} opacity-70`}>
        <CloudOff
          className="mb-4 h-10 w-10 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
        {/* An empty table read as "no events" is how a reporting outage gets
            mistaken for a marketing one. */}
        <p className="max-w-md text-sm text-[var(--admin-on-surface-variant)]">
          The log could not be retrieved, so nothing below is current. This says nothing about
          whether tracking is working — retry before drawing any conclusion.
        </p>
      </div>
    </div>
  );
}
