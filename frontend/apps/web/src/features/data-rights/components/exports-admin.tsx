"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CloudDownload,
  History,
  Loader2,
  Play,
  RefreshCw,
  Shield,
  Workflow,
  XCircle,
} from "lucide-react";
import {
  Button,
  EmptyState,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@atlas/design-system";
import { AdminConfirmDialog } from "../../../components/shells/admin/AdminConfirmDialog";
import {
  exportsAlertErrorClassName,
  exportsContentClassName,
  exportsEmptyStateClassName,
  exportsErrorCodeClassName,
  exportsInfoCardClassName,
  exportsMainClassName,
  exportsPageHeaderClassName,
  exportsPollingDotClassName,
  exportsTableFooterClassName,
  exportsTableHeadClassName,
  exportsTableRowClassName,
  exportsTableRowMutedClassName,
  exportsTableShellClassName,
  exportsTableToolbarClassName,
  exportsWorkspaceClassName,
  ghostButtonClassName,
  primaryButtonClassName,
} from "../exports-admin-shared";
import {
  EXPORT_STATUS_LABELS,
  EXPORTS_PAGE_SIZE,
  canDownloadExport,
  exportStatusBadgeClassName,
  formatExpiresLabel,
  formatRelativeTime,
  formatRequestedBy,
  hasPendingExports,
  paginateJobs,
  resolveExportDisplayStatus,
  totalExportPages,
  type ExportDisplayStatus,
} from "../exports-admin-utils";
import {
  fetchExportJob,
  fetchExportJobs,
  formatApiError,
  requestExport,
  type ExportJobItem,
} from "../api";

export type ExportsAdminProps = {
  initialJobs: ExportJobItem[];
  canRunExport: boolean;
};

function ExportStatusBadge({ status }: { status: ExportDisplayStatus }) {
  const Icon =
    status === "RUNNING"
      ? Loader2
      : status === "SUCCEEDED"
        ? CheckCircle2
        : status === "QUEUED"
          ? Clock
          : status === "FAILED"
            ? AlertCircle
            : status === "CANCELLED"
              ? XCircle
              : History;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${exportStatusBadgeClassName(status)}`}
    >
      <Icon
        className={`h-3.5 w-3.5 ${status === "RUNNING" ? "motion-safe:animate-spin" : ""}`}
        aria-hidden="true"
      />
      {EXPORT_STATUS_LABELS[status]}
    </span>
  );
}

export function ExportsAdmin({ initialJobs, canRunExport }: ExportsAdminProps) {
  const [jobs, setJobs] = useState(initialJobs);
  const [page, setPage] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [pollingLabel, setPollingLabel] = useState("Checking for updates");

  const pending = hasPendingExports(jobs);
  const pageJobs = useMemo(() => paginateJobs(jobs, page), [jobs, page]);
  const pageCount = totalExportPages(jobs.length);

  const refreshJobs = useCallback(async () => {
    const response = await fetchExportJobs();
    setJobs(response.data.items);
    setPage((current) => Math.min(current, totalExportPages(response.data.items.length)));
  }, []);

  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => {
      void refreshJobs().catch(() => undefined);
    }, 4000);
    return () => {
      window.clearInterval(timer);
    };
  }, [pending, refreshJobs]);

  useEffect(() => {
    if (!pending) return;
    const dots = ["", ".", "..", "..."];
    let index = 0;
    const timer = window.setInterval(() => {
      index = (index + 1) % dots.length;
      setPollingLabel(`Checking for updates${dots[index]}`);
    }, 900);
    return () => {
      window.clearInterval(timer);
    };
  }, [pending]);

  async function handleRefresh() {
    setRefreshing(true);
    setMessage(null);
    setRequestId(null);
    try {
      await refreshJobs();
    } catch (error) {
      const formatted = formatApiError(error);
      setMessage(formatted.message);
      setRequestId(formatted.requestId);
    } finally {
      setRefreshing(false);
    }
  }

  async function runExport() {
    setBusy(true);
    setMessage(null);
    setRequestId(null);
    try {
      await requestExport(`export-run-${String(Date.now())}`);
      setConfirmOpen(false);
      setPage(1);
      await refreshJobs();
    } catch (error) {
      const formatted = formatApiError(error);
      setMessage(formatted.message);
      setRequestId(formatted.requestId);
    } finally {
      setBusy(false);
    }
  }

  async function downloadExport(jobId: string) {
    setDownloadingId(jobId);
    setMessage(null);
    setRequestId(null);
    try {
      const response = await fetchExportJob(jobId);
      const download = response.data.download;
      if (!download?.url) {
        setMessage("Download is not available for this export yet.");
        return;
      }
      window.open(download.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      const formatted = formatApiError(error);
      setMessage(formatted.message);
      setRequestId(formatted.requestId);
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className={exportsWorkspaceClassName}>
      <div className={exportsMainClassName}>
        <div className={exportsContentClassName}>
          <div className={exportsPageHeaderClassName}>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
                Data Exports
              </h1>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                Export tenant-safe learning data for compliance review, backup, or external analysis.
              </p>
            </div>
            {canRunExport ? (
              <button
                type="button"
                className={`${primaryButtonClassName} inline-flex items-center gap-2`}
                onClick={() => {
                  setConfirmOpen(true);
                }}
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                Run export
              </button>
            ) : null}
          </div>

          {message ? (
            <p role="alert" className={`${exportsAlertErrorClassName} mb-4`}>
              {message}
              {requestId ? ` Request ID: ${requestId}` : ""}
            </p>
          ) : null}

          <section className={exportsTableShellClassName} aria-labelledby="export-jobs-heading">
            <h2 id="export-jobs-heading" className="sr-only">
              Export jobs
            </h2>

            <div className={exportsTableToolbarClassName}>
              <div className="flex items-center gap-2">
                {pending ? (
                  <>
                    <span className={exportsPollingDotClassName} aria-hidden="true" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                      {pollingLabel}
                    </span>
                  </>
                ) : (
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    {jobs.length} export job{jobs.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <button
                type="button"
                className={`${ghostButtonClassName} inline-flex h-9 w-9 items-center justify-center p-0`}
                onClick={() => void handleRefresh()}
                disabled={refreshing}
                aria-label="Refresh export jobs"
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "motion-safe:animate-spin" : ""}`}
                  aria-hidden="true"
                />
              </button>
            </div>

            {jobs.length === 0 && !refreshing ? (
              <EmptyState
                className={exportsEmptyStateClassName}
                title="No export jobs yet"
                description="Run an export to generate a tenant-safe data package for download."
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table className="min-w-[760px] border-collapse">
                    <TableHead>
                      <TableRow className="border-b border-[var(--admin-border)] hover:bg-transparent">
                        <TableHeaderCell className={`px-4 py-3 sm:px-5 ${exportsTableHeadClassName}`}>
                          Status
                        </TableHeaderCell>
                        <TableHeaderCell className={`px-4 py-3 sm:px-5 ${exportsTableHeadClassName}`}>
                          Requested
                        </TableHeaderCell>
                        <TableHeaderCell className={`px-4 py-3 sm:px-5 ${exportsTableHeadClassName}`}>
                          Requested by
                        </TableHeaderCell>
                        <TableHeaderCell className={`px-4 py-3 sm:px-5 ${exportsTableHeadClassName}`}>
                          Expires
                        </TableHeaderCell>
                        <TableHeaderCell className={`px-4 py-3 sm:px-5 ${exportsTableHeadClassName}`}>
                          Error
                        </TableHeaderCell>
                        <TableHeaderCell
                          className={`px-4 py-3 text-right sm:px-5 ${exportsTableHeadClassName}`}
                        >
                          Actions
                        </TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {refreshing
                        ? Array.from({ length: 3 }).map((_, index) => (
                            <TableRow key={`skeleton-${index}`} className={exportsTableRowClassName}>
                              {Array.from({ length: 6 }).map((__, cellIndex) => (
                                <TableCell key={cellIndex} className="px-4 py-4 sm:px-5">
                                  <Skeleton className="h-4 w-full max-w-[8rem] bg-[var(--admin-surface-high)]" />
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        : pageJobs.map((job) => {
                            const displayStatus = resolveExportDisplayStatus(job);
                            const downloadable = canDownloadExport(displayStatus);
                            const muted = displayStatus === "EXPIRED" || displayStatus === "CANCELLED";
                            return (
                              <TableRow
                                key={job.id}
                                className={muted ? exportsTableRowMutedClassName : exportsTableRowClassName}
                              >
                                <TableCell className="px-4 py-4 sm:px-5">
                                  <ExportStatusBadge status={displayStatus} />
                                </TableCell>
                                <TableCell className="px-4 py-4 text-sm text-[var(--admin-on-surface)] sm:px-5">
                                  <time dateTime={job.createdAt}>{formatRelativeTime(job.createdAt)}</time>
                                </TableCell>
                                <TableCell className="px-4 py-4 text-sm text-[var(--admin-on-surface)] sm:px-5">
                                  {formatRequestedBy(job.requestedByMembershipId)}
                                </TableCell>
                                <TableCell className="px-4 py-4 text-sm text-[var(--admin-on-surface)] sm:px-5">
                                  {formatExpiresLabel(job, displayStatus)}
                                </TableCell>
                                <TableCell className="px-4 py-4 sm:px-5">
                                  {job.errorCode ? (
                                    <code className={exportsErrorCodeClassName}>{job.errorCode}</code>
                                  ) : (
                                    <span className="text-sm text-[var(--admin-on-surface-variant)]">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="px-4 py-4 text-right sm:px-5">
                                  {downloadable ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="h-8 px-3 text-sm font-semibold text-[var(--admin-primary)] hover:bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))]"
                                      disabled={downloadingId === job.id}
                                      onClick={() => void downloadExport(job.id)}
                                    >
                                      {downloadingId === job.id ? "Preparing…" : "Download"}
                                    </Button>
                                  ) : displayStatus === "RUNNING" || displayStatus === "QUEUED" ? (
                                    <span className="text-sm text-[var(--admin-on-surface-variant)] opacity-60">
                                      Pending
                                    </span>
                                  ) : (
                                    <span className="text-sm text-[var(--admin-on-surface-variant)]">
                                      No action
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                    </TableBody>
                  </Table>
                </div>

                {jobs.length > EXPORTS_PAGE_SIZE ? (
                  <div className={exportsTableFooterClassName}>
                    <span className="text-[11px] font-medium text-[var(--admin-on-surface-variant)]">
                      Showing {(page - 1) * EXPORTS_PAGE_SIZE + 1}–
                      {Math.min(page * EXPORTS_PAGE_SIZE, jobs.length)} of {jobs.length} exports
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className={`${ghostButtonClassName} inline-flex h-8 w-8 items-center justify-center p-0 disabled:opacity-40`}
                        disabled={page <= 1}
                        onClick={() => {
                          setPage((current) => Math.max(1, current - 1));
                        }}
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      </button>
                      {Array.from({ length: pageCount }).map((_, index) => {
                        const pageNumber = index + 1;
                        const selected = pageNumber === page;
                        return (
                          <button
                            key={pageNumber}
                            type="button"
                            className={`flex h-8 w-8 items-center justify-center rounded text-[11px] font-semibold transition-colors ${
                              selected
                                ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)] shadow-sm"
                                : "text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                            }`}
                            aria-current={selected ? "page" : undefined}
                            onClick={() => {
                              setPage(pageNumber);
                            }}
                          >
                            {pageNumber}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        className={`${ghostButtonClassName} inline-flex h-8 w-8 items-center justify-center p-0 disabled:opacity-40`}
                        disabled={page >= pageCount}
                        onClick={() => {
                          setPage((current) => Math.min(pageCount, current + 1));
                        }}
                        aria-label="Next page"
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <article className={exportsInfoCardClassName}>
              <div className="mb-2 flex items-center gap-2 text-[var(--admin-primary)]">
                <CloudDownload className="h-5 w-5" aria-hidden="true" />
                <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">Retention</h3>
              </div>
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                Completed exports show an expiry timestamp. Download signed URLs before that time — files
                are not kept indefinitely.
              </p>
            </article>
            <article className={exportsInfoCardClassName}>
              <div className="mb-2 flex items-center gap-2 text-[var(--admin-success)]">
                <Shield className="h-5 w-5" aria-hidden="true" />
                <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">Access control</h3>
              </div>
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                Export jobs require the <code className="text-xs">data.export.enable</code> entitlement and
                appropriate admin permissions. Downloads use short-lived signed URLs.
              </p>
            </article>
            <article className={exportsInfoCardClassName}>
              <div className="mb-2 flex items-center gap-2 text-[var(--admin-on-surface-variant)]">
                <Workflow className="h-5 w-5" aria-hidden="true" />
                <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">Background jobs</h3>
              </div>
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                Exports run asynchronously. Queued and running jobs refresh automatically every few seconds
                until they complete.
              </p>
            </article>
          </div>
        </div>
      </div>

      <AdminConfirmDialog
        open={confirmOpen}
        title="Run tenant export?"
        description="This queues a background export job with tenant-safe learning data. You can download the package once it succeeds."
        confirmLabel="Run export"
        busyLabel="Queueing…"
        busy={busy}
        onConfirm={() => void runExport()}
        onCancel={() => {
          setConfirmOpen(false);
        }}
      />
    </div>
  );
}
