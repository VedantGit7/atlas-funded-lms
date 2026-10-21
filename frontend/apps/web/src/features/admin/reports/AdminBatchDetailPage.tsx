"use client";

import Link from "next/link";
import { AlertTriangle, Calendar, ChevronRight, Download, Mail, RefreshCw } from "lucide-react";
import { ghostButtonClassName } from "../../analytics/analytics-admin-shared";
import { RenderedAtProvider } from "./viewer-time";
import {
  type BatchDetailPageProps,
  DETAIL_TABS,
  DetailLoadingSkeleton,
  secondaryButtonClassName,
} from "./admin-batch-detail-shared";
import {
  BatchDetailHeader,
  BatchLearnerFilters,
  BatchLearnerTable,
  BatchMessageModal,
  BatchOverviewTab,
} from "./admin-batch-detail-sections";
import { useBatchDetailReport } from "./use-batch-detail-report";

/**
 * Relative times on the page count from when the server rendered it until
 * hydration ends (see viewer-time), so both renders read the same.
 */
export function AdminBatchDetailPage(props: BatchDetailPageProps) {
  return (
    <RenderedAtProvider renderedAt={props.initialDetail?.loadedAt ?? null}>
      <BatchDetailReport {...props} />
    </RenderedAtProvider>
  );
}

function BatchDetailReport(props: BatchDetailPageProps) {
  const view = useBatchDetailReport(props);
  const {
    actionError,
    activeTab,
    batchId,
    busy,
    detail,
    detailError,
    detailLoading,
    formatDate,
    handleExport,
    learnersError,
    loadDetail,
    loadLearners,
    openMessageModal,
    selectedIds,
    setActionError,
    setSelectedIds,
    setTab,
  } = view;

  if (detailLoading && !detail) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
        <DetailLoadingSkeleton />
      </div>
    );
  }

  if (detailError && !detail) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
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
                Couldn&apos;t load this batch report.
              </p>
              <p className="mt-0.5 text-xs text-[color-mix(in_srgb,var(--admin-danger)_70%,var(--admin-on-surface))]">
                {detailError}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--admin-danger)] px-4 text-xs font-semibold text-[var(--admin-on-danger)] transition-all hover:opacity-90 active:translate-y-px"
            onClick={() => void loadDetail()}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
        <div className="opacity-40">
          <DetailLoadingSkeleton />
        </div>
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
      <nav
        className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]"
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
        <Link href="/admin/reports/batches" className="hover:text-[var(--admin-primary)]">
          Batches
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium text-[var(--admin-on-surface)]">{detail.name}</span>
      </nav>

      <BatchDetailHeader view={{ ...view, detail }} />

      <div className="border-b border-[var(--admin-border)]">
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Batch report tabs">
          {DETAIL_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={[
                "h-10 shrink-0 px-4 text-xs font-semibold uppercase tracking-[0.06em] transition-colors",
                activeTab === tab.key
                  ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
                  : "border-b-2 border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]",
              ].join(" ")}
              onClick={() => {
                setTab(tab.key);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--admin-on-surface-variant)]">
        <span>
          Course:{" "}
          {detail.courseTitle ? (
            <Link
              href="/admin/courses"
              className="font-medium text-[var(--admin-primary)] hover:underline"
            >
              {detail.courseTitle}
            </Link>
          ) : (
            <span>No linked course</span>
          )}
        </span>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1 font-mono text-xs">
          <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
          Window {formatDate(detail.startsAt)} to {formatDate(detail.endsAt)}
        </span>
        <span aria-hidden="true">·</span>
        <span className="font-mono text-xs">Created {formatDate(detail.createdAt)}</span>
      </p>

      {actionError ? (
        <div
          className="flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-4 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
            <p className="text-sm text-[var(--admin-danger)]">{actionError}</p>
          </div>
          <button
            type="button"
            className={ghostButtonClassName}
            onClick={() => {
              setActionError(null);
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <BatchOverviewTab view={{ ...view, detail }} />

      {activeTab === "learners" ? (
        <div className="min-w-0 space-y-4">
          {learnersError ? (
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
                    Couldn&apos;t load learners.
                  </p>
                  <p className="mt-0.5 text-xs text-[color-mix(in_srgb,var(--admin-danger)_70%,var(--admin-on-surface))]">
                    {learnersError}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--admin-danger)] px-4 text-xs font-semibold text-[var(--admin-on-danger)]"
                onClick={() => void loadLearners()}
              >
                <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                Retry
              </button>
            </div>
          ) : null}

          <BatchLearnerFilters view={view} />

          {selectedIds.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-primary)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] px-4 py-3">
              <p className="text-sm text-[var(--admin-on-surface)]">
                <span className="font-mono font-medium">{selectedIds.length}</span> learners
                selected
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  onClick={() => {
                    openMessageModal(selectedIds);
                  }}
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  Message
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

          <BatchLearnerTable view={view} />
        </div>
      ) : null}

      {activeTab === "live_sessions" ? (
        <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Opening live sessions report…
          </p>
          <Link
            href={`/admin/reports/batches/${batchId}/live-sessions`}
            className="mt-3 inline-flex text-sm font-medium text-[var(--admin-primary)] hover:underline"
          >
            Continue to live sessions
          </Link>
        </div>
      ) : null}

      {activeTab === "exams" ? (
        <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Opening exams report…</p>
          <Link
            href={`/admin/reports/batches/${batchId}/exams`}
            className="mt-3 inline-flex text-sm font-medium text-[var(--admin-primary)] hover:underline"
          >
            Continue to exams
          </Link>
        </div>
      ) : null}

      {activeTab === "content" ? (
        <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Opening content completion report…
          </p>
          <Link
            href={`/admin/reports/batches/${batchId}/content`}
            className="mt-3 inline-flex text-sm font-medium text-[var(--admin-primary)] hover:underline"
          >
            Continue to content completion
          </Link>
        </div>
      ) : null}

      {activeTab === "messages" ? (
        <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Opening messages…</p>
          <Link
            href={`/admin/reports/batches/${batchId}/messages`}
            className="mt-3 inline-flex text-sm font-medium text-[var(--admin-primary)] hover:underline"
          >
            Continue to messages
          </Link>
        </div>
      ) : null}

      <BatchMessageModal view={view} />
    </div>
  );
}
