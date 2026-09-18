"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  FileStack,
  Layers,
  ListChecks,
  Package,
  Pencil,
  UserPlus,
  Users,
} from "lucide-react";
import {
  catalogueSlugChipClassName,
  formatUpdatedAt,
  itemKindLabel,
  statusChipClassName,
  statusLabel,
} from "./learner-products-shared";
import type { ProductEnrollmentListItem, ProductItem } from "./learner-products-api";

/**
 * The read panels of a product detail screen.
 *
 * Split from the orchestrator so each panel can state its own empty case: a
 * product with no description, a mock test that has no contents list by
 * definition, and a product nobody is enrolled in are three different kinds of
 * "nothing here" and reading them as one is how a screen starts lying.
 */

export const detailPanelClassName =
  "admin-glass rounded-xl border border-[var(--admin-border)] p-6";

export const detailPanelHeadingClassName =
  "text-base font-bold text-[var(--admin-on-surface)] flex items-center gap-2";

const ITEM_KIND_ICON: Record<string, typeof Layers> = {
  course: FileStack,
  mock_test: ListChecks,
  test_series: Layers,
  bundle: Package,
};

export function DetailSummaryBand({
  contentsLabel,
  contentsHint,
  status,
  createdAt,
  updatedAt,
  productId,
}: {
  contentsLabel: string;
  contentsHint: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  productId: string;
}) {
  return (
    <div className="admin-glass grid gap-6 rounded-xl border border-[var(--admin-border)] p-6 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
          Contents
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--admin-primary)]">
          {contentsLabel}
        </p>
        <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">{contentsHint}</p>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
          Status
        </p>
        <p className="mt-2">
          <span className={statusChipClassName(status)}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {statusLabel(status)}
          </span>
        </p>
        <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
          {status.toUpperCase() === "PUBLISHED"
            ? "Offered to learners."
            : status.toUpperCase() === "ARCHIVED"
              ? "Not offered to learners."
              : "Not offered yet — admins can still enrol."}
        </p>
      </div>

      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-[var(--admin-on-surface-variant)]">Created</span>
          <span className="font-data text-xs text-[var(--admin-on-surface)]">
            {formatUpdatedAt(createdAt)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-[var(--admin-on-surface-variant)]">Updated</span>
          <span className="font-data text-xs text-[var(--admin-on-surface)]">
            {formatUpdatedAt(updatedAt)}
          </span>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
          Product ID
        </p>
        <p className={`${catalogueSlugChipClassName} mt-2 break-all`}>{productId}</p>
      </div>
    </div>
  );
}

export function DescriptionPanel({ description }: { description: string | null }) {
  return (
    <section className={detailPanelClassName}>
      <h2 className={detailPanelHeadingClassName}>
        <ClipboardList className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
        Description
      </h2>
      {description?.trim() ? (
        <p className="mt-4 text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
          {description}
        </p>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-[var(--admin-outline)] px-4 py-8 text-center text-sm text-[var(--admin-on-surface-variant)]">
          No description set for this product.
        </p>
      )}
    </section>
  );
}

