"use client";

import Link from "next/link";
import { CloudOff, Plus, ReceiptText, RotateCcw, SearchX, X } from "lucide-react";
import { manageSecondaryButtonClassName } from "../manage/manage-ui-shared";
import { ordersEmptyPanelClassName, ordersTableShellClassName } from "./payment-orders-shared";

/**
 * The three non-happy states of the ledger.
 *
 * "No orders have ever been recorded" and "nothing matches these filters" are
 * the same empty table and need opposite recovery actions — on a payments
 * screen, confusing the two tells an operator their ledger is empty when it is
 * merely filtered.
 */

export function PaymentOrdersSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className={ordersTableShellClassName} aria-hidden="true">
      <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)]/60 px-4 py-3">
        <div className="h-3 w-40 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b border-[var(--admin-border)] px-4 py-3"
        >
          <div className="h-4 w-4 shrink-0 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          <div
            className="h-3.5 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse"
            style={{ width: `${String(14 + ((index * 5) % 8))}%` }}
          />
          <div
            className="hidden h-3.5 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse md:block"
            style={{ width: `${String(16 + ((index * 7) % 10))}%` }}
          />
          <div className="h-5 w-16 rounded-md bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          <div className="ml-auto h-3.5 w-24 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          <div className="hidden h-3.5 w-28 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse lg:block" />
        </div>
      ))}
    </div>
  );
}

/** Nothing has ever been recorded in this ledger. */
export function PaymentOrdersEmptyState({
  createHref,
  canRecord,
}: {
  createHref: string;
  canRecord: boolean;
}) {
  return (
    <div className={ordersEmptyPanelClassName}>
      <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] text-[var(--admin-primary)]">
        <ReceiptText className="h-7 w-7" aria-hidden="true" />
      </span>
      <h3 className="text-lg font-bold text-[var(--admin-on-surface)]">No payment orders yet</h3>
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
        Orders appear when a learner checks out, or when one is recorded here for a payment taken
        outside the platform.
      </p>
      {/* An empty ledger plus no permission is not an invitation to act. */}
      {canRecord ? (
        <Link href={createHref} className={`${manageSecondaryButtonClassName} mt-6`}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Record a manual order
        </Link>
      ) : null}
    </div>
  );
}

/** Orders exist; none survive the current filters. */
export function PaymentOrdersNoMatchState({
  onClearFilters,
  query,
}: {
  onClearFilters: () => void;
  query: string;
}) {
  return (
    <div className={ordersEmptyPanelClassName}>
      <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]">
        <SearchX className="h-7 w-7" aria-hidden="true" />
      </span>
      <h3 className="text-lg font-bold text-[var(--admin-on-surface)]">
        {query.trim() ? `No orders match “${query.trim()}”` : "No orders match these filters"}
      </h3>
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
        The ledger is not empty — these filters simply exclude everything in it.
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

export function PaymentOrdersErrorState({
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
      <div className={`${ordersEmptyPanelClassName} opacity-70`}>
        <CloudOff
          className="mb-4 h-10 w-10 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
        {/* On a ledger this matters more than elsewhere: a stale table read as
            current is how an operator concludes a payment never arrived. */}
        <p className="max-w-md text-sm text-[var(--admin-on-surface-variant)]">
          The ledger could not be retrieved, so nothing below is current. Retry before drawing any
          conclusion about a payment.
        </p>
      </div>
    </div>
  );
}
