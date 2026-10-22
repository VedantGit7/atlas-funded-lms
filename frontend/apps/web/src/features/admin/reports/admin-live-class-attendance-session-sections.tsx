"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  Columns3,
  Download,
  Mail,
  PlayCircle,
  Presentation,
  Search,
  Users,
} from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import {
  DropdownField,
  dropdownItemClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import { LIVE_ATTENDANCE_COLUMN_OPTIONS } from "./admin-live-class-attendance-roster-api";
import {
  AttendanceTimelineChart,
  MetricBar,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  Shimmer,
  StatusPill,
  attendeeStatusTone,
  coveragePct,
  fieldClassName,
  formatDuration,
  formatPct,
  isLiveMonitorEligible,
  metricBarTone,
  secondaryButtonClassName,
  sessionStatusLabel,
  sessionStatusTone,
  titleCase,
} from "./admin-live-class-attendance-session-shared";
import type { LiveClassAttendanceSessionViewReady } from "./use-live-class-attendance-session";

/** The session title, its status and the actions on it. */
export function SessionHeader({
  view,
}: {
  view: LiveClassAttendanceSessionViewReady & {
    primaryMessageDisabled: boolean;
    primaryMessageLabel: string;
  };
}) {
  const {
    attendeesLoading,
    busy,
    columns,
    columnsLabelId,
    columnsOpen,
    detail,
    handleExport,
    openMessageDrawer,
    primaryMessageDisabled,
    primaryMessageLabel,
    scheduled,
    sessionId,
    setColumnsOpen,
    setSortOpen,
    setStatusOpen,
    toggleColumn,
  } = view;
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
            {detail.title}
          </h1>
          <StatusPill tone={sessionStatusTone(detail.status)}>
            {sessionStatusLabel(detail.status)}
          </StatusPill>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--admin-on-surface-variant)]">
          <span className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1">
            {detail.courseTitle ?? "No linked course"}
          </span>
          <span className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1">
            {detail.batchName ?? "No linked batch"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[140px]">
          <DropdownField
            label={<span className="sr-only">Columns</span>}
            labelId={columnsLabelId}
            open={columnsOpen}
            onToggle={() => {
              setColumnsOpen((open) => !open);
              setStatusOpen(false);
              setSortOpen(false);
            }}
            triggerContent={
              <span className="flex w-full items-center gap-2 text-[13px] font-medium text-[var(--admin-on-surface)]">
                <Columns3
                  className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
                <span className="flex-1 text-left">Columns</span>
                <ChevronDown
                  className={`h-4 w-4 text-[var(--admin-on-surface-variant)] transition-transform duration-200 ${columnsOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </span>
            }
            panelAriaLabel="Visible columns"
          >
            <div className="space-y-1 p-2" role="group" aria-label="Column checkboxes">
              {LIVE_ATTENDANCE_COLUMN_OPTIONS.map((column) => {
                const checked = columns.includes(column.key);
                return (
                  <label
                    key={column.key}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--admin-primary)]"
                      checked={checked}
                      disabled={checked && columns.length === 1}
                      onChange={() => {
                        toggleColumn(column.key);
                      }}
                    />
                    {column.label}
                  </label>
                );
              })}
            </div>
          </DropdownField>
        </div>

        <button
          type="button"
          className={secondaryButtonClassName}
          disabled={busy || attendeesLoading}
          onClick={() => void handleExport()}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Export CSV
        </button>

        {isLiveMonitorEligible(detail.status) ? (
          <Link
            href={`/admin/reports/live-class-attendance/${sessionId}/live`}
            className={secondaryButtonClassName}
          >
            <Activity className="h-4 w-4" aria-hidden="true" />
            Live monitor
          </Link>
        ) : null}

        {detail.recordingUrl ? (
          <a
            href={detail.recordingUrl}
            target="_blank"
            rel="noreferrer"
            className={secondaryButtonClassName}
          >
            <PlayCircle className="h-4 w-4" aria-hidden="true" />
            Open recording
          </a>
        ) : (
          <button type="button" className={secondaryButtonClassName} disabled>
            <PlayCircle className="h-4 w-4" aria-hidden="true" />
            Open recording
          </button>
        )}

        <button
          type="button"
          className={primaryButtonClassName}
          disabled={busy || primaryMessageDisabled}
          onClick={() => {
            openMessageDrawer(scheduled ? "registrants" : "absentees");
          }}
        >
          <Mail className="h-4 w-4" aria-hidden="true" />
          {primaryMessageLabel}
        </button>
      </div>
    </div>
  );
}

/** Attendance, duration and engagement figures for the session. */
export function SessionKpis({ view }: { view: LiveClassAttendanceSessionViewReady }) {
  const { avgCoverage, cancelled, detail, filterAbsentees, formatCount, formatTimeOnly, rate } =
    view;
  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-sm border border-[var(--admin-border)] md:grid-cols-6 md:gap-px md:bg-[var(--admin-border)]">
      <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5 md:col-span-2">
        <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
          Attendance
        </p>
        <p className="font-mono text-[32px] font-medium leading-none text-[var(--admin-on-surface)]">
          {cancelled ? (
            "-"
          ) : (
            <>
              {formatCount(detail.attendanceCount)}
              <span className="text-sm font-normal text-[var(--admin-on-surface-variant)]">
                {" "}
                of {formatCount(detail.registeredCount)}
              </span>
            </>
          )}
        </p>
        {!cancelled ? (
          <div className="mt-3">
            <MetricBar pct={rate} tone={metricBarTone(rate)} />
          </div>
        ) : null}
        <p className="mt-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
          {cancelled ? "-" : `${formatPct(rate)} of registrations`}
        </p>
      </div>

      <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5">
        <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-danger)]">
          Absentees
        </p>
        {cancelled ? (
          <p className="font-mono text-2xl font-medium leading-none text-[var(--admin-on-surface)]">
            -
          </p>
        ) : (
          <button
            type="button"
            className="w-fit font-mono text-2xl font-medium leading-none text-[var(--admin-danger)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
            onClick={filterAbsentees}
          >
            {formatCount(detail.absentCount)}
          </button>
        )}
        <p className="mt-2 flex items-center gap-1 text-xs text-[var(--admin-danger)]">
          {cancelled ? (
            "-"
          ) : detail.absentCount > 0 ? (
            <>
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              Action required
            </>
          ) : (
            "All registrants attended"
          )}
        </p>
      </div>

      <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5 md:col-span-2">
        <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
          Average duration
        </p>
        <p className="font-mono text-2xl font-medium leading-none text-[var(--admin-on-surface)]">
          {cancelled ? "-" : formatDuration(detail.avgDurationSeconds)}
        </p>
        {!cancelled ? (
          <div className="mt-3">
            <MetricBar pct={avgCoverage} tone={metricBarTone(avgCoverage)} />
          </div>
        ) : null}
        <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
          {cancelled
            ? "-"
            : `${formatPct(avgCoverage)} of ${formatDuration(detail.durationSeconds)} session`}
        </p>
      </div>

      <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5">
        <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
          Timeline
        </p>
        <div className="space-y-1.5 font-mono text-xs text-[var(--admin-on-surface)]">
          <p>
            <span className="text-[var(--admin-on-surface-variant)]">Scheduled </span>
            {formatTimeOnly(detail.scheduledAt)}
          </p>
          <p
            className={
              detail.startDelayMinutes != null && detail.startDelayMinutes > 5
                ? "text-[var(--admin-warning)]"
                : undefined
            }
          >
            <span className="text-[var(--admin-on-surface-variant)]">Started </span>
            {cancelled ? "-" : formatTimeOnly(detail.startedAt)}
            {detail.startDelayMinutes != null && detail.startDelayMinutes > 5 ? (
              <span className="mt-0.5 block text-[11px]">
                started {detail.startDelayMinutes} minutes late
              </span>
            ) : null}
          </p>
          <p>
            <span className="text-[var(--admin-on-surface-variant)]">Ended </span>
            {cancelled ? "-" : formatTimeOnly(detail.endedAt)}
          </p>
        </div>
      </div>
    </div>
  );
}

/** What the session's state allows: cancelled, not started, live or ended with a timeline. */
export function SessionStatusPanel({ view }: { view: LiveClassAttendanceSessionViewReady }) {
  const {
    cancelled,
    detail,
    formatCount,
    formatDate,
    formatTimeOnly,
    openMessageDrawer,
    plannedMinutes,
    scheduled,
    showTimeline,
  } = view;
  return (
    <>
      {cancelled ? (
        <section className="rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-6 py-8">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-base font-semibold text-[var(--admin-danger)]">
                This session was cancelled on {formatDate(detail.cancelledAt ?? detail.scheduledAt)}
              </h2>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                Registration list remains available. Attendance metrics are shown as dashes.
              </p>
            </div>
          </div>
        </section>
      ) : scheduled ? (
        <section className="rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-10">
          <div className="mx-auto flex max-w-lg flex-col items-center text-center">
            <Users className="mb-3 h-8 w-8 text-[var(--admin-outline)]" aria-hidden="true" />
            <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
              This session has not started yet
            </h2>
            {detail.expectedTurnoutCount != null || detail.expectedTurnoutPct != null ? (
              <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
                Expected turnout{" "}
                {detail.expectedTurnoutCount != null
                  ? formatCount(detail.expectedTurnoutCount)
                  : "-"}
                {detail.expectedTurnoutPct != null
                  ? ` (${formatPct(detail.expectedTurnoutPct)})`
                  : ""}
              </p>
            ) : (
              <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
                Timeline will appear after this session is held.
              </p>
            )}
            <button
              type="button"
              className={`${primaryButtonClassName} mt-5`}
              disabled={detail.registeredCount === 0}
              onClick={() => {
                openMessageDrawer("registrants");
              }}
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              Message registrants
            </button>
          </div>
        </section>
      ) : showTimeline ? (
        <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--admin-on-surface)]">
              Attendance timeline
            </h2>
            <div className="flex items-center gap-4 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full bg-[var(--admin-primary)]"
                  aria-hidden="true"
                />
                Attendees
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-px bg-[var(--admin-danger)]" aria-hidden="true" />
                Drops
              </span>
              <span>· {detail.timeline.bucketMinutes}m buckets</span>
            </div>
          </div>
          <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-2">
            <AttendanceTimelineChart
              points={detail.timeline.points}
              dropInsight={detail.timeline.dropInsight}
              plannedMinutes={plannedMinutes}
            />
          </div>
          <p className="mt-3 text-center text-sm text-[var(--admin-on-surface-variant)]">
            Peak {detail.peakConcurrent ?? "-"} concurrent
            {detail.peakConcurrentAt ? ` at ${formatTimeOnly(detail.peakConcurrentAt)}` : ""}
            {detail.timeline.dropInsight ? (
              <>
                {" · "}
                <span className="font-medium text-[var(--admin-danger)]">
                  {detail.timeline.dropInsight.message}
                </span>
              </>
            ) : null}
          </p>
        </section>
      ) : (
        <section className="rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-10 text-center">
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            No concurrent attendance timeline was recorded for this session.
          </p>
        </section>
      )}
    </>
  );
}

/** The attendee filters, table, selection and pager. */
export function SessionAttendees({ view }: { view: LiveClassAttendanceSessionViewReady }) {
  const {
    applyFilters,
    attendees,
    attendeesLoading,
    cancelled,
    columns,
    detail,
    draftEmail,
    draftJoinedFrom,
    draftJoinedTo,
    draftLearnerName,
    draftSortValue,
    draftStatus,
    formatCount,
    formatDate,
    hasAttendeeFilters,
    openMessageDrawer,
    page,
    rangeEnd,
    rangeStart,
    router,
    selectedIds,
    sessionId,
    setColumnsOpen,
    setDraftEmail,
    setDraftJoinedFrom,
    setDraftJoinedTo,
    setDraftLearnerName,
    setDraftSortValue,
    setDraftStatus,
    setPage,
    setSelectedIds,
    setSortOpen,
    setStatusOpen,
    sortLabel,
    sortLabelId,
    sortOpen,
    statusLabel,
    statusLabelId,
    statusOpen,
    toggleRow,
    toggleSelectAll,
    totalCount,
    totalPages,
  } = view;
  return (
    <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
        <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">Attendees</h2>
        <p className="text-xs text-[var(--admin-on-surface-variant)]">
          {formatCount(totalCount)} record{totalCount === 1 ? "" : "s"}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
        <label className="grid min-w-[160px] flex-1 gap-1 text-xs text-[var(--admin-on-surface-variant)]">
          Name
          <span className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            <input
              className={`${fieldClassName} pl-9`}
              value={draftLearnerName}
              onChange={(event) => {
                setDraftLearnerName(event.target.value);
              }}
              placeholder="Learner name"
            />
          </span>
        </label>
        <label className="grid min-w-[180px] flex-1 gap-1 text-xs text-[var(--admin-on-surface-variant)]">
          Email
          <input
            className={fieldClassName}
            value={draftEmail}
            onChange={(event) => {
              setDraftEmail(event.target.value);
            }}
            placeholder="Learner email"
          />
        </label>
        <div className="min-w-[160px]">
          <DropdownField
            label="Status"
            labelId={statusLabelId}
            open={statusOpen}
            onToggle={() => {
              setStatusOpen((open) => !open);
              setColumnsOpen(false);
              setSortOpen(false);
            }}
            triggerContent={
              <span className="flex w-full items-center gap-2 text-[13px] font-medium text-[var(--admin-on-surface)]">
                <span className="flex-1 truncate text-left">{statusLabel}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)] transition-transform duration-200 ${statusOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </span>
            }
            panelAriaLabel="Attendee status filter"
          >
            <div className="p-1.5" role="listbox">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value || "all"}
                  type="button"
                  role="option"
                  aria-selected={draftStatus === option.value}
                  className={dropdownItemClassName}
                  onClick={() => {
                    setDraftStatus(option.value);
                    setStatusOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </DropdownField>
        </div>
        <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
          Joined from
          <input
            type="date"
            className={fieldClassName}
            value={draftJoinedFrom}
            onChange={(event) => {
              setDraftJoinedFrom(event.target.value);
            }}
          />
        </label>
        <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
          Joined to
          <input
            type="date"
            className={fieldClassName}
            value={draftJoinedTo}
            onChange={(event) => {
              setDraftJoinedTo(event.target.value);
            }}
          />
        </label>
        <div className="min-w-[200px]">
          <DropdownField
            label="Sort"
            labelId={sortLabelId}
            open={sortOpen}
            onToggle={() => {
              setSortOpen((open) => !open);
              setColumnsOpen(false);
              setStatusOpen(false);
            }}
            triggerContent={
              <span className="flex w-full items-center gap-2 text-[13px] font-medium text-[var(--admin-on-surface)]">
                <span className="flex-1 truncate text-left">{sortLabel}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)] transition-transform duration-200 ${sortOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </span>
            }
            panelAriaLabel="Sort attendees"
          >
            <div className="p-1.5" role="listbox">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={draftSortValue === option.value}
                  className={dropdownItemClassName}
                  onClick={() => {
                    setDraftSortValue(option.value);
                    setSortOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </DropdownField>
        </div>
        <button
          type="button"
          className={primaryButtonClassName}
          onClick={() => {
            applyFilters();
          }}
        >
          Apply
        </button>
      </div>

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
          <p className="text-sm text-[var(--admin-on-surface)]">
            {selectedIds.length} learner{selectedIds.length === 1 ? "" : "s"} selected
          </p>
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={() => {
              openMessageDrawer("selected", selectedIds);
            }}
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            Message selected
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
      ) : null}

      <div className="overflow-x-auto">
        {attendeesLoading && attendees.length === 0 ? (
          <div>
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] px-4"
              >
                <Shimmer className="h-4 w-4" />
                <Shimmer className="h-4 w-32" />
                <Shimmer className="h-4 w-40" />
                <Shimmer className="h-4 w-20" />
                <Shimmer className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : detail.registeredCount === 0 && !hasAttendeeFilters && attendees.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
              <Presentation className="h-6 w-6 text-[var(--admin-outline)]" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
              No registrations for this session
            </h3>
            <p className="mt-1 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
              When learners register, they will appear here with join times and coverage.
            </p>
          </div>
        ) : (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[var(--admin-surface-low)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--admin-primary)]"
                    checked={attendees.length > 0 && selectedIds.length === attendees.length}
                    onChange={toggleSelectAll}
                    aria-label="Select all visible attendees"
                  />
                </th>
                {columns.includes("learner_name") ? <th className="px-4 py-3">Name</th> : null}
                {columns.includes("email") ? <th className="px-4 py-3">Email</th> : null}
                {columns.includes("status") ? <th className="px-4 py-3">Status</th> : null}
                {columns.includes("joined_at") ? <th className="px-4 py-3">Joined</th> : null}
                {columns.includes("left_at") ? <th className="px-4 py-3">Left</th> : null}
                {columns.includes("duration_seconds") ? (
                  <th className="px-4 py-3">Duration</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {attendees.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-10 text-center text-[var(--admin-on-surface-variant)]"
                    colSpan={Math.max(2, columns.length + 1)}
                  >
                    No attendees match these filters.
                  </td>
                </tr>
              ) : (
                attendees.map((attendee) => {
                  const absent = attendee.status === "absent";
                  const rowCoverage = cancelled
                    ? null
                    : coveragePct(attendee.durationSeconds, detail.durationSeconds);
                  const attendeeHref = `/admin/reports/live-class-attendance/${sessionId}/attendees/${attendee.id}`;
                  return (
                    <tr
                      key={attendee.id}
                      className={[
                        "relative h-11 cursor-pointer border-b border-[var(--admin-border)] transition-colors hover:bg-[var(--admin-surface-high)]",
                        absent ? "bg-[color-mix(in_srgb,var(--admin-danger)_4%,transparent)]" : "",
                      ].join(" ")}
                      onClick={() => {
                        router.push(attendeeHref);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(attendeeHref);
                        }
                      }}
                      tabIndex={0}
                      role="link"
                      aria-label={`Open detail for ${attendee.learnerName ?? attendee.email ?? "attendee"}`}
                    >
                      <td
                        className="relative px-4 py-3"
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                        onKeyDown={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        {absent ? (
                          <span
                            className="absolute inset-y-0 left-0 w-[3px] bg-[var(--admin-danger)]"
                            aria-hidden="true"
                          />
                        ) : null}
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--admin-primary)]"
                          checked={selectedIds.includes(attendee.membershipId)}
                          onChange={() => {
                            toggleRow(attendee.membershipId);
                          }}
                          aria-label={`Select ${attendee.learnerName ?? attendee.email ?? "attendee"}`}
                        />
                      </td>
                      {columns.includes("learner_name") ? (
                        <td className="px-4 py-3 font-medium text-[var(--admin-on-surface)]">
                          <Link
                            href={attendeeHref}
                            className="hover:text-[var(--admin-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                          >
                            {attendee.learnerName ?? "-"}
                          </Link>
                        </td>
                      ) : null}
                      {columns.includes("email") ? (
                        <td
                          className={[
                            "px-4 py-3 font-mono text-[13px]",
                            absent
                              ? "text-[color-mix(in_srgb,var(--admin-on-surface-variant)_70%,transparent)]"
                              : "text-[var(--admin-on-surface-variant)]",
                          ].join(" ")}
                        >
                          {attendee.email ?? "-"}
                        </td>
                      ) : null}
                      {columns.includes("status") ? (
                        <td className="px-4 py-3">
                          <StatusPill tone={attendeeStatusTone(attendee.status)}>
                            {titleCase(attendee.status)}
                          </StatusPill>
                        </td>
                      ) : null}
                      {columns.includes("joined_at") ? (
                        <td
                          className={[
                            "px-4 py-3 font-mono text-xs",
                            absent
                              ? "text-[color-mix(in_srgb,var(--admin-on-surface-variant)_70%,transparent)]"
                              : "text-[var(--admin-on-surface-variant)]",
                          ].join(" ")}
                        >
                          {cancelled || absent ? "-" : formatDate(attendee.joinedAt)}
                        </td>
                      ) : null}
                      {columns.includes("left_at") ? (
                        <td
                          className={[
                            "px-4 py-3 font-mono text-xs",
                            absent
                              ? "text-[color-mix(in_srgb,var(--admin-on-surface-variant)_70%,transparent)]"
                              : "text-[var(--admin-on-surface-variant)]",
                          ].join(" ")}
                        >
                          {cancelled || absent ? "-" : formatDate(attendee.leftAt)}
                        </td>
                      ) : null}
                      {columns.includes("duration_seconds") ? (
                        <td className="px-4 py-3">
                          {cancelled || absent ? (
                            <span className="font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
                              -
                            </span>
                          ) : (
                            <div className="min-w-[96px]">
                              <p className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                                {formatDuration(attendee.durationSeconds)}
                              </p>
                              {rowCoverage != null ? (
                                <>
                                  <div className="mt-1">
                                    <MetricBar
                                      pct={rowCoverage}
                                      tone={metricBarTone(rowCoverage)}
                                    />
                                  </div>
                                  <p className="mt-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                    {formatPct(rowCoverage)}
                                  </p>
                                </>
                              ) : null}
                            </div>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-[var(--admin-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[var(--admin-on-surface-variant)]">
          {/* " of" and the space after it are separate text, as before the counts were formatted. */}
          Showing {formatCount(rangeStart)}-{formatCount(rangeEnd)}
          {" of"} {formatCount(totalCount)} · Attendance rate is attendees divided by registrations.
        </p>
        {totalPages > 1 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={ghostButtonClassName}
              disabled={page <= 1 || attendeesLoading}
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
              disabled={page >= totalPages || attendeesLoading}
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
  );
}
