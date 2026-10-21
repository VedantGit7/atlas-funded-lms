"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight, Download, GitCompareArrows, RefreshCw } from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { RenderedAtProvider } from "./viewer-time";
import {
  BatchesLoadingSkeleton,
  type BatchesRosterProps,
  secondaryButtonClassName,
} from "./admin-batches-roster-shared";
import {
  BatchDrillHeader,
  BatchLearnerDetailLevel,
  BatchLearnersLevel,
  BatchesFilters,
  BatchesSummaryCards,
  BatchesTable,
} from "./admin-batches-roster-sections";
import { useBatchesRoster } from "./use-batches-roster";

/**
 * Relative times on the page count from when the server rendered it until
 * hydration ends (see viewer-time), so both renders read the same.
 */
export function AdminBatchesRosterPage(props: BatchesRosterProps = {}) {
  return (
    <RenderedAtProvider renderedAt={props.initialRoster?.loadedAt ?? null}>
      <BatchesRoster {...props} />
    </RenderedAtProvider>
  );
}

function BatchesRoster(props: BatchesRosterProps) {
  const view = useBatchesRoster(props);
  const {
    applySavedView,
    batches,
    busy,
    error,
    handleExport,
    level,
    loadBatches,
    loading,
    moduleTab,
    router,
    savedView,
    selectedIds,
    selectedLearnerCount,
    setModuleTab,
    setSelectedIds,
    viewer,
  } = view;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
      {level === "batches" ? (
        <>
          <nav
            className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]"
            aria-label="Breadcrumb"
          >
            <Link href="/admin" className="hover:text-[var(--admin-primary)]">
              Admin
            </Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <Link href="/admin/reports" className="hover:text-[var(--admin-primary)]">
              Reports
            </Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="font-medium text-[var(--admin-on-surface)]">Batches</span>
          </nav>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
                Batches
              </h1>
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                Cohort-level completion, live attendance, and test performance across every batch.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={secondaryButtonClassName}
                disabled={selectedIds.length < 2}
                title={
                  selectedIds.length < 2
                    ? "Select at least two batches to compare"
                    : "Compare selected batches"
                }
                onClick={() => {
                  const ids = selectedIds.slice(0, 4).join(",");
                  router.push(`/admin/reports/batches/compare?ids=${ids}`);
                }}
              >
                <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
                Compare batches
              </button>
              <button
                type="button"
                className={secondaryButtonClassName}
                disabled={busy}
                onClick={() => void handleExport()}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Export
              </button>
              <Link href="/admin/batches" className={primaryButtonClassName}>
                Manage batches
              </Link>
            </div>
          </div>

          <div className="border-b border-[var(--admin-border)]">
            <div className="flex gap-1" role="tablist" aria-label="Batches module">
              {(
                [
                  ["batches", "Batches"],
                  ["compare", "Compare"],
                  ["exports", "Exports"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={moduleTab === value}
                  className={[
                    "h-10 px-4 text-xs font-semibold uppercase tracking-[0.06em] transition-colors",
                    moduleTab === value
                      ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
                      : "border-b-2 border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]",
                  ].join(" ")}
                  onClick={() => {
                    if (value === "compare") {
                      if (selectedIds.length >= 2) {
                        router.push(
                          `/admin/reports/batches/compare?ids=${selectedIds.slice(0, 4).join(",")}`,
                        );
                        return;
                      }
                      router.push("/admin/reports/batches/compare");
                      return;
                    }
                    if (value === "exports") {
                      router.push("/admin/reports/batches/exports");
                      return;
                    }
                    setModuleTab("batches");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {moduleTab === "compare" ? (
            <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
              <GitCompareArrows
                className="mx-auto mb-4 h-10 w-10 text-[var(--admin-outline)]"
                aria-hidden="true"
                strokeWidth={1.5}
              />
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                Compare selected cohorts
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
                Select two to four batches, then open the comparison matrix to line up completion,
                attendance, and test scores side by side.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  className={primaryButtonClassName}
                  disabled={selectedIds.length < 2}
                  onClick={() => {
                    const ids = selectedIds.slice(0, 4).join(",");
                    router.push(`/admin/reports/batches/compare?ids=${ids}`);
                  }}
                >
                  Open comparison
                </button>
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  onClick={() => {
                    router.push("/admin/reports/batches/compare");
                  }}
                >
                  Open empty compare
                </button>
                <button
                  type="button"
                  className={ghostButtonClassName}
                  onClick={() => {
                    setModuleTab("batches");
                  }}
                >
                  Back to batches
                </button>
              </div>
            </div>
          ) : null}

          {moduleTab === "exports" ? (
            <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
              <Download
                className="mx-auto mb-4 h-10 w-10 text-[var(--admin-outline)]"
                aria-hidden="true"
                strokeWidth={1.5}
              />
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                Batch exports
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
                Open the exports workspace for history, schedules, and new export configuration.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  className={primaryButtonClassName}
                  onClick={() => {
                    router.push("/admin/reports/batches/exports");
                  }}
                >
                  Open exports
                </button>
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  disabled={busy}
                  onClick={() => void handleExport()}
                >
                  {busy ? "Queuing…" : "Quick CSV export"}
                </button>
                <button
                  type="button"
                  className={ghostButtonClassName}
                  onClick={() => {
                    setModuleTab("batches");
                  }}
                >
                  Back to batches
                </button>
              </div>
            </div>
          ) : null}

          {moduleTab === "batches" ? (
            <>
              {error ? (
                <div
                  className="flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-4 sm:flex-row sm:items-center sm:justify-between"
                  role="alert"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-sm font-medium text-[var(--admin-danger)]">
                        Couldn&apos;t load batches.
                      </p>
                      <p className="mt-0.5 text-xs text-[color-mix(in_srgb,var(--admin-danger)_70%,var(--admin-on-surface))]">
                        {error}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--admin-danger)] px-4 text-xs font-semibold text-[var(--admin-on-danger)] transition-all hover:opacity-90 active:translate-y-px"
                    onClick={() => void loadBatches()}
                  >
                    <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                    Retry
                  </button>
                </div>
              ) : null}

              {loading && batches.length === 0 && !error ? (
                <BatchesLoadingSkeleton />
              ) : (
                <>
                  <BatchesSummaryCards view={view} />

                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["active", "Active batches"],
                        ["at_risk", "At risk"],
                        ["ending_soon", "Ending soon"],
                        ["archived", "Archived"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={[
                          "h-8 rounded-lg px-3 text-xs font-semibold transition-colors",
                          savedView === value
                            ? "bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]"
                            : "bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]",
                        ].join(" ")}
                        onClick={() => {
                          applySavedView(value);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <BatchesFilters view={view} />

                  {selectedIds.length > 0 ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-primary)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] px-4 py-3">
                      <p className="text-sm text-[var(--admin-on-surface)]">
                        <span className="font-mono font-medium">{selectedIds.length}</span> batches
                        selected ·{" "}
                        <span className="font-mono font-medium">
                          {selectedLearnerCount.toLocaleString(viewer.locale)}
                        </span>{" "}
                        learners
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={secondaryButtonClassName}
                          disabled={selectedIds.length < 2}
                          onClick={() => {
                            const ids = selectedIds.slice(0, 4).join(",");
                            router.push(`/admin/reports/batches/compare?ids=${ids}`);
                          }}
                        >
                          Compare
                        </button>
                        <button
                          type="button"
                          className={secondaryButtonClassName}
                          disabled={busy || selectedIds.length !== 1}
                          onClick={() => void handleExport(selectedIds[0])}
                        >
                          Export selection
                        </button>
                        <button
                          type="button"
                          className={ghostButtonClassName}
                          onClick={() => {
                            setSelectedIds([]);
                          }}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <BatchesTable view={view} />
                </>
              )}
            </>
          ) : null}
        </>
      ) : null}

      <BatchDrillHeader view={view} />

      <BatchLearnersLevel view={view} />

      <BatchLearnerDetailLevel view={view} />
    </div>
  );
}
