"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ChevronRight,
  Filter,
  Loader2,
  MoreVertical,
  RefreshCw,
} from "lucide-react";
import { AdminSelectDropdown } from "../../readiness/components/AdminSelectDropdown";
import { dropdownPanelSurfaceClassName } from "../../studio/courses/admin-form-dropdown-shared";
import {
  alertErrorClassName,
  formatModerationDateTime,
  formatModerationReason,
  moderationPageDescClassName,
  moderationPageTitleClassName,
  moderationStatusBadgeClassName,
  moderationTablePanelClassName,
  moderationTableRowClassName,
  moderationToolbarClassName,
  monoClassName,
  outlineButtonClassName,
  primaryButtonClassName,
  tableHeadClassName,
  targetTypeMeta,
  truncateModerationPreview,
} from "../moderation-admin-shared";
import { adminModerationCaseDetailPath } from "../moderation-paths";
import {
  beginModerationReview,
  formatModerationError,
  listModerationCases,
  STATUS_OPTIONS,
  TARGET_TYPE_OPTIONS,
  type ModerationCaseItem,
} from "../api";
import { ModerationQueueMetrics } from "./ModerationQueueMetrics";

function countByStatus(items: ModerationCaseItem[], status: string): number {
  return items.filter((item) => item.status === status).length;
}