export function ContentsPanel({
  items,
  emptyMessage,
}: {
  items: ProductItem[];
  emptyMessage: string;
}) {
  const unresolved = items.filter((item) => item.title === null).length;

  return (
    <section className="admin-glass overflow-hidden rounded-xl border border-[var(--admin-border)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--admin-border)] px-6 py-4">
        <h2 className={detailPanelHeadingClassName}>
          <Layers className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
          Contents
        </h2>
        <span className="text-xs text-[var(--admin-on-surface-variant)]">
          {items.length} {items.length === 1 ? "item" : "items"} · in learner order
        </span>
      </div>

      {items.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]">
          {emptyMessage}
        </p>
      ) : (
        <ol>
          {items.map((item, index) => {
            const kind = item.itemKind ?? "mock_test";
            const Icon = ITEM_KIND_ICON[kind] ?? Layers;
            const missing = item.title === null;

            return (
              <li
                key={item.id}
                className={[
                  "flex items-center gap-4 border-t border-[var(--admin-border)] px-6 py-4 first:border-t-0",
                  missing
                    ? "bg-[color-mix(in_srgb,var(--admin-danger)_7%,transparent)]"
                    : "motion-safe:transition-colors hover:bg-[color-mix(in_srgb,var(--admin-surface-high)_50%,transparent)]",
                ].join(" ")}
              >
                <span className="font-data w-6 shrink-0 text-right text-xs text-[var(--admin-on-surface-variant)]">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span
                  className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    missing
                      ? "bg-[color-mix(in_srgb,var(--admin-danger)_14%,var(--admin-surface))] text-[var(--admin-danger)]"
                      : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
                  ].join(" ")}
                >
                  {missing ? (
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                    {itemKindLabel(kind)}
                  </span>
                  {missing ? (
                    <span className="block text-sm font-medium text-[var(--admin-danger)]">
                      Referenced product no longer exists
                    </span>
                  ) : (
                    <span className="block truncate text-sm font-medium text-[var(--admin-on-surface)]">
                      {item.title}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {unresolved > 0 ? (
        <p
          role="alert"
          className="flex items-center gap-2 border-t border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,transparent)] px-6 py-3 text-xs font-medium text-[var(--admin-danger)]"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {unresolved} {unresolved === 1 ? "item points" : "items point"} at a product that has been
          deleted. Learners enrolled here will not receive {unresolved === 1 ? "it" : "them"}.
        </p>
      ) : null}
    </section>
  );
}

export function LinkedAssessmentPanel({
  assessmentId,
  onChange,
}: {
  assessmentId: string;
  /** Absent when the product is archived — nothing about it should be editable. */
  onChange?: (() => void) | undefined;
}) {
  return (
    <section className={detailPanelClassName}>
      <div className="flex items-center justify-between gap-3">
        <h2 className={detailPanelHeadingClassName}>
          <ListChecks className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
          Linked assessment
        </h2>
        {onChange ? (
          <button
            type="button"
            onClick={onChange}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--admin-primary)] transition-colors hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Change
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
        A mock test wraps exactly one assessment, which supplies its questions and marking.
      </p>
      <Link
        href={`/admin/assessments/${assessmentId}`}
        className="mt-4 flex items-center gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 transition-colors hover:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]">
          <ListChecks className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
            Assessment
          </span>
          <span className="font-data block truncate text-sm text-[var(--admin-on-surface)]">
            {assessmentId}
          </span>
        </span>
      </Link>
    </section>
  );
}

export function EnrolmentsPanel({
  enrollments,
  totalCount,
  loading,
  error,
  canEnrol,
  onEnrol,
  rosterHref,
}: {
  enrollments: ProductEnrollmentListItem[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  canEnrol: boolean;
  onEnrol: () => void;
  rosterHref: string;
}) {
  return (
    <section className={detailPanelClassName}>
      <div className="flex items-center justify-between gap-3">
        <h2 className={detailPanelHeadingClassName}>
          <Users className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
          Enrolments
        </h2>
        <span className="text-2xl font-bold tabular-nums text-[var(--admin-on-surface)]">
          {loading ? "—" : totalCount}
        </span>
      </div>

      {canEnrol ? (
        <button
          type="button"
          onClick={onEnrol}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 py-2.5 text-sm font-bold text-[var(--admin-on-primary)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/50 motion-safe:active:scale-[0.99]"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Enrol a learner
        </button>
      ) : (
        <p className="mt-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2.5 text-xs text-[var(--admin-on-surface-variant)]">
          Enrolment is closed while this product is archived.
        </p>
      )}

      {error ? (
        <p role="alert" className="mt-4 text-xs font-medium text-[var(--admin-danger)]">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-4 space-y-2" aria-hidden="true">
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="h-10 rounded-lg bg-[var(--admin-surface-high)] motion-safe:animate-pulse"
            />
          ))}
        </div>
      ) : enrollments.length === 0 ? (
        <p className="mt-4 text-xs text-[var(--admin-on-surface-variant)]">
          Nobody is enrolled in this product yet.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--admin-border)]">
          {enrollments.map((enrollment) => (
            <li key={enrollment.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-[var(--admin-on-surface)]">
                  {enrollment.displayName ?? enrollment.email ?? enrollment.membershipId}
                </span>
                <span className="block truncate text-xs text-[var(--admin-on-surface-variant)]">
                  {enrollment.enrolledType} · {formatUpdatedAt(enrollment.enrolledAt)}
                  {enrollment.expiresAt
                    ? ` · expires ${formatUpdatedAt(enrollment.expiresAt)}`
                    : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {!loading && totalCount > enrollments.length ? (
        <p className="mt-3 text-xs text-[var(--admin-on-surface-variant)]">
          Showing the {enrollments.length} most recent of {totalCount}.
        </p>
      ) : null}

      <Link
        href={rosterHref}
        className="mt-4 flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2.5 text-sm font-medium text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40"
      >
        Manage all enrolments
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
