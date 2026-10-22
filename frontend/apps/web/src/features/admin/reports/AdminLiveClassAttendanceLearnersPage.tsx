"use client";

import Link from "next/link";
import { AlertCircle, ChevronRight, Presentation, Users } from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import type { ReportInitialDataInRange } from "../../../lib/server/report-initial-data";
import { type LiveLearnersPayload } from "./admin-live-class-attendance-roster-api";
import {
  AttendanceMatrix,
  LearnersLoadingSkeleton,
  ModuleTabs,
  RemindModal,
  fieldClassName,
} from "./admin-live-class-attendance-learners-shared";
import {
  LearnersFilters,
  LearnersSummary,
  LearnersTable,
  LearnersToolbar,
} from "./admin-live-class-attendance-learners-sections";
import { useLiveClassAttendanceLearners } from "./use-live-class-attendance-learners";

export function AdminLiveClassAttendanceLearnersPage(
  props: {
    /** The first page over the last 30 days, loaded by the server; the first browser load is skipped when present. */
    initialLearners?: ReportInitialDataInRange<LiveLearnersPayload> | null;
  } = {},
) {
  const view = useLiveClassAttendanceLearners(props);
  const {
    clearFilters,
    datePreset,
    error,
    formatCount,
    handleSendMessage,
    hasActiveFilters,
    learners,
    loadLearners,
    loading,
    matrix,
    matrixLoading,
    openSelectedMessage,
    page,
    remindBody,
    remindBusy,
    remindCount,
    remindError,
    remindOpen,
    remindSubject,
    remindTitle,
    resetFiltersAndRange,
    scheduledFrom,
    scheduledTo,
    selectedIds,
    setPage,
    setRemindBody,
    setRemindOpen,
    setRemindSubject,
    setScheduledFrom,
    setScheduledTo,
    setSelectedIds,
    setViewMode,
    totalCount,
    totalPages,
    viewMode,
  } = view;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
      <nav
        className="flex flex-wrap items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]"
        aria-label="Breadcrumb"
      >
        <Link href="/admin" className="hover:text-[var(--admin-primary-strong)]">
          Admin
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href="/admin/reports" className="hover:text-[var(--admin-primary-strong)]">
          Reports
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link
          href="/admin/reports/live-class-attendance"
          className="hover:text-[var(--admin-primary-strong)]"
        >
          Live Class Attendance
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="text-[var(--admin-on-surface)]">Learners</span>
      </nav>

      <LearnersToolbar view={view} />

      {datePreset === "custom" ? (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
          <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
            From
            <input
              type="date"
              className={fieldClassName}
              value={scheduledFrom}
              onChange={(event) => {
                setScheduledFrom(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
            To
            <input
              type="date"
              className={fieldClassName}
              value={scheduledTo}
              onChange={(event) => {
                setScheduledTo(event.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
      ) : null}

      <ModuleTabs active="learners" />

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-danger)]">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error.includes("Couldn't load") ? "Couldn't load learners." : error}</span>
          </div>
          <button
            type="button"
            className="rounded-lg border border-[var(--admin-danger)] bg-transparent px-3 py-1 text-sm font-semibold text-[var(--admin-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)]"
            onClick={() => void loadLearners()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading && learners.length === 0 && !error ? (
        <LearnersLoadingSkeleton />
      ) : !loading && learners.length === 0 && !error ? (
        <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
              <Users className="h-7 w-7 text-[var(--admin-outline)]" aria-hidden="true" />
            </div>
            <h2 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
              No learners registered for sessions in this range
            </h2>
            <p className="mb-6 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
              Try widening the date range or clearing filters to see registered learners.
            </p>
            <button type="button" className={primaryButtonClassName} onClick={resetFiltersAndRange}>
              Reset filters
            </button>
          </div>
        </section>
      ) : (
        <>
          <LearnersSummary view={view} />

          <p className="text-xs italic text-[var(--admin-on-surface-variant)]">
            Attendance rate is sessions attended divided by sessions registered.
          </p>

          {selectedIds.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] px-4 py-3">
              <p className="text-sm text-[var(--admin-on-surface)]">
                <span className="font-semibold">{formatCount(selectedIds.size)}</span> learner
                {selectedIds.size === 1 ? "" : "s"} selected
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={primaryButtonClassName}
                  onClick={() => {
                    openSelectedMessage(Array.from(selectedIds));
                  }}
                >
                  Message selected
                </button>
                <button
                  type="button"
                  className={ghostButtonClassName}
                  onClick={() => {
                    setSelectedIds(new Set());
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className="inline-flex rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-0.5"
              role="tablist"
              aria-label="View mode"
            >
              {(
                [
                  ["list", "List"],
                  ["matrix", "Matrix"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={viewMode === mode}
                  className={[
                    "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                    viewMode === mode
                      ? "bg-[var(--admin-surface)] text-[var(--admin-primary)] shadow-sm"
                      : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                  ].join(" ")}
                  onClick={() => {
                    setViewMode(mode);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {viewMode === "matrix" ? (
              <p className="text-xs text-[var(--admin-on-surface-variant)] lg:hidden">
                Open on a larger screen to see the attendance matrix
              </p>
            ) : null}
          </div>

          {viewMode === "matrix" ? (
            <AttendanceMatrix matrix={matrix} loading={matrixLoading} />
          ) : null}

          {viewMode === "list" ? (
            <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
              <LearnersFilters view={view} />

              {hasActiveFilters ? (
                <div className="flex flex-wrap items-center gap-2 border-b border-[var(--admin-border)] px-4 py-3">
                  <button type="button" className={ghostButtonClassName} onClick={clearFilters}>
                    Clear filters
                  </button>
                </div>
              ) : null}

              <LearnersTable view={view} />

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] px-4 py-3">
                <p className="text-xs text-[var(--admin-on-surface-variant)]">
                  Showing{" "}
                  <span className="font-mono">
                    {totalCount === 0
                      ? "0"
                      : `${String((page - 1) * 25 + 1)}-${String((page - 1) * 25 + learners.length)}`}
                  </span>{" "}
                  of <span className="font-mono">{formatCount(totalCount)}</span> learners
                </p>
                {totalPages > 1 ? (
                  <div className="flex items-center gap-2">
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
                    <span className="text-sm text-[var(--admin-on-surface-variant)]">
                      Page {page} of {totalPages}
                    </span>
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
                ) : null}
              </div>
            </section>
          ) : null}
        </>
      )}

      <section className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-8 text-center lg:hidden">
        <Presentation className="mb-2 h-6 w-6 text-[var(--admin-outline)]" aria-hidden="true" />
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          Open on a larger screen to see the attendance matrix
        </p>
      </section>

      <RemindModal
        open={remindOpen}
        title={remindTitle}
        count={remindCount}
        subject={remindSubject}
        body={remindBody}
        busy={remindBusy}
        error={remindError}
        onSubjectChange={setRemindSubject}
        onBodyChange={setRemindBody}
        onClose={() => {
          if (!remindBusy) setRemindOpen(false);
        }}
        onSend={() => void handleSendMessage()}
      />
    </div>
  );
}
