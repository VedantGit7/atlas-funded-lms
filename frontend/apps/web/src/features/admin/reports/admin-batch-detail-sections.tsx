"use client";

import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Columns3,
  Download,
  Filter,
  Mail,
  MoreVertical,
  Search,
  Settings2,
  Users,
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
} from "./admin-batches-roster-api";
import {
  type CompletionOp,
  DEFAULT_COLUMNS,
  Shimmer,
  SummaryMetricCard,
  TripleMetricCell,
  fieldClassName,
  formatPct,
  healthLabel,
  healthRailClass,
  learnerInitials,
  metricBarTone,
  secondaryButtonClassName,
  selectClassName,
  statusPillClass,
  titleCase,
} from "./admin-batch-detail-shared";
import type { BatchDetailView, BatchDetailViewReady } from "./use-batch-detail-report";

/** The batch title, its status and course chips, and the actions for the current tab. */
export function BatchDetailHeader({ view }: { view: BatchDetailViewReady }) {
  const {
    activeTab,
    busy,
    columns,
    columnsOpen,
    columnsPanelId,
    columnsRef,
    copiedKey,
    copyBatchKey,
    detail,
    draftColumns,
    formatCount,
    handleExport,
    moveDraftColumn,
    openMessageModal,
    setColumns,
    setColumnsOpen,
    setDraftColumns,
    setPage,
    toggleDraftColumn,
    weekCaption,
  } = view;
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <Link
          href="/admin/reports/batches"
          className="mb-2 inline-flex items-center gap-1 text-sm text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          All batches
        </Link>
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
          {detail.name}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 font-mono text-[11px] text-[var(--admin-on-surface-variant)] transition-colors hover:border-[var(--admin-outline)] hover:text-[var(--admin-on-surface)]"
            onClick={() => void copyBatchKey()}
            title="Copy batch key"
          >
            {copiedKey ? (
              <Check className="h-3.5 w-3.5 text-[var(--admin-success)]" aria-hidden="true" />
            ) : (
              <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {copiedKey ? "Copied" : detail.key}
          </button>
          <span
            className={`inline-flex rounded-md border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.06em] ${statusPillClass(detail.status)}`}
          >
            {titleCase(detail.status)}
          </span>
          <span className="inline-flex rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
            {weekCaption(detail.startsAt, detail.endsAt)}
          </span>
          <span className="inline-flex rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
            {formatCount(detail.memberCount)} learners
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {activeTab === "learners" ? (
          <div className="relative" ref={columnsRef}>
            <button
              type="button"
              className={secondaryButtonClassName}
              aria-expanded={columnsOpen}
              aria-controls={columnsPanelId}
              onClick={() => {
                setDraftColumns(columns);
                setColumnsOpen((open) => !open);
              }}
            >
              <Columns3 className="h-4 w-4" aria-hidden="true" />
              Columns
            </button>
            {columnsOpen ? (
              <div
                id={columnsPanelId}
                className="absolute right-0 top-[calc(100%+8px)] z-40 flex w-[min(360px,calc(100vw-2rem))] flex-col rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-lg"
              >
                <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-4 py-3">
                  <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">
                    Customize columns
                  </h3>
                  <button
                    type="button"
                    className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                    onClick={() => {
                      setColumnsOpen(false);
                    }}
                    aria-label="Close columns"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <ul className="max-h-[320px] space-y-1 overflow-y-auto p-3">
                  {draftColumns.map((key, index) => {
                    const option = BATCH_LEARNER_COLUMN_OPTIONS.find(
                      (column) => column.key === key,
                    );
                    if (!option) return null;
                    return (
                      <li
                        key={key}
                        className="flex items-center gap-2 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1.5"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--admin-primary)]"
                          checked
                          onChange={() => {
                            toggleDraftColumn(key);
                          }}
                          aria-label={`Toggle ${option.label}`}
                        />
                        <span className="min-w-0 flex-1 text-xs text-[var(--admin-on-surface)]">
                          {option.label}
                        </span>
                        <button
                          type="button"
                          className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] disabled:opacity-30"
                          disabled={index === 0}
                          onClick={() => {
                            moveDraftColumn(index, -1);
                          }}
                          aria-label={`Move ${option.label} up`}
                        >
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] disabled:opacity-30"
                          disabled={index === draftColumns.length - 1}
                          onClick={() => {
                            moveDraftColumn(index, 1);
                          }}
                          aria-label={`Move ${option.label} down`}
                        >
                          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                  {BATCH_LEARNER_COLUMN_OPTIONS.filter(
                    (column) => !draftColumns.includes(column.key),
                  ).map((column) => (
                    <li
                      key={column.key}
                      className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 hover:border-[var(--admin-border)] hover:bg-[var(--admin-surface-low)]"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--admin-primary)]"
                        checked={false}
                        onChange={() => {
                          toggleDraftColumn(column.key);
                        }}
                        aria-label={`Toggle ${column.label}`}
                      />
                      <span className="text-xs text-[var(--admin-on-surface-variant)]">
                        {column.label}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between border-t border-[var(--admin-border)] px-4 py-3">
                  <button
                    type="button"
                    className="text-xs font-medium text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                    onClick={() => {
                      setDraftColumns(DEFAULT_COLUMNS);
                    }}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    className={primaryButtonClassName}
                    onClick={() => {
                      setColumns(draftColumns);
                      setColumnsOpen(false);
                      setPage(1);
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          className={secondaryButtonClassName}
          disabled={busy}
          onClick={() => void handleExport()}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Export CSV
        </button>
        <Link href="/admin/batches" className={secondaryButtonClassName}>
          <Settings2 className="h-4 w-4" aria-hidden="true" />
          Batch Settings
        </Link>
        <button
          type="button"
          className={primaryButtonClassName}
          onClick={() => {
            openMessageModal();
          }}
        >
          <Mail className="h-4 w-4" aria-hidden="true" />
          Message Learners
        </button>
      </div>
    </div>
  );
}

/** Summary metrics, the cohort trend and the score distribution. */
export function BatchOverviewTab({ view }: { view: BatchDetailViewReady }) {
  const {
    activeTab,
    batchId,
    cohortTrend,
    detail,
    formatCount,
    formatDateTime,
    goToAtRiskLearners,
    maxTrendValue,
    passMark,
    router,
    scoreDistribution,
    scoreTotal,
  } = view;
  return (
    <>
      {activeTab === "overview" ? (
        <>
          <div className="grid gap-3 md:grid-cols-5">
            <SummaryMetricCard
              label="Content completion"
              value={formatPct(detail.averages.contentCompletionPct)}
              caption={`Average across ${formatCount(detail.memberCount)} learners`}
              barValue={detail.averages.contentCompletionPct}
              passMark={passMark}
              span2
            />
            <SummaryMetricCard
              label="Live attendance"
              value={formatPct(detail.averages.liveAttendancePct)}
              caption={`${detail.averages.liveSessionHeldCount} of ${detail.averages.liveSessionTotalCount} sessions held`}
              barValue={detail.averages.liveAttendancePct}
              passMark={passMark}
            />
            <SummaryMetricCard
              label="Avg test score"
              value={formatPct(detail.averages.testScorePct)}
              caption={
                detail.averages.passMarkPct != null
                  ? `Pass mark ${formatPct(detail.averages.passMarkPct)}`
                  : "Average assessment score"
              }
              barValue={detail.averages.testScorePct}
              passMark={passMark}
            />
            <div className="grid gap-3">
              <SummaryMetricCard
                label="Active (14d)"
                value={String(detail.averages.activeLearnerCount)}
                caption={`of ${formatCount(detail.memberCount)} learners`}
              />
              <SummaryMetricCard
                label="At risk"
                value={String(detail.averages.atRiskCount)}
                caption="Needs attention"
                warning
                onClick={goToAtRiskLearners}
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-12">
            <div className="flex flex-col gap-4 lg:col-span-7">
              <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                    Cohort trend
                  </h2>
                  <div className="flex flex-wrap gap-3 text-[11px] text-[var(--admin-on-surface-variant)]">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm bg-[var(--admin-primary)]" />
                      Attendance
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm bg-[color-mix(in_srgb,var(--admin-primary)_55%,var(--admin-outline))]" />
                      Completion
                    </span>
                  </div>
                </div>
                {cohortTrend.length === 0 ? (
                  <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 text-center text-sm text-[var(--admin-on-surface-variant)]">
                    No cohort trend data for this batch window yet.
                  </div>
                ) : (
                  <div className="flex h-48 items-end gap-2">
                    {cohortTrend.map((point) => {
                      const attendance = point.liveAttendancePct ?? 0;
                      const completion = point.contentCompletionPct ?? 0;
                      return (
                        <div
                          key={point.weekStart}
                          className="flex min-w-0 flex-1 flex-col items-center gap-2"
                          title={`${point.weekLabel}: attendance ${formatPct(point.liveAttendancePct)}, completion ${formatPct(point.contentCompletionPct)}`}
                        >
                          <div className="flex h-36 w-full items-end justify-center gap-0.5">
                            <div
                              className="w-[42%] rounded-t-sm bg-[var(--admin-primary)] transition-[height] duration-200"
                              style={{
                                height: `${Math.max(4, (attendance / maxTrendValue) * 100)}%`,
                              }}
                            />
                            <div
                              className="w-[42%] rounded-t-sm bg-[color-mix(in_srgb,var(--admin-primary)_55%,var(--admin-outline))] transition-[height] duration-200"
                              style={{
                                height: `${Math.max(4, (completion / maxTrendValue) * 100)}%`,
                              }}
                            />
                          </div>
                          <span className="truncate font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                            {point.weekLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                <h2 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">
                  Score distribution
                </h2>
                {scoreDistribution.length === 0 || scoreTotal === 0 ? (
                  <p className="text-sm text-[var(--admin-on-surface-variant)]">
                    No test scores recorded for this batch yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {scoreDistribution.map((bucket) => {
                      const width =
                        scoreTotal > 0 ? Math.round((bucket.count / scoreTotal) * 100) : 0;
                      return (
                        <div key={bucket.bucket}>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="text-[var(--admin-on-surface)]">{bucket.label}</span>
                            <span className="font-mono text-[var(--admin-on-surface-variant)]">
                              {bucket.count}
                            </span>
                          </div>
                          <div className="h-[3px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                            <div
                              className={[
                                "h-full rounded-full",
                                bucket.bucket === "above_80"
                                  ? "bg-[var(--admin-success)]"
                                  : bucket.bucket === "from_60_to_80"
                                    ? "bg-[var(--admin-warning)]"
                                    : "bg-[var(--admin-danger)]",
                              ].join(" ")}
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <div className="flex flex-col gap-4 lg:col-span-5">
              <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                    Needs attention
                  </h2>
                  <button
                    type="button"
                    className="text-xs font-medium text-[var(--admin-primary)] hover:underline"
                    onClick={goToAtRiskLearners}
                  >
                    View roster
                  </button>
                </div>
                {detail.overview.needsAttention.length === 0 ? (
                  <p className="text-sm text-[var(--admin-on-surface-variant)]">
                    No learners currently need attention.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {detail.overview.needsAttention.map((item) => (
                      <li key={item.membershipId}>
                        <button
                          type="button"
                          className="relative flex w-full items-start gap-3 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 text-left transition-colors hover:bg-[var(--admin-surface-high)]"
                          onClick={() => {
                            router.push(
                              `/admin/reports/batches/${batchId}/learners/${item.membershipId}`,
                            );
                          }}
                        >
                          <span
                            className={`absolute bottom-0 left-0 top-0 w-1 ${healthRailClass(item.health)}`}
                            aria-hidden="true"
                          />
                          <div className="min-w-0 flex-1 pl-1">
                            <p className="truncate text-sm font-medium text-[var(--admin-on-surface)]">
                              {item.learnerName ?? item.email ?? "Learner"}
                            </p>
                            <p className="mt-0.5 text-[11px] text-[var(--admin-on-surface-variant)]">
                              {item.reason}
                            </p>
                            <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                              <div
                                className={`h-full rounded-full ${metricBarTone(item.contentCompletionPct, passMark)}`}
                                style={{
                                  width: `${Math.max(0, Math.min(100, item.contentCompletionPct ?? 0))}%`,
                                }}
                              />
                            </div>
                          </div>
                          <span className="shrink-0 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                            {healthLabel(item.health)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                    Upcoming sessions
                  </h2>
                  <Link
                    href={`/admin/reports/batches/${batchId}/live-sessions`}
                    className="text-xs font-medium text-[var(--admin-primary)] hover:underline"
                  >
                    View all
                  </Link>
                </div>
                {detail.overview.upcomingSessions.length === 0 ? (
                  <p className="text-sm text-[var(--admin-on-surface-variant)]">
                    No upcoming live sessions scheduled for this batch.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {detail.overview.upcomingSessions.map((session) => (
                      <li
                        key={session.liveSessionId}
                        className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2"
                      >
                        <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                          {session.title}
                        </p>
                        <p className="mt-1 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                          {formatDateTime(session.scheduledAt)}
                          {session.durationMinutes != null ? ` · ${session.durationMinutes}m` : ""}
                          {" · "}
                          {titleCase(session.status)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

/** Search, filters, sort and the column picker above the learner table. */
export function BatchLearnerFilters({ view }: { view: BatchDetailView }) {
  const {
    applySearch,
    clearLearnerFilters,
    completionOp,
    completionValue,
    draftSearch,
    hasLearnerFilters,
    healthFilter,
    joinedFrom,
    joinedTo,
    learnerName,
    searchId,
    setCompletionOp,
    setCompletionValue,
    setDraftSearch,
    setHealthFilter,
    setJoinedFrom,
    setJoinedTo,
    setLearnerName,
    setPage,
    setSortBy,
    setSortDir,
    sortBy,
    sortDir,
  } = view;
  return (
    <div className="sticky top-0 z-20 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative flex min-w-0 flex-1 items-center" htmlFor={searchId}>
          <Search
            className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <input
            id={searchId}
            className={`${fieldClassName} w-full pl-9`}
            placeholder="Search learner name"
            value={draftSearch}
            onChange={(event) => {
              setDraftSearch(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") applySearch();
            }}
          />
        </label>
        <label className="grid gap-1 text-[11px] text-[var(--admin-on-surface-variant)]">
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
        <label className="grid gap-1 text-[11px] text-[var(--admin-on-surface-variant)]">
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
        <div className="flex items-end gap-2">
          <label className="grid gap-1 text-[11px] text-[var(--admin-on-surface-variant)]">
            Completion
            <Select
              className={selectClassName}
              value={completionOp}
              onValueChange={(value) => {
                setCompletionOp(value as CompletionOp);
                setPage(1);
              }}
              options={[
                { value: "gte", label: "≥" },
                { value: "lte", label: "≤" },
              ]}
              ariaLabel="Completion comparison"
            />
          </label>
          <input
            type="number"
            min={0}
            max={100}
            className={`${fieldClassName} w-20`}
            placeholder="%"
            value={completionValue}
            onChange={(event) => {
              setCompletionValue(event.target.value);
              setPage(1);
            }}
            aria-label="Completion percent"
          />
        </div>
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
            setSortBy(nextSort ?? "joined_at");
            setSortDir(nextDir === "asc" ? "asc" : "desc");
            setPage(1);
          }}
          options={[
            { value: "joined_at:desc", label: "Joined · newest" },
            { value: "joined_at:asc", label: "Joined · oldest" },
            { value: "activity_at:desc", label: "Activity · recent" },
            { value: "content_completion_pct:desc", label: "Completion · high" },
            { value: "live_attendance_pct:desc", label: "Attendance · high" },
            { value: "test_score_pct:desc", label: "Test · high" },
            { value: "learner_name:asc", label: "Name · A-Z" },
          ]}
          ariaLabel="Sort"
        />
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] px-3 text-xs font-semibold text-[var(--admin-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_18%,var(--admin-surface))]"
          onClick={applySearch}
        >
          <Filter className="h-3.5 w-3.5" aria-hidden="true" />
          Apply
        </button>
        <button
          type="button"
          className={ghostButtonClassName}
          onClick={clearLearnerFilters}
          title="Clear filters"
        >
          Add filter
        </button>
      </div>
      {hasLearnerFilters ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--admin-border)] pt-3">
          {learnerName ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 text-[11px] text-[var(--admin-on-surface)]"
              onClick={() => {
                setLearnerName("");
                setDraftSearch("");
                setPage(1);
              }}
            >
              Search: {learnerName}
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ) : null}
          {joinedFrom ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 text-[11px]"
              onClick={() => {
                setJoinedFrom("");
                setPage(1);
              }}
            >
              From {joinedFrom}
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ) : null}
          {joinedTo ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 text-[11px]"
              onClick={() => {
                setJoinedTo("");
                setPage(1);
              }}
            >
              To {joinedTo}
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ) : null}
          {completionValue ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 text-[11px]"
              onClick={() => {
                setCompletionValue("");
                setPage(1);
              }}
            >
              Completion {completionOp === "gte" ? "≥" : "≤"} {completionValue}%
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ) : null}
          {healthFilter !== "any" ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 text-[11px]"
              onClick={() => {
                setHealthFilter("any");
                setPage(1);
              }}
            >
              Health:{" "}
              {healthFilter === "needs_attention" ? "At risk + critical" : titleCase(healthFilter)}
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            className="text-xs font-medium text-[var(--admin-primary)] hover:underline"
            onClick={clearLearnerFilters}
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** The learner table, its row menus and the pager. */
export function BatchLearnerTable({ view }: { view: BatchDetailView }) {
  const {
    clearLearnerFilters,
    columns,
    formatCount,
    formatDate,
    formatDateTime,
    formatRelative,
    hasLearnerFilters,
    isStaleActivity,
    learners,
    learnersLoading,
    linkedCourse,
    openLearnerPanel,
    openMessageModal,
    page,
    passMark,
    rangeEnd,
    rangeStart,
    rowMenuId,
    selectedIds,
    setPage,
    setRowMenuId,
    toggleSelect,
    toggleSelectAll,
    totalCount,
    totalPages,
  } = view;
  return (
    <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      {learnersLoading && learners.length === 0 ? (
        <div className="space-y-0">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="relative flex items-center gap-3 border-b border-[var(--admin-border)] px-4 py-3 last:border-b-0"
            >
              <span className="absolute bottom-0 left-0 top-0 w-1 bg-[var(--admin-surface-high)]" />
              <Shimmer className="h-4 w-4" />
              <Shimmer className="h-8 w-8 rounded-full" />
              <Shimmer className="h-4 w-36" />
              <Shimmer className="ml-auto h-4 w-24" />
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="h-11 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                <th className="w-11 px-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--admin-primary)]"
                    checked={learners.length > 0 && selectedIds.length === learners.length}
                    onChange={toggleSelectAll}
                    aria-label="Select all learners on this page"
                  />
                </th>
                {columns.includes("learner_name") ? <th className="px-3">Learner</th> : null}
                {columns.includes("activity_at") ? <th className="px-3">Last activity</th> : null}
                {columns.includes("live_attendance_pct") ? (
                  <th className="px-3">Live attendance</th>
                ) : null}
                {columns.includes("test_score_pct") ? <th className="px-3">Test score</th> : null}
                {columns.includes("content_completion_pct") ? (
                  <th className="px-3">Content</th>
                ) : null}
                {columns.includes("joined_at") ? <th className="px-3">Joined on</th> : null}
                <th className="w-12 px-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {!learnersLoading && learners.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(3, columns.length + 2)} className="p-0">
                    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                        <Users
                          className="h-9 w-9 text-[var(--admin-primary)]"
                          aria-hidden="true"
                          strokeWidth={1.5}
                        />
                      </div>
                      <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
                        {hasLearnerFilters
                          ? "No learners match these filters"
                          : "No learners in this batch"}
                      </h3>
                      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
                        {hasLearnerFilters
                          ? "Adjust search, dates, completion, or health filters to see matching memberships."
                          : "Add members in Batch Settings, then return here to track attendance, scores, and completion."}
                      </p>
                      <div className="mt-6 flex flex-wrap justify-center gap-2">
                        {hasLearnerFilters ? (
                          <button
                            type="button"
                            className={secondaryButtonClassName}
                            onClick={clearLearnerFilters}
                          >
                            Clear filters
                          </button>
                        ) : (
                          <Link href="/admin/batches" className={primaryButtonClassName}>
                            Batch Settings
                          </Link>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                learners.map((learner, index) => {
                  const selected = selectedIds.includes(learner.membershipId);
                  const stale = isStaleActivity(learner.activityAt);
                  return (
                    <tr
                      key={learner.membershipId}
                      className={[
                        "group relative h-11 border-b border-[var(--admin-border)] last:border-b-0",
                        "cursor-pointer transition-colors duration-150",
                        selected
                          ? "bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))]"
                          : "hover:bg-[var(--admin-surface-high)]",
                      ].join(" ")}
                      style={{
                        animationDelay: `${Math.min(index, 11) * 20}ms`,
                      }}
                      onClick={() => {
                        openLearnerPanel(learner);
                      }}
                    >
                      <td
                        className="relative px-3"
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        <span
                          className={`absolute bottom-0 left-0 top-0 w-1 ${healthRailClass(learner.health)}`}
                          aria-hidden="true"
                        />
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--admin-primary)]"
                          checked={selected}
                          onChange={() => {
                            toggleSelect(learner.membershipId);
                          }}
                          aria-label={`Select ${learner.learnerName ?? learner.email ?? "learner"}`}
                        />
                      </td>
                      {columns.includes("learner_name") ? (
                        <td className="px-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface-high)] font-mono text-[11px] font-medium text-[var(--admin-on-surface)]">
                              {learnerInitials(learner.learnerName, learner.email)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-[var(--admin-on-surface)]">
                                {learner.learnerName ?? learner.email ?? "Learner"}
                              </p>
                              {columns.includes("email") && learner.email ? (
                                <p className="truncate font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                  {learner.email}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      ) : null}
                      {columns.includes("activity_at") ? (
                        <td className="px-3">
                          <p
                            className={[
                              "font-mono text-xs",
                              stale
                                ? "text-[var(--admin-danger)]"
                                : "text-[var(--admin-on-surface-variant)]",
                            ].join(" ")}
                          >
                            {formatRelative(learner.activityAt)}
                          </p>
                          <p className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                            {formatDateTime(learner.activityAt)}
                          </p>
                        </td>
                      ) : null}
                      {columns.includes("live_attendance_pct") ? (
                        <td className="px-3">
                          <TripleMetricCell
                            value={learner.liveAttendancePct}
                            caption={`${learner.liveAttendedCount} of ${learner.liveSessionCount} sessions`}
                            passMark={passMark}
                          />
                        </td>
                      ) : null}
                      {columns.includes("test_score_pct") ? (
                        <td className="px-3">
                          <TripleMetricCell
                            value={learner.testScorePct}
                            caption={`${learner.testAttemptCount} attempts`}
                            linked={linkedCourse}
                            passMark={passMark}
                          />
                        </td>
                      ) : null}
                      {columns.includes("content_completion_pct") ? (
                        <td className="px-3">
                          <TripleMetricCell
                            value={learner.contentCompletionPct}
                            caption={`${learner.completedLessons} of ${learner.totalLessons} lessons`}
                            linked={linkedCourse}
                            passMark={passMark}
                          />
                        </td>
                      ) : null}
                      {columns.includes("joined_at") ? (
                        <td className="px-3 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                          {formatDate(learner.joinedAt)}
                        </td>
                      ) : null}
                      <td
                        className="relative px-3"
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        <button
                          type="button"
                          className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
                          aria-label="Row actions"
                          onClick={() => {
                            setRowMenuId((current) =>
                              current === learner.membershipId ? null : learner.membershipId,
                            );
                          }}
                        >
                          <MoreVertical className="h-4 w-4" aria-hidden="true" />
                        </button>
                        {rowMenuId === learner.membershipId ? (
                          <div className="absolute right-3 top-9 z-30 min-w-[180px] rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 shadow-lg">
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                              onClick={() => {
                                openLearnerPanel(learner);
                              }}
                            >
                              View learner report
                            </button>
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                              onClick={() => {
                                openMessageModal([learner.membershipId]);
                              }}
                            >
                              Message learner
                            </button>
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
      )}

      <div className="flex flex-col gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
            Showing {rangeStart}-{rangeEnd} of {formatCount(totalCount)} learners
          </p>
          <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
            <span className="mr-3 inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-1 bg-[var(--admin-warning)]" />
              At risk
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-1 bg-[var(--admin-danger)]" />
              Critical
            </span>
            {" · "}
            At risk: any metric below 40% or no activity in 14 days. Critical: two or more metrics
            below 40%.
          </p>
        </div>
        {totalPages > 1 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={ghostButtonClassName}
              disabled={page <= 1 || learnersLoading}
              onClick={() => {
                setPage((current) => Math.max(1, current - 1));
              }}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              className={ghostButtonClassName}
              disabled={page >= totalPages || learnersLoading}
              onClick={() => {
                setPage((current) => current + 1);
              }}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** The side panel for one learner's live, exam and content progress. */
export function BatchLearnerPanel({ view }: { view: BatchDetailView }) {
  const {
    closeLearnerPanel,
    formatDateTime,
    learnerDetail,
    learnerDetailError,
    learnerDetailLoading,
    learnerPanelTab,
    passMark,
    setLearnerPanelTab,
  } = view;
  return (
    <>
      {learnerDetail ? (
        <aside className="h-fit rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] xl:sticky xl:top-4">
          <div className="flex items-start justify-between gap-2 border-b border-[var(--admin-border)] px-4 py-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-[var(--admin-on-surface)]">
                {learnerDetail.learnerName ?? learnerDetail.email ?? "Learner"}
              </h2>
              <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                {learnerDetail.email ?? "-"}
              </p>
            </div>
            <button
              type="button"
              className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
              onClick={closeLearnerPanel}
              aria-label="Close learner detail"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 border-b border-[var(--admin-border)] p-3">
            <div className="rounded-md bg-[var(--admin-surface-low)] p-2">
              <p className="text-[10px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                Live
              </p>
              <p className="mt-1 font-mono text-sm font-semibold text-[var(--admin-on-surface)]">
                {formatPct(learnerDetail.summary.liveAttendancePct)}
              </p>
            </div>
            <div className="rounded-md bg-[var(--admin-surface-low)] p-2">
              <p className="text-[10px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                Test
              </p>
              <p className="mt-1 font-mono text-sm font-semibold text-[var(--admin-on-surface)]">
                {formatPct(learnerDetail.summary.testScorePct)}
              </p>
            </div>
            <div className="rounded-md bg-[var(--admin-surface-low)] p-2">
              <p className="text-[10px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                Content
              </p>
              <p className="mt-1 font-mono text-sm font-semibold text-[var(--admin-on-surface)]">
                {formatPct(learnerDetail.summary.contentCompletionPct)}
              </p>
            </div>
          </div>

          <div className="flex gap-1 border-b border-[var(--admin-border)] px-2 pt-2">
            {(
              [
                ["live", "Live"],
                ["exams", "Exams"],
                ["course", "Course"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={[
                  "h-8 flex-1 rounded-md text-xs font-semibold transition-colors",
                  learnerPanelTab === key
                    ? "bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]"
                    : "text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]",
                ].join(" ")}
                onClick={() => {
                  setLearnerPanelTab(key);
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="max-h-[480px] overflow-y-auto p-3">
            {learnerDetailError ? (
              <p className="text-sm text-[var(--admin-danger)]">{learnerDetailError}</p>
            ) : null}
            {learnerDetailLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Shimmer key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : learnerPanelTab === "live" ? (
              learnerDetail.liveAttendance.length === 0 ? (
                <p className="text-sm text-[var(--admin-on-surface-variant)]">
                  No live session attendance for this learner in the batch scope.
                </p>
              ) : (
                <ul className="space-y-2">
                  {learnerDetail.liveAttendance.map((session) => (
                    <li
                      key={session.liveSessionId}
                      className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2"
                    >
                      <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                        {session.title}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                        {formatDateTime(session.scheduledAt)} · {titleCase(session.status)}
                      </p>
                    </li>
                  ))}
                </ul>
              )
            ) : learnerPanelTab === "exams" ? (
              learnerDetail.exams.length === 0 ? (
                <p className="text-sm text-[var(--admin-on-surface-variant)]">
                  No exam attempts in the batch scope.
                </p>
              ) : (
                <ul className="space-y-2">
                  {learnerDetail.exams.map((exam) => (
                    <li
                      key={exam.attemptId}
                      className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2"
                    >
                      <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                        {exam.assessmentTitle}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                        {formatPct(exam.scorePct)} · {titleCase(exam.attemptStatus)} ·{" "}
                        {formatDateTime(exam.submittedAt ?? exam.startedAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )
            ) : learnerDetail.courseProgress.length === 0 ? (
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                No course progress found for this learner.
              </p>
            ) : (
              <ul className="space-y-2">
                {learnerDetail.courseProgress.map((course) => (
                  <li
                    key={course.courseId}
                    className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2"
                  >
                    <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                      {course.courseTitle}
                    </p>
                    <TripleMetricCell
                      value={course.completionPct}
                      caption={`${course.completedLessons} of ${course.totalLessons} lessons`}
                      passMark={passMark}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      ) : null}
    </>
  );
}

/** Compose a message to the selected learners or the whole batch. */
export function BatchMessageModal({ view }: { view: BatchDetailView }) {
  const {
    busy,
    handleSendMessage,
    messageBody,
    messageMembershipIds,
    messageOpen,
    messageSubject,
    setMessageBody,
    setMessageOpen,
    setMessageSubject,
  } = view;
  return (
    <>
      {messageOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="batch-message-title"
        >
          <div className="w-full max-w-lg rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-5 py-4">
              <h2
                id="batch-message-title"
                className="text-base font-semibold text-[var(--admin-on-surface)]"
              >
                Message learners
              </h2>
              <button
                type="button"
                className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                onClick={() => {
                  setMessageOpen(false);
                }}
                aria-label="Close message dialog"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                {messageMembershipIds
                  ? `Sending to ${messageMembershipIds.length} selected learner${messageMembershipIds.length === 1 ? "" : "s"}.`
                  : "Sending to learners matching the current batch filters (or the full roster)."}
              </p>
              <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                Subject
                <input
                  className={fieldClassName}
                  value={messageSubject}
                  onChange={(event) => {
                    setMessageSubject(event.target.value);
                  }}
                  maxLength={200}
                />
              </label>
              <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                Message
                <textarea
                  className={`${fieldClassName} h-auto min-h-[120px] py-2`}
                  rows={5}
                  value={messageBody}
                  onChange={(event) => {
                    setMessageBody(event.target.value);
                  }}
                  maxLength={10000}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--admin-border)] px-5 py-4">
              <button
                type="button"
                className={ghostButtonClassName}
                onClick={() => {
                  setMessageOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={primaryButtonClassName}
                disabled={busy || !messageSubject.trim() || !messageBody.trim()}
                onClick={() => void handleSendMessage()}
              >
                {busy ? "Sending…" : "Send message"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
