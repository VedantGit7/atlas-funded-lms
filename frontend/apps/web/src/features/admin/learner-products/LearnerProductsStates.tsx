"use client";

import Link from "next/link";
import { CloudOff, PackageOpen, Plus, RotateCcw, SearchX, X } from "lucide-react";
import {
  catalogueEmptyPanelClassName,
  catalogueTableShellClassName,
} from "./learner-products-shared";
import { manageSecondaryButtonClassName } from "../manage/manage-ui-shared";

/**
 * The four non-happy states of the catalogue table.
 *
 * They live together because the difference between them is the thing that
 * matters: "nothing here yet" and "nothing matched your filters" are the same
 * empty table but need opposite recovery actions, and shipping only one of them
 * is the usual way a filtered list becomes a dead end.
 */

export function CatalogueSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className={catalogueTableShellClassName} aria-hidden="true">
      <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)]/60 px-4 py-3">
        <div className="h-3 w-40 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
      </div>
      <div>
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 border-t border-[var(--admin-border)] px-4 py-4"
          >
            <div className="h-4 w-4 shrink-0 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
            <div className="min-w-0 flex-1 space-y-2">
              <div
                className="h-4 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse"
                style={{ width: `${String(45 + ((index * 13) % 35))}%` }}
              />
              <div
                className="h-3 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse"
                style={{ width: `${String(25 + ((index * 7) % 20))}%` }}
              />
            </div>
            <div className="hidden h-6 w-20 rounded-full bg-[var(--admin-surface-high)] motion-safe:animate-pulse sm:block" />
            <div className="hidden h-3 w-20 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse md:block" />
            <div className="h-8 w-8 rounded-lg bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CatalogueEmptyState({
  productLabel,
  onClearFilters,
  filtered,
  query,
  createHref,
  createLabel,
}: {
  productLabel: string;
  filtered: boolean;
  query: string;
  onClearFilters: () => void;
  createHref: string;
  createLabel: string;
}) {
  if (filtered) {
    return (
      <div className={catalogueEmptyPanelClassName}>
        <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]">
          <SearchX className="h-7 w-7" aria-hidden="true" />
        </span>
        <h3 className="text-lg font-bold text-[var(--admin-on-surface)]">No results found</h3>
        <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
          {query.trim()
            ? `No ${productLabel.toLowerCase()} match “${query.trim()}” with the current filters.`
            : `No ${productLabel.toLowerCase()} match the current filters.`}
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

  return (
    <div className={catalogueEmptyPanelClassName}>
      <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] text-[var(--admin-primary)]">
        <PackageOpen className="h-7 w-7" aria-hidden="true" />
      </span>
      <h3 className="text-lg font-bold text-[var(--admin-on-surface)]">
        Nothing in this catalogue yet
      </h3>
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
        {productLabel} created for this school will appear here, ready to enrol learners into.
      </p>
      <Link href={createHref} className={`${manageSecondaryButtonClassName} mt-6`}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        {createLabel}
      </Link>
    </div>
  );
}

export function CatalogueErrorState({
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
      <div className={`${catalogueEmptyPanelClassName} opacity-70`}>
        <CloudOff
          className="mb-4 h-10 w-10 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
        <p className="max-w-md text-sm text-[var(--admin-on-surface-variant)]">
          The catalogue could not be retrieved. Retry, and contact support if it keeps failing.
        </p>
      </div>
    </div>
  );
}
