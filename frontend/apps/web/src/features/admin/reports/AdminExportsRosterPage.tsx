"use client";

import Link from "next/link";
import { AlertCircle, ArrowDown, Download, Inbox, X } from "lucide-react";
import { dropdownPanelEnterBottomClassName } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { RenderedAtProvider } from "./viewer-time";
import { BiExportPanel } from "./BiExportPanel";
import { CustomReportBuilder } from "./CustomReportBuilder";
import { ExportsLoadingSkeleton, type ExportsRosterProps } from "./admin-exports-roster-shared";
import {
  ExportsFilters,
  ExportsHeader,
  ExportsSummaryCards,
  ExportsTable,
} from "./admin-exports-roster-sections";
import { useExportsRoster } from "./use-exports-roster";

/**
 * Relative times on the page count from when the server rendered it until
 * hydration ends (see viewer-time), so both renders read the same.
 */
export function AdminExportsRosterPage(props: ExportsRosterProps = {}) {
  return (
    <RenderedAtProvider renderedAt={props.initialHistory?.loadedAt ?? null}>
      <ExportsRoster {...props} />
    </RenderedAtProvider>
  );
}

function ExportsRoster(props: ExportsRosterProps) {
  const view = useExportsRoster(props);
  const {
    appliedChips,
    builderRef,
    debouncedQ,
    error,
    handleDownloadSelected,
    items,
    loadHistory,
    loading,
    selectedIds,
    selectedWithFiles,
    setSelectedIds,
  } = view;

  return (
    <div className="relative flex flex-col gap-6 pb-24">
      <ExportsHeader view={view} />

      {error ? (
        <div
          className="flex flex-wrap items-center gap-4 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-4"
          role="alert"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-danger)_16%,var(--admin-surface))] text-[var(--admin-danger)]">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-[var(--admin-danger)]">
              Couldn&apos;t load export history.
            </h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">{error}</p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-[var(--admin-danger)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--admin-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] active:translate-y-px"
            onClick={() => void loadHistory()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading && items.length === 0 && !error ? (
        <ExportsLoadingSkeleton />
      ) : !loading && items.length === 0 && !error && appliedChips.length === 0 && !debouncedQ ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {(
              [
                ["Total exports", "0"],
                ["Succeeded", "0"],
                ["Success rate", "-"],
                ["Files available", "0"],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
              >
                <p className="text-[12px] tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
                  {label}
                </p>
                <p className="mt-1 font-mono text-[28px] font-semibold text-[var(--admin-on-surface)]">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <section className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-12 text-center">
            <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--admin-surface-low)]">
              <Inbox
                className="h-9 w-9 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <div className="absolute -right-1 -bottom-1 rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1">
                <ArrowDown className="h-3.5 w-3.5 text-[var(--admin-primary)]" aria-hidden="true" />
              </div>
            </div>
            <h2 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
              No exports in this range
            </h2>
            <p className="mb-8 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
              Exports you run from any report appear here. Try adjusting your filters or run a new
              export to get started.
            </p>
            <Link href="/admin/reports/exports/new" className={primaryButtonClassName}>
              New export
            </Link>
          </section>
        </>
      ) : !error ? (
        <>
          <ExportsSummaryCards view={view} />

          <ExportsFilters view={view} />

          <ExportsTable view={view} />

          <p className="text-[12px] text-[var(--admin-on-surface-variant)]">
            Run records are kept for audit even after their files are removed. All export actions
            are logged with PII masking.
          </p>
        </>
      ) : null}

      {selectedIds.size > 0 ? (
        <div
          className={`fixed bottom-6 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-5 py-3 text-[var(--admin-on-surface)] shadow-xl ${dropdownPanelEnterBottomClassName}`}
        >
          <div className="flex flex-wrap items-center gap-2 border-[var(--admin-border)] pr-0 sm:border-r sm:pr-4">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-[var(--admin-primary-strong)] font-mono text-sm font-bold text-[var(--admin-on-primary)]">
              {selectedIds.size}
            </span>
            <span className="text-sm">exports selected</span>
            <span className="text-[var(--admin-on-surface-variant)]">·</span>
            <span className="text-sm text-[var(--admin-on-surface-variant)]">
              {selectedWithFiles} with files
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-[color-mix(in_srgb,var(--admin-on-surface)_12%,transparent)] px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[color-mix(in_srgb,var(--admin-on-surface)_20%,transparent)] disabled:opacity-50"
              disabled={selectedWithFiles === 0}
              onClick={() => void handleDownloadSelected()}
            >
              <Download className="h-[18px] w-[18px]" aria-hidden="true" />
              Download selected
            </button>
            <button
              type="button"
              className={ghostButtonClassName}
              onClick={() => {
                setSelectedIds(new Set());
              }}
              aria-label="Clear selection"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      <div ref={builderRef} className="scroll-mt-8 space-y-6">
        <CustomReportBuilder onRunStarted={() => void loadHistory()} />
        <BiExportPanel />
      </div>
    </div>
  );
}
