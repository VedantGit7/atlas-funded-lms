"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Download,
  Filter,
  MoreVertical,
  Search,
  X,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import {
  BATCH_LEARNER_COLUMN_OPTIONS,
  type BatchesListHealthFilter,
  type BatchesListSortBy,
  type BatchesListWindow,
} from "./admin-batches-roster-api";
import {
  EmptyBatchesState,
  Shimmer,
  TripleMetricCell,
  fieldClassName,
  formatDate,
  formatDateTime,
  formatPct,
  formatRelative,
  healthRailClass,
  metricBarTone,
  secondaryButtonClassName,
  selectClassName,
  statusPillClass,
  titleCase,
  windowCaption,
  windowProgress,
} from "./admin-batches-roster-shared";
import type { BatchesRosterView } from "./use-batches-roster";

/** The summary cards above the batch list; some filter the list. */
export function BatchesSummaryCards({ view }: { view: BatchesRosterView }) {
  const { applySavedView, summary, viewer } = view;
  return (
    <div className="grid gap-3 md:grid-cols-6">
      <button
        type="button"
        className="col-span-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-left transition-colors hover:bg-[var(--admin-surface-high)]"
        onClick={() => {
          applySavedView("active");
        }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
          Active batches
        </p>
        <p className="mt-2 font-mono text-[32px] font-medium leading-none text-[var(--admin-on-surface)]">
          {(summary?.activeBatchCount ?? 0).toLocaleString(viewer.locale)}
        </p>
        <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
          {(summary?.totalLearners ?? 0).toLocaleString(viewer.locale)} learners enrolled
        </p>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
          <div className="h-full w-2/3 rounded-full bg-[var(--admin-primary)]" />
        </div>
      </button>
      <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
          Avg completion
        </p>
        <p className="mt-2 font-mono text-2xl font-medium text-[var(--admin-on-surface)]">
          {formatPct(summary?.avgContentCompletionPct)}
        </p>
        <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
          <div
            className={`h-full rounded-full ${metricBarTone(summary?.avgContentCompletionPct)}`}
            style={{
              width: `${String(Math.max(0, Math.min(100, summary?.avgContentCompletionPct ?? 0)))}%`,
            }}
          />
        </div>
      </div>
      <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
          Avg attendance
        </p>
        <p className="mt-2 font-mono text-2xl font-medium text-[var(--admin-on-surface)]">
          {formatPct(summary?.avgLiveAttendancePct)}
        </p>
        <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
          <div
            className={`h-full rounded-full ${metricBarTone(summary?.avgLiveAttendancePct)}`}
            style={{
              width: `${String(Math.max(0, Math.min(100, summary?.avgLiveAttendancePct ?? 0)))}%`,
            }}
          />
        </div>
      </div>
      <button
        type="button"
        className="rounded-lg border border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] bg-[var(--admin-surface)] p-4 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))]"
        onClick={() => {
          applySavedView("at_risk");
        }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-warning)]">
          Batches at risk
        </p>
        <p className="mt-2 font-mono text-2xl font-medium text-[var(--admin-warning)]">
          {(summary?.atRiskCount ?? 0).toLocaleString(viewer.locale)}
        </p>
      </button>
      <button
        type="button"
        className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-left transition-colors hover:bg-[var(--admin-surface-high)]"
        onClick={() => {
          applySavedView("ending_soon");
        }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
          Ending in 30 days
        </p>
        <p className="mt-2 font-mono text-2xl font-medium text-[var(--admin-on-surface)]">
          {(summary?.endingSoonCount ?? 0).toLocaleString(viewer.locale)}
        </p>
      </button>
    </div>
  );
}

/** Search, filters, saved views and the applied filter chips. */
export function BatchesFilters({ view }: { view: BatchesRosterView }) {
  const {
    appliedChips,
    clearAllFilters,
    draftSearch,
    healthFilter,
    searchId,
    setDraftSearch,
    setHealthFilter,
    setPage,
    setSearchQ,
    setSortBy,
    setSortDir,
    setStatusFilter,
    setWindowFilter,
    sortBy,
    sortDir,
    statusFilter,
    windowFilter,
  } = view;
  return (
    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 shadow-[0_1px_0_color-mix(in_srgb,var(--admin-on-surface)_4%,transparent)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative flex min-w-0 flex-1 items-center" htmlFor={searchId}>
          <Search
            className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <input
            id={searchId}
            className={`${fieldClassName} w-full pl-9`}
            placeholder="Search batch name or key"
            value={draftSearch}
            onChange={(event) => {
              setDraftSearch(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                setSearchQ(draftSearch.trim());
                setPage(1);
              }
            }}
          />
        </label>
        <div className="hidden h-6 w-px bg-[var(--admin-border)] lg:block" />
        <Select
          className={selectClassName}
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
          options={[
            { value: "", label: "Status: All" },
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
            { value: "ARCHIVED", label: "Archived" },
          ]}
          ariaLabel="Status"
        />
        <Select
          className={selectClassName}
          value={windowFilter}
          onValueChange={(value) => {
            setWindowFilter(value as BatchesListWindow);
            setPage(1);
          }}
          options={[
            { value: "any", label: "Window: Any" },
            { value: "running", label: "Running now" },
            { value: "starting_soon", label: "Starting soon" },
            { value: "ending_soon", label: "Ending soon" },
            { value: "ended", label: "Ended" },
          ]}
          ariaLabel="Window"
        />
        <Select
          className={selectClassName}
          value={healthFilter}
          onValueChange={(value) => {
            setHealthFilter(value as BatchesListHealthFilter);
            setPage(1);
          }}
          options={[
            { value: "any", label: "Health: All" },
            { value: "on_track", label: "On track" },
            { value: "needs_attention", label: "At risk + critical" },
            { value: "at_risk", label: "At risk" },
            { value: "critical", label: "Critical" },
          ]}
          ariaLabel="Health"
        />
        <Select
          className={selectClassName}
          value={`${sortBy}:${sortDir}`}
          onValueChange={(value) => {
            const [nextSort, nextDir] = value.split(":");
            setSortBy(nextSort as BatchesListSortBy);
            setSortDir(nextDir === "asc" ? "asc" : "desc");
            setPage(1);
          }}
          options={[
            { value: "member_count:desc", label: "Learners desc" },
            { value: "avg_content_completion_pct:asc", label: "Completion asc" },
            { value: "avg_live_attendance_pct:asc", label: "Attendance asc" },
            { value: "starts_at:desc", label: "Start date desc" },
            { value: "name:asc", label: "Name A-Z" },
            { value: "created_at:desc", label: "Created desc" },
          ]}
          ariaLabel="Sort"
        />
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] px-3 text-xs font-semibold text-[var(--admin-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_18%,var(--admin-surface))]"
          onClick={() => {
            setSearchQ(draftSearch.trim());
            setPage(1);
          }}
        >
          <Filter className="h-3.5 w-3.5" aria-hidden="true" />
          Apply
          {appliedChips.length > 0 ? ` (${String(appliedChips.length)})` : ""}
        </button>
      </div>
      {appliedChips.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--admin-border)] pt-3">
          {appliedChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 text-[11px] text-[var(--admin-on-surface)]"
              onClick={chip.onClear}
            >
              {chip.label}
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ))}
          <button
            type="button"
            className="text-xs font-medium text-[var(--admin-primary)] hover:underline"
            onClick={clearAllFilters}
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** The batch table, its row menus and the pager. */
export function BatchesTable({ view }: { view: BatchesRosterView }) {
  const {
    batches,
    clearAllFilters,
    error,
    handleExport,
    hasActiveFilters,
    loading,
    openBatch,
    page,
    rangeEnd,
    rangeStart,
    router,
    rowMenuId,
    selectedIds,
    setPage,
    setRowMenuId,
    toggleSelect,
    toggleSelectAll,
    totalCount,
    totalCountLabel,
    totalPages,
    viewer,
  } = view;
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead>
            <tr className="h-11 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
              <th className="w-11 px-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--admin-primary)]"
                  checked={batches.length > 0 && selectedIds.length === batches.length}
                  onChange={toggleSelectAll}
                  aria-label="Select all batches on this page"
                />
              </th>
              <th className="px-3">Batch</th>
              <th className="px-3">Course</th>
              <th className="px-3">Status</th>
              <th className="px-3 text-right">Learners</th>
              <th className="px-3">Content completion</th>
              <th className="px-3">Live attendance</th>
              <th className="px-3">Test score</th>
              <th className="px-3">Window</th>
              <th className="px-3">Last activity</th>
              <th className="w-12 px-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {!loading && batches.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-0">
                  {error ? (
                    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
                      <CloudOff
                        className="mb-4 h-12 w-12 text-[var(--admin-outline)]"
                        aria-hidden="true"
                        strokeWidth={1.25}
                      />
                      <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
                        Data unavailable
                      </h3>
                      <p className="mt-2 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
                        We are unable to display the live batches report at this time. Please try
                        refreshing or check your connection.
                      </p>
                    </div>
                  ) : (
                    <EmptyBatchesState
                      hasFilters={hasActiveFilters}
                      onClear={clearAllFilters}
                      onManage={() => {
                        router.push("/admin/batches");
                      }}
                    />
                  )}
                </td>
              </tr>
            ) : (
              batches.map((batch, index) => {
                const progress = windowProgress(batch, viewer.now);
                const selected = selectedIds.includes(batch.id);
                return (
                  <tr
                    key={batch.id}
                    className={[
                      "group relative h-11 border-b border-[var(--admin-border)] last:border-b-0",
                      "cursor-pointer transition-colors duration-150",
                      selected
                        ? "bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))]"
                        : "hover:bg-[var(--admin-surface-high)]",
                      batch.status === "ARCHIVED" ? "opacity-70" : "",
                    ].join(" ")}
                    style={{
                      animationDelay: `${String(Math.min(index, 11) * 20)}ms`,
                    }}
                    onClick={() => {
                      openBatch(batch);
                    }}
                  >
                    <td
                      className="relative px-3"
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                    >
                      <span
                        className={`absolute bottom-0 left-0 top-0 w-1 ${healthRailClass(batch.health)}`}
                        aria-hidden="true"
                      />
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--admin-primary)]"
                        checked={selected}
                        onChange={() => {
                          toggleSelect(batch.id);
                        }}
                        aria-label={`Select ${batch.name}`}
                      />
                    </td>
                    <td className="px-3">
                      <div className="font-medium text-[var(--admin-primary)]">{batch.name}</div>
                      <div className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                        {batch.key}
                      </div>
                    </td>
                    <td className="px-3 text-[var(--admin-on-surface)]">
                      {batch.courseTitle ?? (
                        <span className="text-[var(--admin-on-surface-variant)]">
                          No linked course
                        </span>
                      )}
                    </td>
                    <td className="px-3">
                      <span
                        className={`inline-flex rounded-md border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.06em] ${statusPillClass(batch.status)}`}
                      >
                        {titleCase(batch.status)}
                      </span>
                    </td>
                    <td className="px-3 text-right font-mono text-[var(--admin-on-surface)]">
                      {batch.memberCount.toLocaleString(viewer.locale)}
                    </td>
                    <td className="px-3">
                      <TripleMetricCell
                        value={batch.avgContentCompletionPct}
                        caption="Avg lessons finished"
                        linked={Boolean(batch.courseId)}
                      />
                    </td>
                    <td className="px-3">
                      <TripleMetricCell
                        value={batch.avgLiveAttendancePct}
                        caption="Avg sessions joined"
                      />
                    </td>
                    <td className="px-3">
                      <TripleMetricCell
                        value={batch.avgTestScorePct}
                        caption="Avg assessment score"
                        linked={Boolean(batch.courseId)}
                      />
                    </td>
                    <td className="px-3">
                      <p className="font-mono text-[12px] text-[var(--admin-on-surface)]">
                        {batch.startsAt || batch.endsAt
                          ? `${formatDate(batch.startsAt, viewer)} → ${formatDate(batch.endsAt, viewer)}`
                          : "-"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--admin-on-surface-variant)]">
                        {windowCaption(batch, viewer.now)}
                      </p>
                      {progress != null ? (
                        <div className="mt-1 h-[3px] w-28 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                          <div
                            className="h-full rounded-full bg-[var(--admin-primary)]"
                            style={{ width: `${String(progress)}%` }}
                          />
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3">
                      <p className="text-sm text-[var(--admin-on-surface)]">
                        {formatRelative(batch.lastActivityAt, viewer)}
                      </p>
                      <p className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                        {formatDateTime(batch.lastActivityAt, viewer)}
                      </p>
                    </td>
                    <td
                      className="relative px-3"
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                    >
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
                        aria-label={`Actions for ${batch.name}`}
                        onClick={() => {
                          setRowMenuId((current) => (current === batch.id ? null : batch.id));
                        }}
                      >
                        <MoreVertical className="h-4 w-4" aria-hidden="true" />
                      </button>
                      {rowMenuId === batch.id ? (
                        <div className="absolute right-3 top-10 z-20 w-48 overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 shadow-lg">
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                            onClick={() => {
                              openBatch(batch);
                            }}
                          >
                            Open report
                          </button>
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                            onClick={() => void handleExport(batch.id)}
                          >
                            Export batch
                          </button>
                          <Link
                            href="/admin/batches"
                            className="block w-full px-3 py-2 text-left text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                          >
                            Open batch settings
                          </Link>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalCount > 0 ? (
        <div className="flex flex-col gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
              Showing {rangeStart}-{rangeEnd} of {totalCountLabel} batches
            </p>
            <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
              At risk: any metric below 40% or no activity in 14 days. Critical: two or more metrics
              below 40%.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={ghostButtonClassName}
              disabled={page <= 1 || loading}
              onClick={() => {
                setPage((current) => Math.max(1, current - 1));
              }}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="font-mono text-xs text-[var(--admin-on-surface)]">
              {page} / {Math.max(totalPages, 1)}
            </span>
            <button
              type="button"
              className={ghostButtonClassName}
              disabled={page >= totalPages || loading || totalPages === 0}
              onClick={() => {
                setPage((current) => current + 1);
              }}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** The breadcrumb and heading once the operator drills into a batch. */
export function BatchDrillHeader({ view }: { view: BatchesRosterView }) {
  const {
    detail,
    error,
    goBack,
    learnerDetail,
    level,
    loadLearners,
    selectedBatch,
    setDetail,
    setLearnerDetail,
    setLearners,
    setLevel,
    setPage,
    setSelectedBatch,
  } = view;
  return (
    <>
      {level !== "batches" ? (
        <>
          <nav
            className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]"
            aria-label="Breadcrumb"
          >
            <Link href="/admin" className="hover:text-[var(--admin-primary)]">
              Admin
            </Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <button
              type="button"
              className="hover:text-[var(--admin-primary)]"
              onClick={() => {
                setSelectedBatch(null);
                setDetail(null);
                setLearners([]);
                setLearnerDetail(null);
                setPage(1);
                setLevel("batches");
              }}
            >
              Batches
            </button>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            {level === "learners" ? (
              <span className="font-medium text-[var(--admin-on-surface)]">
                {detail?.name ?? selectedBatch?.name ?? "Batch"}
              </span>
            ) : (
              <>
                <button
                  type="button"
                  className="hover:text-[var(--admin-primary)]"
                  onClick={() => {
                    setLearnerDetail(null);
                    setLevel("learners");
                  }}
                >
                  {selectedBatch?.name ?? "Batch"}
                </button>
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="font-medium text-[var(--admin-on-surface)]">
                  {learnerDetail?.learnerName ?? learnerDetail?.email ?? "Learner"}
                </span>
              </>
            )}
          </nav>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={ghostButtonClassName} onClick={goBack}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to {level === "learner_detail" ? "learners" : "batches"}
            </button>
          </div>

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
                <p className="text-sm text-[var(--admin-danger)]">{error}</p>
              </div>
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--admin-danger)] px-4 text-xs font-semibold text-[var(--admin-on-danger)]"
                onClick={() => {
                  if (level === "learners") void loadLearners();
                }}
              >
                Retry
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}

/** One batch's learners, drilled into from the batch list. */
export function BatchLearnersLevel({ view }: { view: BatchesRosterView }) {
  const {
    actionsOpen,
    busy,
    columns,
    detail,
    handleExport,
    handleSendMessage,
    joinedFrom,
    joinedTo,
    learnerName,
    learnerSortBy,
    learnerSortDir,
    learners,
    level,
    loading,
    messageBody,
    messageSubject,
    openLearner,
    page,
    selectedBatch,
    setActionsOpen,
    setColumns,
    setJoinedFrom,
    setJoinedTo,
    setLearnerName,
    setLearnerSortBy,
    setLearnerSortDir,
    setMessageBody,
    setMessageSubject,
    setPage,
    totalCount,
    totalPages,
    viewer,
  } = view;
  return (
    <>
      {level === "learners" && selectedBatch ? (
        <>
          <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
                  {detail?.name ?? selectedBatch.name}
                </h2>
                <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                  {detail?.courseTitle
                    ? `Linked course: ${detail.courseTitle}`
                    : "No linked course - metrics use available learner activity."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  disabled={busy || loading}
                  onClick={() => void handleExport(selectedBatch.id)}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Export CSV
                </button>
                <button
                  type="button"
                  className={ghostButtonClassName}
                  onClick={() => {
                    setActionsOpen((open) => !open);
                  }}
                >
                  {actionsOpen ? "Hide message" : "Send message"}
                </button>
              </div>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-4">
              {[
                {
                  label: "Learners",
                  value: String(detail?.memberCount ?? selectedBatch.memberCount),
                },
                {
                  label: "Avg content completion",
                  value: formatPct(detail?.averages.contentCompletionPct),
                },
                {
                  label: "Avg live attendance",
                  value: formatPct(detail?.averages.liveAttendancePct),
                },
                {
                  label: "Active (14d)",
                  value: String(detail?.averages.activeLearnerCount ?? "-"),
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3"
                >
                  <p className="text-[11px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    {card.label}
                  </p>
                  <p className="mt-1 font-mono text-xl font-semibold text-[var(--admin-on-surface)]">
                    {card.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                Learner name
                <input
                  className={fieldClassName}
                  value={learnerName}
                  onChange={(event) => {
                    setLearnerName(event.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                Joined from
                <input
                  type="date"
                  className={fieldClassName}
                  value={joinedFrom}
                  onChange={(event) => {
                    setJoinedFrom(event.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                Joined to
                <input
                  type="date"
                  className={fieldClassName}
                  value={joinedTo}
                  onChange={(event) => {
                    setJoinedTo(event.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                Sort
                <select
                  className={fieldClassName}
                  value={`${learnerSortBy}:${learnerSortDir}`}
                  onChange={(event) => {
                    const [nextSort, nextDir] = event.target.value.split(":");
                    setLearnerSortBy(nextSort ?? "joined_at");
                    setLearnerSortDir(nextDir === "asc" ? "asc" : "desc");
                  }}
                >
                  <option value="joined_at:desc">Joined · newest</option>
                  <option value="joined_at:asc">Joined · oldest</option>
                  <option value="activity_at:desc">Activity · recent</option>
                  <option value="content_completion_pct:desc">Completion · high</option>
                  <option value="live_attendance_pct:desc">Attendance · high</option>
                  <option value="test_score_pct:desc">Test · high</option>
                  <option value="learner_name:asc">Name · A-Z</option>
                </select>
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-3">
              {BATCH_LEARNER_COLUMN_OPTIONS.map((column) => (
                <label
                  key={column.key}
                  className="flex items-center gap-2 text-xs text-[var(--admin-on-surface)]"
                >
                  <input
                    type="checkbox"
                    className="accent-[var(--admin-primary)]"
                    checked={columns.includes(column.key)}
                    onChange={(event) => {
                      setColumns((current) => {
                        if (event.target.checked) return [...current, column.key];
                        return current.filter((key) => key !== column.key);
                      });
                    }}
                  />
                  {column.label}
                </label>
              ))}
            </div>

            {actionsOpen ? (
              <div className="mt-4 grid gap-3 border-t border-[var(--admin-border)] pt-4">
                <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                  Subject
                  <input
                    className={fieldClassName}
                    value={messageSubject}
                    onChange={(event) => {
                      setMessageSubject(event.target.value);
                    }}
                  />
                </label>
                <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                  Message
                  <textarea
                    className={`${fieldClassName} h-auto py-2`}
                    rows={4}
                    value={messageBody}
                    onChange={(event) => {
                      setMessageBody(event.target.value);
                    }}
                  />
                </label>
                <button
                  type="button"
                  className={primaryButtonClassName}
                  disabled={busy || !messageSubject.trim() || !messageBody.trim()}
                  onClick={() => void handleSendMessage()}
                >
                  Send message
                </button>
              </div>
            ) : null}
          </section>

          <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            {loading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Shimmer key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead>
                    <tr className="h-11 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                      {columns.includes("learner_name") ? (
                        <th className="px-4 py-3">Learner</th>
                      ) : null}
                      {columns.includes("activity_at") ? (
                        <th className="px-4 py-3">Activity</th>
                      ) : null}
                      {columns.includes("live_attendance_pct") ? (
                        <th className="px-4 py-3">Live attendance</th>
                      ) : null}
                      {columns.includes("test_score_pct") ? (
                        <th className="px-4 py-3">Test</th>
                      ) : null}
                      {columns.includes("content_completion_pct") ? (
                        <th className="px-4 py-3">Content</th>
                      ) : null}
                      {columns.includes("joined_at") ? <th className="px-4 py-3">Joined</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {learners.length === 0 ? (
                      <tr>
                        <td
                          className="px-4 py-10 text-center text-[var(--admin-on-surface-variant)]"
                          colSpan={6}
                        >
                          No learners in this batch matched the filters.
                        </td>
                      </tr>
                    ) : (
                      learners.map((learner) => (
                        <tr
                          key={learner.membershipId}
                          className="h-11 cursor-pointer border-b border-[var(--admin-border)] transition-colors last:border-b-0 hover:bg-[var(--admin-surface-high)]"
                          onClick={() => {
                            openLearner(learner);
                          }}
                        >
                          {columns.includes("learner_name") ? (
                            <td className="px-4 py-3 text-[var(--admin-on-surface)]">
                              {learner.learnerName ?? learner.email ?? "Learner"}
                              {columns.includes("email") && learner.email ? (
                                <div className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                  {learner.email}
                                </div>
                              ) : null}
                            </td>
                          ) : null}
                          {columns.includes("activity_at") ? (
                            <td className="px-4 py-3 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                              {formatDateTime(learner.activityAt, viewer)}
                            </td>
                          ) : null}
                          {columns.includes("live_attendance_pct") ? (
                            <td className="px-4 py-3">
                              <TripleMetricCell
                                value={learner.liveAttendancePct}
                                caption={`${String(learner.liveAttendedCount)} of ${String(learner.liveSessionCount)} sessions`}
                              />
                            </td>
                          ) : null}
                          {columns.includes("test_score_pct") ? (
                            <td className="px-4 py-3">
                              <TripleMetricCell
                                value={learner.testScorePct}
                                caption={`${String(learner.testAttemptCount)} attempts`}
                              />
                            </td>
                          ) : null}
                          {columns.includes("content_completion_pct") ? (
                            <td className="px-4 py-3">
                              <TripleMetricCell
                                value={learner.contentCompletionPct}
                                caption={`${String(learner.completedLessons)} of ${String(learner.totalLessons)} lessons`}
                              />
                            </td>
                          ) : null}
                          {columns.includes("joined_at") ? (
                            <td className="px-4 py-3 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                              {formatDateTime(learner.joinedAt, viewer)}
                            </td>
                          ) : null}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                Page {page} of {totalPages} · {totalCount} learners
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={ghostButtonClassName}
                  disabled={page <= 1 || loading}
                  onClick={() => {
                    setPage((current) => Math.max(1, current - 1));
                  }}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className={ghostButtonClassName}
                  disabled={page >= totalPages || loading}
                  onClick={() => {
                    setPage((current) => current + 1);
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}

/** One learner's progress in the batch. */
export function BatchLearnerDetailLevel({ view }: { view: BatchesRosterView }) {
  const { learnerDetail, learnerTab, level, loading, router, setLearnerTab, viewer } = view;
  return (
    <>
      {level === "learner_detail" && learnerDetail ? (
        <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
                {learnerDetail.learnerName ?? learnerDetail.email ?? "Learner"}
              </h2>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                Joined {formatDateTime(learnerDetail.joinedAt, viewer)} · Last activity{" "}
                {formatDateTime(learnerDetail.activityAt, viewer)}
              </p>
            </div>
            <button
              type="button"
              className={ghostButtonClassName}
              onClick={() => {
                router.push(`/admin/members/${learnerDetail.membershipId}`);
              }}
            >
              Open profile
            </button>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
              <p className="text-[11px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                Live attendance
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-[var(--admin-on-surface)]">
                {formatPct(learnerDetail.summary.liveAttendancePct)}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
              <p className="text-[11px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                Test score
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-[var(--admin-on-surface)]">
                {formatPct(learnerDetail.summary.testScorePct)}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
              <p className="text-[11px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                Content completion
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-[var(--admin-on-surface)]">
                {formatPct(learnerDetail.summary.contentCompletionPct)}
              </p>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {(
              [
                ["live", "Live class attendance"],
                ["exams", "Exam"],
                ["course", "Course completion"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={learnerTab === key ? primaryButtonClassName : ghostButtonClassName}
                onClick={() => {
                  setLearnerTab(key);
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Shimmer key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : learnerTab === "live" ? (
            <div className="overflow-hidden rounded-lg border border-[var(--admin-border)]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    <th className="px-4 py-3">Session</th>
                    <th className="px-4 py-3">Scheduled</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {learnerDetail.liveAttendance.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-[var(--admin-on-surface-variant)]" colSpan={5}>
                        No live sessions linked to this batch/course yet.
                      </td>
                    </tr>
                  ) : (
                    learnerDetail.liveAttendance.map((row) => (
                      <tr
                        key={row.liveSessionId}
                        className="border-b border-[var(--admin-border)] last:border-b-0"
                      >
                        <td className="px-4 py-3 text-[var(--admin-on-surface)]">{row.title}</td>
                        <td className="px-4 py-3 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                          {formatDateTime(row.scheduledAt, viewer)}
                        </td>
                        <td className="px-4 py-3 text-[var(--admin-on-surface)]">
                          {titleCase(row.status)}
                        </td>
                        <td className="px-4 py-3 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                          {formatDateTime(row.joinedAt, viewer)}
                        </td>
                        <td className="px-4 py-3 font-mono text-[12px] text-[var(--admin-on-surface)]">
                          {row.durationSeconds == null ? "-" : `${String(row.durationSeconds)}s`}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : learnerTab === "exams" ? (
            <div className="overflow-hidden rounded-lg border border-[var(--admin-border)]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    <th className="px-4 py-3">Assessment</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {learnerDetail.exams.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-[var(--admin-on-surface-variant)]" colSpan={4}>
                        No exam attempts found for this learner in the batch scope.
                      </td>
                    </tr>
                  ) : (
                    learnerDetail.exams.map((row) => (
                      <tr
                        key={row.attemptId}
                        className="border-b border-[var(--admin-border)] last:border-b-0"
                      >
                        <td className="px-4 py-3 text-[var(--admin-on-surface)]">
                          {row.assessmentTitle}
                        </td>
                        <td className="px-4 py-3 text-[var(--admin-on-surface)]">
                          {titleCase(row.attemptStatus)}
                        </td>
                        <td className="px-4 py-3 font-mono text-[var(--admin-on-surface)]">
                          {formatPct(row.scorePct)}
                        </td>
                        <td className="px-4 py-3 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                          {formatDateTime(row.submittedAt, viewer)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[var(--admin-border)]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    <th className="px-4 py-3">Course</th>
                    <th className="px-4 py-3">Completed</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {learnerDetail.courseProgress.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-[var(--admin-on-surface-variant)]" colSpan={4}>
                        No course progress found for this learner.
                      </td>
                    </tr>
                  ) : (
                    learnerDetail.courseProgress.map((row) => (
                      <tr
                        key={row.courseId}
                        className="border-b border-[var(--admin-border)] last:border-b-0"
                      >
                        <td className="px-4 py-3 text-[var(--admin-on-surface)]">
                          {row.courseTitle}
                        </td>
                        <td className="px-4 py-3 font-mono text-[var(--admin-on-surface)]">
                          {row.completedLessons}
                        </td>
                        <td className="px-4 py-3 font-mono text-[var(--admin-on-surface)]">
                          {row.totalLessons}
                        </td>
                        <td className="px-4 py-3">
                          <TripleMetricCell
                            value={row.completionPct}
                            caption={`${String(row.completedLessons)} of ${String(row.totalLessons)} lessons`}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
