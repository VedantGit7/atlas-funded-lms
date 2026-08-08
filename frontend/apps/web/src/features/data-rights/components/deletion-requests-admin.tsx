"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Timer,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import {
  EmptyState,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@atlas/design-system";
import {
  createDeletionRequest,
  fetchDeletionRequests,
  formatApiError,
  processDeletionRequest,
  type DeletionRequestItem,
} from "../api";
import {
  deletionsAlertErrorClassName,
  deletionsContentClassName,
  deletionsDangerPanelClassName,
  deletionsEmptyStateClassName,
  deletionsInfoCardClassName,
  deletionsMainClassName,
  deletionsOutlineButtonClassName,
  deletionsPageHeaderClassName,
  deletionsPollingDotClassName,
  deletionsProcessButtonClassName,
  deletionsSearchInputClassName,
  deletionsTableFooterClassName,
  deletionsTableHeadClassName,
  deletionsTableRowClassName,
  deletionsTableRowMutedClassName,
  deletionsTableShellClassName,
  deletionsTableToolbarClassName,
  deletionsTargetIdClassName,
  deletionsWorkspaceClassName,
  fieldClassName,
  ghostButtonClassName,
  primaryButtonClassName,
} from "../deletion-requests-admin-shared";
import {
  DELETIONS_PAGE_SIZE,
  DELETION_STATUS_LABELS,
  canProcessRequest,
  deletionStatusBadgeClassName,
  filterDeletionRequests,
  formatGracePeriod,
  formatRelativeTime,
  formatRequestedBy,
  formatShortId,
  formatTargetType,
  hasActiveDeletions,
  isMutedRequest,
  paginateRequests,
  totalDeletionPages,
  type DeletionDisplayStatus,
} from "../deletion-requests-admin-utils";

export type DeletionRequestsAdminProps = {
  initialRequests: DeletionRequestItem[];
  canManage: boolean;
  canFileForOthers: boolean;
  defaultTargetMembershipId?: string;
};

