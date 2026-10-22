"use client";

import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight, FileText, Plus, RefreshCw } from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { AdminCustomFieldLearnerDrawer } from "./AdminCustomFieldLearnerDrawer";
import { CustomFieldReportTabs } from "./CustomFieldReportTabs";
import { RenderedAtProvider } from "./viewer-time";
import {
  type CustomFieldRosterProps,
  PAGE_SIZE_OPTIONS,
  RosterSkeleton,
  SummaryBand,
  formatCount,
  selectClassName,
} from "./admin-custom-field-roster-shared";
import {
  CustomFieldRosterActions,
  CustomFieldRosterFilters,
  CustomFieldRosterHeader,
  CustomFieldRosterTable,
} from "./admin-custom-field-roster-sections";
import { useCustomFieldRoster } from "./use-custom-field-roster";

/**
 * Relative times on the page count from when the server rendered it until
 * hydration ends (see viewer-time), so both renders read the same.
 */
export function AdminCustomFieldRosterPage(props: CustomFieldRosterProps = {}) {
  return (
    <RenderedAtProvider renderedAt={props.initialRoster?.loadedAt ?? null}>
      <CustomFieldRoster {...props} />
    </RenderedAtProvider>
  );
}

function CustomFieldRoster(props: CustomFieldRosterProps) {
  const view = useCustomFieldRoster(props);
  const {
    error,
    hasActiveFilters,
    items,
    load,
    loading,
    page,
    pageSize,
    selectedIds,
    selectedMembershipId,
    setActionsOpen,
    setPage,
    setPageSize,
    setSelectedIds,
    setSelectedMembershipId,
    showingFrom,
    showingTo,
    summary,
    totalCount,
    totalPages,
    viewer,
  } = view;

  if (loading && !summary && items.length === 0 && !error) {
    return (
      <div className="space-y-6">
        <CustomFieldReportTabs active="learners" />
        <RosterSkeleton />
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="space-y-6">
        <CustomFieldReportTabs active="learners" />
        <div className="flex items-center justify-between gap-4 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--admin-danger)]" aria-hidden />
            <p className="text-sm font-medium text-[var(--admin-danger)]">
              Couldn&apos;t load the learner roster.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-8 items-center gap-2 rounded-sm bg-[var(--admin-danger)] px-4 font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--admin-on-danger)] transition-transform active:translate-y-px"
            onClick={() => void load()}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Retry
          </button>
        </div>
        <div className="pointer-events-none opacity-40">
          <RosterSkeleton />
        </div>
      </div>
    );
  }

  const noFieldsDefined = summary != null && summary.customFieldCount === 0 && !hasActiveFilters;

  return (
    <div className="flex flex-col gap-6">
      <CustomFieldReportTabs active="learners" />

      <CustomFieldRosterHeader view={view} />

      {error ? (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3">
          <p className="text-sm font-medium text-[var(--admin-danger)]">{error}</p>
          <button type="button" className={ghostButtonClassName} onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Retry
          </button>
        </div>
      ) : null}

      {summary ? <SummaryBand summary={summary} /> : null}

      <CustomFieldRosterActions view={view} />

      {noFieldsDefined ? (
        <div className="flex min-h-[400px] flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="flex h-11 items-center border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4">
            <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
              Field definitions
            </span>
          </div>
          <div className="relative flex flex-1 flex-col items-center justify-center p-12">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] shadow-sm">
              <FileText
                className="h-8 w-8 text-[var(--admin-on-surface-variant)]"
                strokeWidth={1.5}
              />
            </div>
            <h2 className="mb-2 text-center text-lg font-semibold text-[var(--admin-on-surface)]">
              No custom fields are defined yet
            </h2>
            <p className="mb-8 max-w-[420px] text-center text-sm text-[var(--admin-on-surface-variant)]">
              Define attributes like trading experience or preferred market to slice your learners
              by them.
            </p>
            <Link href="/admin/custom-fields" className={primaryButtonClassName}>
              <Plus className="h-4 w-4" aria-hidden />
              Manage fields
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex min-h-[500px] flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_1px_2px_color-mix(in_srgb,var(--admin-on-surface)_4%,transparent)]">
          <div className="flex items-center border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4">
            <button
              type="button"
              className="flex h-12 items-center border-b-2 border-[var(--admin-primary)] px-4 text-[13px] font-semibold text-[var(--admin-primary)]"
            >
              All learners
            </button>
          </div>

          <CustomFieldRosterFilters view={view} />

          {selectedIds.size > 0 ? (
            <div className="flex h-10 items-center justify-between border-b border-[color-mix(in_srgb,var(--admin-primary)_20%,var(--admin-border))] bg-[var(--admin-primary-container)] px-4">
              <span className="flex items-center gap-2 text-[13px] font-medium text-[var(--admin-primary)]">
                {formatCount(selectedIds.size, viewer)} learners selected
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="text-[13px] text-[var(--admin-primary)] hover:underline"
                  onClick={() => {
                    setActionsOpen(true);
                  }}
                >
                  Cohort actions
                </button>
                <button
                  type="button"
                  className="text-[13px] text-[var(--admin-primary)] hover:underline"
                  onClick={() => {
                    setSelectedIds(new Set());
                  }}
                >
                  Clear selection
                </button>
              </div>
            </div>
          ) : null}

          <CustomFieldRosterTable view={view} />

          <div className="flex h-12 items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-4">
            <span className="text-[12px] text-[var(--admin-on-surface-variant)]">
              {totalCount === 0
                ? "No learners"
                : `Showing ${formatCount(showingFrom, viewer)}–${formatCount(showingTo, viewer)} of ${formatCount(totalCount, viewer)} learners`}
            </span>
            <div className="flex items-center gap-2">
              <Select
                className={selectClassName}
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setPage(1);
                }}
                options={PAGE_SIZE_OPTIONS}
              />
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-sm text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-low)] disabled:opacity-50"
                disabled={page <= 1 || loading}
                onClick={() => {
                  setPage((current) => Math.max(1, current - 1));
                }}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-sm text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)] disabled:opacity-50"
                disabled={page >= totalPages || loading || totalPages === 0}
                onClick={() => {
                  setPage((current) => current + 1);
                }}
                aria-label="Next page"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-[12px] text-[var(--admin-on-surface-variant)]">
        Custom-field columns come from your tenant&apos;s active field definitions.
      </p>

      <AdminCustomFieldLearnerDrawer
        membershipId={selectedMembershipId}
        onClose={() => {
          setSelectedMembershipId(null);
        }}
      />
    </div>
  );
}