export function ModerationQueueClient() {
  const router = useRouter();
  const [cases, setCases] = useState<ModerationCaseItem[]>([]);
  const [summaryCases, setSummaryCases] = useState<ModerationCaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [targetType, setTargetType] = useState("");
  const [busyCaseId, setBusyCaseId] = useState<string | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  const beginReviewMutation = useMutation({
    mutationFn: (caseId: string) => beginModerationReview(caseId),
    onMutate: (caseId) => {
      setBusyCaseId(caseId);
      setErrorMessage(null);
      setOpenActionMenuId(null);
    },
    onSuccess: async () => {
      await Promise.all([loadCases(), loadSummary()]);
    },
    onError: (error) => {
      setErrorMessage(formatModerationError(error));
    },
    onSettled: () => {
      setBusyCaseId(null);
    },
  });

  const loadSummary = useCallback(async () => {
    try {
      const response = await listModerationCases({ view: "cases" });
      setSummaryCases(response.data.items);
    } catch {
      setSummaryCases([]);
    }
  }, []);

  const loadCases = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await listModerationCases({
        view: "cases",
        ...(status ? { status } : {}),
        ...(targetType ? { targetType } : {}),
      });
      setCases(response.data.items);
    } catch (error) {
      setErrorMessage(formatModerationError(error));
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [status, targetType]);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const metrics = useMemo(
    () => ({
      openCount: countByStatus(summaryCases, "OPEN"),
      reviewingCount: countByStatus(summaryCases, "REVIEWING"),
      actionedCount: countByStatus(summaryCases, "ACTIONED"),
      visibleCount: cases.length,
    }),
    [cases.length, summaryCases],
  );

  function handleRefresh() {
    void Promise.all([loadCases(), loadSummary()]);
  }

  function handleBeginReview(caseId: string) {
    if (beginReviewMutation.isPending) return;
    beginReviewMutation.mutate(caseId);
  }

  function navigateToCase(caseId: string) {
    router.push(adminModerationCaseDetailPath(caseId));
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className={moderationPageTitleClassName}>Moderation cases</h1>
        <p className={moderationPageDescClassName}>
          Review open moderation cases and begin review on new reports.
        </p>
      </header>

      <div className={moderationToolbarClassName}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-[10rem] items-center gap-2">
            <Filter className="h-4 w-4 shrink-0 text-[var(--admin-outline)]" aria-hidden="true" />
            <AdminSelectDropdown
              id="moderation-status-filter"
              ariaLabel="Filter by status"
              label={null}
              value={status}
              options={STATUS_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              onChange={setStatus}
            />
          </div>
          <div className="hidden h-6 w-px bg-[var(--admin-border)] sm:block" aria-hidden="true" />
          <div className="min-w-[9rem]">
            <AdminSelectDropdown
              id="moderation-target-filter"
              ariaLabel="Filter by target type"
              label={null}
              value={targetType}
              options={TARGET_TYPE_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              onChange={setTargetType}
            />
          </div>
          <p className="text-[13px] text-[var(--admin-on-surface-variant)]">
            Showing{" "}
            <span className="font-semibold text-[var(--admin-on-surface)]">{cases.length}</span>{" "}
            {cases.length === 1 ? "case" : "cases"}
          </p>
        </div>
        <button
          type="button"
          className={primaryButtonClassName}
          disabled={loading}
          onClick={handleRefresh}
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? "motion-safe:animate-spin" : ""}`}
            aria-hidden="true"
          />
          Refresh queue
        </button>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]" aria-live="polite">
          <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
          Loading moderation queue…
        </p>
      ) : null}

      {errorMessage ? (
        <p className={alertErrorClassName} role="alert" aria-live="polite">
          {errorMessage}
        </p>
      ) : null}

      {!loading && !errorMessage && cases.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-10 text-center">
          <p className="text-sm font-medium text-[var(--admin-on-surface)]">
            No moderation cases match the current filters.
          </p>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Try clearing filters or refresh the queue.
          </p>
        </div>
      ) : null}

      {!loading && !errorMessage && cases.length > 0 ? (
        <div className={moderationTablePanelClassName}>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className={`${tableHeadClassName} border-b border-[var(--admin-border)]`}>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Target type</th>
                  <th className="px-4 py-3">Target preview</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((item) => {
                  const target = targetTypeMeta(item.targetType);
                  const TargetIcon = target.icon;
                  return (
                    <tr
                      key={item.id}
                      className={`${moderationTableRowClassName} cursor-pointer`}
                      onClick={() => {
                        navigateToCase(item.id);
                      }}
                    >
                      <td className="px-4 py-3">
                        <span className={moderationStatusBadgeClassName(item.status)}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 text-[11px] font-semibold uppercase text-[var(--admin-on-surface-variant)]">
                          <TargetIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          {target.label}
                        </span>
                      </td>
                      <td className="max-w-[16rem] px-4 py-3">
                        <p className="truncate text-[13px] text-[var(--admin-on-surface)]">
                          {item.target?.previewText
                            ? truncateModerationPreview(item.target.previewText)
                            : "Unavailable"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[var(--admin-on-surface-variant)]">
                        {formatModerationReason(item.reasonKey)}
                      </td>
                      <td className={`px-4 py-3 ${monoClassName}`}>
                        {formatModerationDateTime(item.createdAt)}
                      </td>
                      <td className="relative px-4 py-3 text-right">
                        {item.status === "OPEN" ? (
                          <button
                            type="button"
                            className={outlineButtonClassName}
                            disabled={busyCaseId === item.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleBeginReview(item.id);
                            }}
                          >
                            {busyCaseId === item.id ? "Starting…" : "Begin review"}
                          </button>
                        ) : (
                          <div className="relative inline-block">
                            <button
                              type="button"
                              className="rounded p-1 text-[var(--admin-outline)] transition-colors hover:text-[var(--admin-primary)]"
                              aria-label={`Actions for case ${item.id.slice(0, 8)}`}
                              aria-expanded={openActionMenuId === item.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                setOpenActionMenuId((current) =>
                                  current === item.id ? null : item.id,
                                );
                              }}
                            >
                              <MoreVertical className="h-4 w-4" aria-hidden="true" />
                            </button>
                            {openActionMenuId === item.id ? (
                              <div
                                className={`absolute right-0 z-20 mt-1 min-w-[9rem] bg-[var(--admin-surface)] p-1 shadow-lg ${dropdownPanelSurfaceClassName}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                }}
                              >
                                <Link
                                  href={adminModerationCaseDetailPath(item.id)}
                                  className="block rounded-md px-3 py-2 text-left text-sm text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                                >
                                  Open case
                                </Link>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 p-4 md:hidden">
            {cases.map((item) => {
              const target = targetTypeMeta(item.targetType);
              const TargetIcon = target.icon;
              return (
                <article
                  key={item.id}
                  className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className={moderationStatusBadgeClassName(item.status)}>
                        {item.status}
                      </span>
                      <p className="mt-2 truncate text-sm font-medium text-[var(--admin-on-surface)]">
                        {item.target?.previewText ?? "Unavailable"}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--admin-on-surface-variant)]">
                        <TargetIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        {target.label} · {formatModerationReason(item.reasonKey)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--admin-outline)]" aria-hidden="true" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={adminModerationCaseDetailPath(item.id)}
                      className={outlineButtonClassName}
                    >
                      Open case
                    </Link>
                    {item.status === "OPEN" ? (
                      <button
                        type="button"
                        className={primaryButtonClassName}
                        disabled={busyCaseId === item.id}
                        onClick={() => {
                          handleBeginReview(item.id);
                        }}
                      >
                        Begin review
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-[13px] text-[var(--admin-on-surface-variant)]">
            <span>
              {cases.length} {cases.length === 1 ? "case" : "cases"} in view
            </span>
          </div>
        </div>
      ) : null}

      <ModerationQueueMetrics {...metrics} />
    </div>
  );
}