function DeletionStatusBadge({ status }: { status: DeletionDisplayStatus }) {
  const Icon =
    status === "RUNNING"
      ? Loader2
      : status === "SUCCEEDED"
        ? CheckCircle2
        : status === "QUEUED"
          ? Clock
          : status === "FAILED"
            ? AlertTriangle
            : XCircle;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${deletionStatusBadgeClassName(status)}`}
    >
      <Icon
        className={`h-3.5 w-3.5 ${status === "RUNNING" ? "motion-safe:animate-spin" : ""}`}
        aria-hidden="true"
      />
      {DELETION_STATUS_LABELS[status]}
    </span>
  );
}

type FileRequestDialogProps = {
  open: boolean;
  busy: boolean;
  canFileForOthers: boolean;
  targetMembershipId: string;
  reason: string;
  onTargetChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
};

function FileRequestDialog({
  open,
  busy,
  canFileForOthers,
  targetMembershipId,
  reason,
  onTargetChange,
  onReasonChange,
  onSubmit,
  onClose,
}: FileRequestDialogProps) {
  const headingId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm"
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative z-10 w-full max-w-md rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id={headingId} className="text-lg font-semibold text-[var(--admin-on-surface)]">
            New deletion request
          </h2>
          <button
            type="button"
            className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
            onClick={onClose}
            disabled={busy}
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 text-sm text-[var(--admin-on-surface-variant)]">
            Target type: <span className="font-semibold text-[var(--admin-on-surface)]">Membership</span>
          </div>

          {canFileForOthers ? (
            <label className="grid gap-1.5 text-sm">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                Target membership ID
              </span>
              <input
                className={fieldClassName}
                value={targetMembershipId}
                onChange={(event) => {
                  onTargetChange(event.target.value);
                }}
                placeholder="Membership UUID"
                disabled={busy}
              />
            </label>
          ) : null}

          <label className="grid gap-1.5 text-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              Reason (optional)
            </span>
            <textarea
              className={`${fieldClassName} min-h-[6rem] resize-y`}
              value={reason}
              onChange={(event) => {
                onReasonChange(event.target.value);
              }}
              placeholder="Audit trail note for this request…"
              maxLength={500}
              disabled={busy}
            />
          </label>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            className={ghostButtonClassName}
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={primaryButtonClassName}
            onClick={onSubmit}
            disabled={busy || (canFileForOthers && !targetMembershipId.trim())}
          >
            {busy ? "Filing…" : "File request"}
          </button>
        </div>
      </div>
    </div>
  );
}

type ProcessDialogProps = {
  open: boolean;
  busy: boolean;
  request: DeletionRequestItem | null;
  confirmValue: string;
  onConfirmValueChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
};

function ProcessDialog({
  open,
  busy,
  request,
  confirmValue,
  onConfirmValueChange,
  onConfirm,
  onClose,
}: ProcessDialogProps) {
  const headingId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmed = request != null && confirmValue.trim() === request.targetId;

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onClose]);

  if (!open || !request) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm"
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border-2 border-[var(--admin-danger)] bg-[var(--admin-surface)] shadow-2xl"
      >
        <div className="space-y-5 p-6">
          <div className="flex items-center gap-3 text-[var(--admin-danger)]">
            <AlertTriangle className="h-8 w-8 shrink-0" aria-hidden="true" />
            <h2 id={headingId} className="text-lg font-bold text-[var(--admin-on-surface)]">
              Irreversible action
            </h2>
          </div>

          <div id={descriptionId} className={deletionsDangerPanelClassName}>
            <p>
              You are about to permanently delete the{" "}
              <strong>{formatTargetType(request.targetType)}</strong> record{" "}
              <code className={deletionsTargetIdClassName}>{formatShortId(request.targetId)}</code>.
              Associated learner data will be removed and cannot be recovered.
            </p>
          </div>

          <label className="grid gap-1.5 text-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              Type the target membership ID to confirm
            </span>
            <input
              className={`${fieldClassName} font-mono text-xs`}
              value={confirmValue}
              onChange={(event) => {
                onConfirmValueChange(event.target.value);
              }}
              placeholder={request.targetId}
              disabled={busy}
              autoComplete="off"
            />
          </label>

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button
              ref={cancelRef}
              type="button"
              className={`${ghostButtonClassName} flex-1`}
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="flex-[2] rounded-lg bg-[var(--admin-danger)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-primary)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onConfirm}
              disabled={busy || !confirmed}
            >
              {busy ? "Processing…" : "Process — permanently delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type DetailsDialogProps = {
  request: DeletionRequestItem | null;
  onClose: () => void;
};

function DetailsDialog({ request, onClose }: DetailsDialogProps) {
  const headingId = useId();

  useEffect(() => {
    if (!request) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [request, onClose]);

  if (!request) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative z-10 w-full max-w-lg rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-2xl"
      >
        <h2 id={headingId} className="text-lg font-semibold text-[var(--admin-on-surface)]">
          Request details
        </h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--admin-on-surface-variant)]">Status</dt>
            <dd>
              <DeletionStatusBadge status={request.status} />
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--admin-on-surface-variant)]">Target</dt>
            <dd className="text-right font-mono text-xs text-[var(--admin-on-surface)]">
              {formatTargetType(request.targetType)} · {request.targetId}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--admin-on-surface-variant)]">Requested</dt>
            <dd className="text-[var(--admin-on-surface)]">{new Date(request.createdAt).toLocaleString()}</dd>
          </div>
          {request.completedAt ? (
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--admin-on-surface-variant)]">Completed</dt>
              <dd className="text-[var(--admin-on-surface)]">
                {new Date(request.completedAt).toLocaleString()}
              </dd>
            </div>
          ) : null}
          {request.reason ? (
            <div>
              <dt className="text-[var(--admin-on-surface-variant)]">Reason</dt>
              <dd className="mt-1 text-[var(--admin-on-surface)]">{request.reason}</dd>
            </div>
          ) : null}
        </dl>
        <div className="mt-6 flex justify-end">
          <button type="button" className={ghostButtonClassName} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function DeletionRequestsAdmin({
  initialRequests,
  canManage,
  canFileForOthers,
  defaultTargetMembershipId,
}: DeletionRequestsAdminProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [processTarget, setProcessTarget] = useState<DeletionRequestItem | null>(null);
  const [processConfirmValue, setProcessConfirmValue] = useState("");
  const [detailsTarget, setDetailsTarget] = useState<DeletionRequestItem | null>(null);
  const [targetMembershipId, setTargetMembershipId] = useState(defaultTargetMembershipId ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [pollingLabel, setPollingLabel] = useState("Checking for updates");

  const filteredRequests = useMemo(
    () => filterDeletionRequests(requests, searchQuery),
    [requests, searchQuery],
  );
  const pageRequests = useMemo(() => paginateRequests(filteredRequests, page), [filteredRequests, page]);
  const pageCount = totalDeletionPages(filteredRequests.length);
  const active = hasActiveDeletions(requests);

  const refreshRequests = useCallback(async () => {
    const response = await fetchDeletionRequests();
    setRequests(response.data.items);
    setPage((current) => Math.min(current, totalDeletionPages(response.data.items.length)));
  }, []);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      void refreshRequests().catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [active, refreshRequests]);

  useEffect(() => {
    if (!active) return;
    const dots = ["", ".", "..", "..."];
    let index = 0;
    const timer = window.setInterval(() => {
      index = (index + 1) % dots.length;
      setPollingLabel(`Checking for updates${dots[index]}`);
    }, 900);
    return () => window.clearInterval(timer);
  }, [active]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  async function handleRefresh() {
    setRefreshing(true);
    setMessage(null);
    setRequestId(null);
    try {
      await refreshRequests();
    } catch (error) {
      const formatted = formatApiError(error);
      setMessage(formatted.message);
      setRequestId(formatted.requestId);
    } finally {
      setRefreshing(false);
    }
  }

  async function fileRequest() {
    setBusy(true);
    setMessage(null);
    setRequestId(null);
    try {
      await createDeletionRequest(
        {
          confirm: true,
          ...(canFileForOthers && targetMembershipId.trim()
            ? { targetMembershipId: targetMembershipId.trim() }
            : {}),
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        },
        `deletion-file-${String(Date.now())}`,
      );
      setFileDialogOpen(false);
      setReason("");
      setPage(1);
      await refreshRequests();
    } catch (error) {
      const formatted = formatApiError(error);
      setMessage(formatted.message);
      setRequestId(formatted.requestId);
    } finally {
      setBusy(false);
    }
  }

  async function confirmProcess() {
    if (!processTarget) return;
    setBusy(true);
    setMessage(null);
    setRequestId(null);
    try {
      await processDeletionRequest(processTarget.id, `deletion-process-${processTarget.id}`);
      setProcessTarget(null);
      setProcessConfirmValue("");
      await refreshRequests();
    } catch (error) {
      const formatted = formatApiError(error);
      setMessage(formatted.message);
      setRequestId(formatted.requestId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={deletionsWorkspaceClassName}>
      <div className={deletionsMainClassName}>
        <div className={deletionsContentClassName}>
          <div className={deletionsPageHeaderClassName}>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
                Deletion Requests
              </h1>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                Monitor and process data removal requests across your tenant.
              </p>
            </div>
            {canFileForOthers ? (
              <button
                type="button"
                className={deletionsOutlineButtonClassName}
                onClick={() => {
                  setFileDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                File request
              </button>
            ) : null}
          </div>

          {message ? (
            <p role="alert" className={`${deletionsAlertErrorClassName} mb-4`}>
              {message}
              {requestId ? ` Request ID: ${requestId}` : ""}
            </p>
          ) : null}

          <section className={deletionsTableShellClassName} aria-labelledby="deletion-requests-heading">
            <h2 id="deletion-requests-heading" className="sr-only">
              Deletion requests
            </h2>

            <div className={deletionsTableToolbarClassName}>
              <div className="relative w-full sm:max-w-xs">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                  }}
                  placeholder="Search requests…"
                  aria-label="Search deletion requests"
                  className={deletionsSearchInputClassName}
                />
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <div className="flex items-center gap-2">
                  {active ? (
                    <>
                      <span className={deletionsPollingDotClassName} aria-hidden="true" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                        {pollingLabel}
                      </span>
                    </>
                  ) : (
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                      {filteredRequests.length} request{filteredRequests.length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className={`${ghostButtonClassName} inline-flex h-9 w-9 items-center justify-center p-0`}
                  onClick={() => void handleRefresh()}
                  disabled={refreshing}
                  aria-label="Refresh deletion requests"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${refreshing ? "motion-safe:animate-spin" : ""}`}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>

            {filteredRequests.length === 0 && !refreshing ? (
              <EmptyState
                className={deletionsEmptyStateClassName}
                title={searchQuery ? "No matching requests" : "No deletion requests yet"}
                description={
                  searchQuery
                    ? "Try a different search term or clear the filter."
                    : "File a request when a membership must be removed under your data-rights workflow."
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table className="min-w-[960px] border-collapse">
                    <TableHead>
                      <TableRow className="border-b border-[var(--admin-border)] hover:bg-transparent">
                        <TableHeaderCell className={`px-4 py-3 sm:px-5 ${deletionsTableHeadClassName}`}>
                          Status
                        </TableHeaderCell>
                        <TableHeaderCell className={`px-4 py-3 sm:px-5 ${deletionsTableHeadClassName}`}>
                          Target
                        </TableHeaderCell>
                        <TableHeaderCell className={`px-4 py-3 sm:px-5 ${deletionsTableHeadClassName}`}>
                          Requested by
                        </TableHeaderCell>
                        <TableHeaderCell className={`px-4 py-3 sm:px-5 ${deletionsTableHeadClassName}`}>
                          Reason
                        </TableHeaderCell>
                        <TableHeaderCell
                          className={`px-4 py-3 text-center sm:px-5 ${deletionsTableHeadClassName}`}
                        >
                          Requested
                        </TableHeaderCell>
                        <TableHeaderCell className={`px-4 py-3 sm:px-5 ${deletionsTableHeadClassName}`}>
                          Grace period
                        </TableHeaderCell>
                        <TableHeaderCell
                          className={`px-4 py-3 text-right sm:px-5 ${deletionsTableHeadClassName}`}
                        >
                          Actions
                        </TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {refreshing
                        ? Array.from({ length: 3 }).map((_, index) => (
                            <TableRow key={`skeleton-${index}`} className={deletionsTableRowClassName}>
                              {Array.from({ length: 7 }).map((__, cellIndex) => (
                                <TableCell key={cellIndex} className="px-4 py-4 sm:px-5">
                                  <Skeleton className="h-4 w-full max-w-[8rem] bg-[var(--admin-surface-high)]" />
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        : pageRequests.map((request) => {
                            const muted = isMutedRequest(request);
                            const grace = formatGracePeriod(request);
                            return (
                              <TableRow
                                key={request.id}
                                className={muted ? deletionsTableRowMutedClassName : deletionsTableRowClassName}
                              >
                                <TableCell className="px-4 py-4 sm:px-5">
                                  <DeletionStatusBadge status={request.status} />
                                </TableCell>
                                <TableCell className="px-4 py-4 sm:px-5">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-sm font-semibold text-[var(--admin-on-surface)]">
                                      {formatTargetType(request.targetType)}
                                    </span>
                                    <span className={deletionsTargetIdClassName}>{formatShortId(request.targetId)}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="px-4 py-4 text-sm text-[var(--admin-on-surface)] sm:px-5">
                                  {formatRequestedBy(request.requestedByMembershipId)}
                                </TableCell>
                                <TableCell className="max-w-xs px-4 py-4 sm:px-5">
                                  {request.reason ? (
                                    <span
                                      className="block truncate text-sm text-[var(--admin-on-surface-variant)]"
                                      title={request.reason}
                                    >
                                      {request.reason}
                                    </span>
                                  ) : (
                                    <span className="text-sm text-[var(--admin-on-surface-variant)]">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="px-4 py-4 text-center text-sm text-[var(--admin-on-surface-variant)] sm:px-5">
                                  <time dateTime={request.createdAt}>{formatRelativeTime(request.createdAt)}</time>
                                </TableCell>
                                <TableCell className="px-4 py-4 sm:px-5">
                                  {grace.startsWith("Executes") ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--admin-danger)]">
                                      <Timer className="h-3.5 w-3.5" aria-hidden="true" />
                                      {grace}
                                    </span>
                                  ) : (
                                    <span className="text-sm text-[var(--admin-on-surface-variant)]">{grace}</span>
                                  )}
                                </TableCell>
                                <TableCell className="px-4 py-4 text-right sm:px-5">
                                  <div className="flex items-center justify-end gap-2">
                                    {canManage && canProcessRequest(request) ? (
                                      <button
                                        type="button"
                                        className={deletionsProcessButtonClassName}
                                        onClick={() => {
                                          setProcessTarget(request);
                                          setProcessConfirmValue("");
                                        }}
                                      >
                                        Process
                                      </button>
                                    ) : request.status === "RUNNING" ? (
                                      <span className="text-xs text-[var(--admin-on-surface-variant)] opacity-60">
                                        Processing…
                                      </span>
                                    ) : request.status === "SUCCEEDED" ||
                                      request.status === "FAILED" ||
                                      request.status === "CANCELLED" ? (
                                      <button
                                        type="button"
                                        className={`${ghostButtonClassName} h-8 px-3 text-xs font-semibold`}
                                        onClick={() => {
                                          setDetailsTarget(request);
                                        }}
                                      >
                                        Details
                                      </button>
                                    ) : (
                                      <span className="text-xs text-[var(--admin-on-surface-variant)]">No action</span>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                    </TableBody>
                  </Table>
                </div>

                {filteredRequests.length > DELETIONS_PAGE_SIZE ? (
                  <div className={deletionsTableFooterClassName}>
                    <span className="text-[11px] font-medium text-[var(--admin-on-surface-variant)]">
                      Showing {(page - 1) * DELETIONS_PAGE_SIZE + 1}–
                      {Math.min(page * DELETIONS_PAGE_SIZE, filteredRequests.length)} of{" "}
                      {filteredRequests.length} requests
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
            <article className={deletionsInfoCardClassName}>
              <div className="mb-2 flex items-center gap-2 text-[var(--admin-danger)]">
                <Trash2 className="h-5 w-5" aria-hidden="true" />
                <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">Irreversible</h3>
              </div>
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                Processing a queued request permanently removes membership-linked learner data. This cannot be
                undone.
              </p>
            </article>
            <article className={deletionsInfoCardClassName}>
              <div className="mb-2 flex items-center gap-2 text-[var(--admin-primary)]">
                <ShieldAlert className="h-5 w-5" aria-hidden="true" />
                <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">Permissions</h3>
              </div>
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                Filing requires <code className="text-xs">data.deletion.request</code>. Processing requires{" "}
                <code className="text-xs">data.deletion.manage</code>.
              </p>
            </article>
            <article className={deletionsInfoCardClassName}>
              <div className="mb-2 flex items-center gap-2 text-[var(--admin-success)]">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">Audit trail</h3>
              </div>
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                Every filed and processed request is recorded in the tenant audit log for compliance review.
              </p>
            </article>
          </div>
        </div>
      </div>

      <FileRequestDialog
        open={fileDialogOpen}
        busy={busy}
        canFileForOthers={canFileForOthers}
        targetMembershipId={targetMembershipId}
        reason={reason}
        onTargetChange={setTargetMembershipId}
        onReasonChange={setReason}
        onSubmit={() => void fileRequest()}
        onClose={() => {
          if (!busy) setFileDialogOpen(false);
        }}
      />

      <ProcessDialog
        open={processTarget != null}
        busy={busy}
        request={processTarget}
        confirmValue={processConfirmValue}
        onConfirmValueChange={setProcessConfirmValue}
        onConfirm={() => void confirmProcess()}
        onClose={() => {
          if (!busy) {
            setProcessTarget(null);
            setProcessConfirmValue("");
          }
        }}
      />

      <DetailsDialog
        request={detailsTarget}
        onClose={() => {
          setDetailsTarget(null);
        }}
      />
    </div>
  );
}
